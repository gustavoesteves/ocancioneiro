import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { MUSESCORE_CAPTURE_PROTOCOL } from "../lib/musescore-capture-protocol.mjs";
import {
  createMuseScoreCaptureBridge,
  parseAllowedOrigins,
  parseMaxCaptureBytes,
} from "../scripts/musescore-capture-bridge.mjs";

const LOCAL_ORIGIN = "http://localhost:3000";
const VALID_XML = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Melodia</part-name></score-part></part-list>
  <part id="P1"><measure number="1"/></part>
</score-partwise>`;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function responseJson(response) {
  return { response, body: await response.json() };
}

async function bridgeFixture(options = {}) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "o-cancioneiro-bridge-test-"));
  const logs = [];
  const bridge = await createMuseScoreCaptureBridge({
    allowedOrigins: new Set([LOCAL_ORIGIN]),
    logger: (event) => logs.push(event),
    port: 0,
    tempRoot,
    ...options,
  });
  const sessionResult = await responseJson(
    await fetch(`${bridge.baseUrl}/api/v1/session`, {
      headers: { Origin: LOCAL_ORIGIN },
    }),
  );
  const pluginResult = await responseJson(
    await fetch(`${bridge.baseUrl}/api/v1/plugin-session`),
  );
  const session = sessionResult.body;
  const plugin = pluginResult.body;

  async function close() {
    await bridge.close();
    const remaining = await fs.readdir(tempRoot);
    await fs.rm(tempRoot, { recursive: true, force: true });
    assert.ok(
      remaining.every((name) => !name.startsWith("o-cancioneiro-musescore-")),
    );
  }

  return { bridge, close, logs, plugin, session };
}

function browserHeaders(session) {
  return {
    Origin: LOCAL_ORIGIN,
    "X-Cancioneiro-Browser-Token": session.browserToken,
  };
}

function pluginHeaders(plugin) {
  return {
    "Content-Type": "application/json",
    "X-Cancioneiro-Plugin-Session": plugin.pluginSessionId,
    "X-Cancioneiro-Plugin-Token": plugin.pluginToken,
  };
}

function envelope(messageType, payload) {
  return {
    protocol: MUSESCORE_CAPTURE_PROTOCOL,
    messageType,
    messageId: `message_${messageType.toLowerCase()}_0001`,
    sentAt: "2026-08-13T12:00:00.000Z",
    payload,
  };
}

async function pairPlugin(fixture) {
  const result = await responseJson(
    await fetch(`${fixture.bridge.baseUrl}/api/v1/plugin/messages`, {
      method: "POST",
      headers: pluginHeaders(fixture.plugin),
      body: JSON.stringify(
        envelope("SESSION_OPEN", {
          sessionId: fixture.session.sessionId,
          pluginSessionId: fixture.plugin.pluginSessionId,
          pluginVersion: "1.0.0",
          musescoreVersion: "4.5.2",
          supportedProtocols: [MUSESCORE_CAPTURE_PROTOCOL],
        }),
      ),
    }),
  );
  assert.equal(result.response.status, 200);
}

async function requestCapture(fixture) {
  return responseJson(
    await fetch(`${fixture.bridge.baseUrl}/api/v1/captures`, {
      method: "POST",
      headers: browserHeaders(fixture.session),
    }),
  );
}

async function pluginEvents(fixture, headers = pluginHeaders(fixture.plugin)) {
  return responseJson(
    await fetch(`${fixture.bridge.baseUrl}/api/v1/plugin/events`, { headers }),
  );
}

async function sendReady(fixture, request, overrides = {}) {
  const xml = overrides.xml ?? VALID_XML;
  if (overrides.write !== false) {
    await fs.writeFile(request.payload.destinationPath, xml);
  }
  const payload = {
    sessionId: fixture.session.sessionId,
    pluginSessionId: fixture.plugin.pluginSessionId,
    requestId: request.payload.requestId,
    exportedAt: "2026-08-13T12:00:02.000Z",
    ...overrides.payload,
  };
  return responseJson(
    await fetch(`${fixture.bridge.baseUrl}/api/v1/plugin/messages`, {
      method: "POST",
      headers: pluginHeaders(fixture.plugin),
      body: JSON.stringify(envelope("CAPTURE_READY", payload)),
    }),
  );
}

test("binds to loopback and rejects public origins and unsafe configuration", async () => {
  assert.throws(
    () => parseAllowedOrigins("https://gustavoesteves.github.io"),
    /exclusivamente loopback/,
  );
  await assert.rejects(
    () =>
      createMuseScoreCaptureBridge({
        allowedOrigins: new Set([LOCAL_ORIGIN]),
        host: "0.0.0.0",
        logger: () => {},
        port: 0,
      }),
    /127\.0\.0\.1/,
  );

  const fixture = await bridgeFixture();
  try {
    assert.match(fixture.bridge.baseUrl, /^http:\/\/127\.0\.0\.1:/);
    assert.notEqual(fixture.session.browserToken, fixture.plugin.pluginToken);
    const rejected = await responseJson(
      await fetch(`${fixture.bridge.baseUrl}/api/v1/session`, {
        headers: { Origin: "https://gustavoesteves.github.io" },
      }),
    );
    assert.equal(rejected.response.status, 403);
    assert.equal(rejected.body.error.code, "ORIGIN_REJECTED");
  } finally {
    await fixture.close();
  }
});

test("parses a reduced capture limit and rejects unsafe values", () => {
  assert.equal(parseMaxCaptureBytes(undefined), 16 * 1024 * 1024);
  assert.equal(parseMaxCaptureBytes("1048576"), 1024 * 1024);
  assert.throws(() => parseMaxCaptureBytes("0"), /inteiro entre 1/);
  assert.throws(() => parseMaxCaptureBytes("1.5"), /inteiro entre 1/);
  assert.throws(() => parseMaxCaptureBytes(String(17 * 1024 * 1024)), /inteiro entre 1/);
});

test("returns the exact MusicXML and verified SHA-256 without logging secrets", async () => {
  const fixture = await bridgeFixture();
  try {
    await pairPlugin(fixture);
    const requested = await requestCapture(fixture);
    assert.equal(requested.response.status, 202);
    const events = await pluginEvents(fixture);
    const request = events.body.events[0];
    assert.equal(request.messageType, "CAPTURE_REQUEST");

    const ready = await sendReady(fixture, request);
    assert.equal(ready.response.status, 200);
    const result = await responseJson(
      await fetch(
        `${fixture.bridge.baseUrl}/api/v1/captures/${requested.body.requestId}`,
        { headers: browserHeaders(fixture.session) },
      ),
    );
    assert.equal(result.response.status, 200);
    assert.equal(result.body.state, "ready");
    assert.equal(result.body.xml, VALID_XML);
    assert.equal(result.body.sha256, sha256(VALID_XML));

    const serializedLogs = JSON.stringify(fixture.logs);
    assert.ok(!serializedLogs.includes(fixture.session.browserToken));
    assert.ok(!serializedLogs.includes(fixture.plugin.pluginToken));
    assert.ok(!serializedLogs.includes(request.payload.destinationPath));
    assert.ok(!serializedLogs.includes(VALID_XML));
  } finally {
    await fixture.close();
  }
});

test("rejects wrong tokens, concurrent requests and stale responses", async () => {
  const fixture = await bridgeFixture();
  try {
    await pairPlugin(fixture);
    const requested = await requestCapture(fixture);
    assert.equal(requested.response.status, 202);

    const unauthorized = await pluginEvents(fixture, {
      ...pluginHeaders(fixture.plugin),
      "X-Cancioneiro-Plugin-Token": "token_incorreto_0000000000000000",
    });
    assert.equal(unauthorized.response.status, 401);
    assert.equal(unauthorized.body.error.code, "TOKEN_REJECTED");

    const duplicate = await requestCapture(fixture);
    assert.equal(duplicate.response.status, 409);
    assert.equal(duplicate.body.error.code, "REQUEST_DUPLICATE");

    const events = await pluginEvents(fixture);
    const traversal = await sendReady(fixture, events.body.events[0], {
      write: false,
      payload: { destinationPath: "../escape.musicxml" },
    });
    assert.equal(traversal.response.status, 400);
    assert.equal(traversal.body.error.code, "INVALID_PAYLOAD");

    const stale = await sendReady(fixture, events.body.events[0], {
      write: false,
      payload: { requestId: "request_from_old_session_0001" },
    });
    assert.equal(stale.response.status, 409);
    assert.equal(stale.body.error.code, "REQUEST_STALE");

    const stillWaiting = await responseJson(
      await fetch(
        `${fixture.bridge.baseUrl}/api/v1/captures/${requested.body.requestId}`,
        { headers: browserHeaders(fixture.session) },
      ),
    );
    assert.equal(stillWaiting.response.status, 202);
  } finally {
    await fixture.close();
  }
});

test("rejects symlinks before reading a capture", async () => {
  const fixture = await bridgeFixture();
  try {
    await pairPlugin(fixture);
    await requestCapture(fixture);
    const events = await pluginEvents(fixture);
    const request = events.body.events[0];
    const outside = path.join(
      path.dirname(path.dirname(request.payload.destinationPath)),
      "outside.musicxml",
    );
    await fs.writeFile(outside, VALID_XML);
    await fs.symlink(outside, request.payload.destinationPath);

    const rejected = await sendReady(fixture, request, { write: false });
    assert.equal(rejected.response.status, 422);
    assert.equal(rejected.body.error.code, "SYMLINK_REJECTED");
  } finally {
    await fixture.close();
  }
});

test("keeps the request recoverable after invalid XML", async () => {
  const fixture = await bridgeFixture();
  try {
    await pairPlugin(fixture);
    await requestCapture(fixture);
    const events = await pluginEvents(fixture);
    const request = events.body.events[0];

    const invalid = await sendReady(fixture, request, { xml: "<score-partwise>" });
    assert.equal(invalid.response.status, 422);
    assert.equal(invalid.body.error.code, "INVALID_MUSICXML");

    const empty = await sendReady(fixture, request, { xml: "" });
    assert.equal(empty.response.status, 422);
    assert.equal(empty.body.error.code, "FILE_TOO_LARGE");

    const recovered = await sendReady(fixture, request);
    assert.equal(recovered.response.status, 200);
  } finally {
    await fixture.close();
  }
});

test("rejects a MusicXML file above the configured byte limit", async () => {
  const fixture = await bridgeFixture({ maxCaptureBytes: 128 });
  try {
    await pairPlugin(fixture);
    await requestCapture(fixture);
    const events = await pluginEvents(fixture);
    const rejected = await sendReady(fixture, events.body.events[0]);

    assert.equal(rejected.response.status, 422);
    assert.equal(rejected.body.error.code, "FILE_TOO_LARGE");
  } finally {
    await fixture.close();
  }
});

test("expires an unanswered capture without waiting in the test", async () => {
  let clock = Date.parse("2026-08-13T12:00:00.000Z");
  const fixture = await bridgeFixture({ now: () => clock });
  try {
    await pairPlugin(fixture);
    const requested = await requestCapture(fixture);
    clock += 31_000;

    const expired = await responseJson(
      await fetch(
        `${fixture.bridge.baseUrl}/api/v1/captures/${requested.body.requestId}`,
        { headers: browserHeaders(fixture.session) },
      ),
    );
    assert.equal(expired.response.status, 200);
    assert.equal(expired.body.state, "failed");
    assert.equal(expired.body.error.code, "REQUEST_EXPIRED");
  } finally {
    await fixture.close();
  }
});

test("removes a temporary directory left by a crashed bridge", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "o-cancioneiro-stale-test-"));
  const stale = path.join(tempRoot, "o-cancioneiro-musescore-stale");
  await fs.mkdir(stale);
  await fs.writeFile(
    path.join(stale, ".owner.json"),
    JSON.stringify({ pid: 99_999_999, startedAt: "2026-08-13T12:00:00.000Z" }),
  );

  const bridge = await createMuseScoreCaptureBridge({
    allowedOrigins: new Set([LOCAL_ORIGIN]),
    logger: () => {},
    port: 0,
    tempRoot,
  });
  try {
    await assert.rejects(() => fs.access(stale), /ENOENT/);
  } finally {
    await bridge.close();
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("does not reuse tokens or sessions after restart", async () => {
  const first = await bridgeFixture();
  const previous = {
    browserToken: first.session.browserToken,
    pluginToken: first.plugin.pluginToken,
    sessionId: first.session.sessionId,
  };
  await first.close();

  const second = await bridgeFixture();
  try {
    assert.notEqual(second.session.sessionId, previous.sessionId);
    assert.notEqual(second.session.browserToken, previous.browserToken);
    assert.notEqual(second.plugin.pluginToken, previous.pluginToken);

    const rejected = await responseJson(
      await fetch(`${second.bridge.baseUrl}/api/v1/status`, {
        headers: {
          Origin: LOCAL_ORIGIN,
          "X-Cancioneiro-Browser-Token": previous.browserToken,
        },
      }),
    );
    assert.equal(rejected.response.status, 401);
    assert.equal(rejected.body.error.code, "TOKEN_REJECTED");
  } finally {
    await second.close();
  }
});
