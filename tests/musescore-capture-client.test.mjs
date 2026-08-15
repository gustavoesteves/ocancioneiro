import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { MuseScoreCaptureClient } from "../app/musescore-capture-client.ts";
import { MUSESCORE_CAPTURE_PROTOCOL } from "../lib/musescore-capture-protocol.mjs";
import { createMuseScoreCaptureBridge } from "../scripts/musescore-capture-bridge.mjs";

const LOCAL_ORIGIN = "http://localhost:3000";
const XML = `<?xml version="1.0"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Melodia</part-name></score-part></part-list><part id="P1"><measure number="1"/></part></score-partwise>`;

function envelope(messageType, payload) {
  return {
    protocol: MUSESCORE_CAPTURE_PROTOCOL,
    messageType,
    messageId: `client_test_${messageType.toLowerCase()}_0001`,
    sentAt: new Date().toISOString(),
    payload,
  };
}

test("browser client receives a capture and ignores it after cancellation", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "o-cancioneiro-client-test-"));
  const bridge = await createMuseScoreCaptureBridge({
    allowedOrigins: new Set([LOCAL_ORIGIN]),
    logger: () => {},
    port: 0,
    tempRoot,
  });
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = (input, init = {}) => {
    const headers = new Headers(init.headers);
    if (String(input).startsWith(bridge.baseUrl)) headers.set("Origin", LOCAL_ORIGIN);
    return nativeFetch(input, { ...init, headers });
  };

  try {
    const pluginResponse = await fetch(`${bridge.baseUrl}/api/v1/plugin-session`);
    const plugin = await pluginResponse.json();
    const pluginHeaders = {
      "Content-Type": "application/json",
      "X-Cancioneiro-Plugin-Session": plugin.pluginSessionId,
      "X-Cancioneiro-Plugin-Token": plugin.pluginToken,
    };
    const paired = await fetch(`${bridge.baseUrl}/api/v1/plugin/messages`, {
      method: "POST",
      headers: pluginHeaders,
      body: JSON.stringify(
        envelope("SESSION_OPEN", {
          sessionId: plugin.sessionId,
          pluginSessionId: plugin.pluginSessionId,
          pluginVersion: "1.0.0",
          musescoreVersion: "4.5.2",
          supportedProtocols: [MUSESCORE_CAPTURE_PROTOCOL],
        }),
      ),
    });
    assert.equal(paired.status, 200);

    const client = new MuseScoreCaptureClient(bridge.baseUrl);
    const capturePromise = client.capture();
    let request;
    for (let attempt = 0; attempt < 20 && !request; attempt += 1) {
      const eventsResponse = await fetch(`${bridge.baseUrl}/api/v1/plugin/events`, {
        headers: pluginHeaders,
      });
      const events = await eventsResponse.json();
      request = events.events?.[0];
      if (!request) await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.ok(request);
    await fs.writeFile(request.payload.destinationPath, XML);
    const ready = await fetch(`${bridge.baseUrl}/api/v1/plugin/messages`, {
      method: "POST",
      headers: pluginHeaders,
      body: JSON.stringify(
        envelope("CAPTURE_READY", {
          sessionId: plugin.sessionId,
          pluginSessionId: plugin.pluginSessionId,
          requestId: request.payload.requestId,
          exportedAt: new Date().toISOString(),
        }),
      ),
    });
    assert.equal(ready.status, 200);

    const capture = await capturePromise;
    assert.equal(capture.xml, XML);
    assert.equal(capture.state, "ready");
    assert.match(capture.sha256, /^[a-f0-9]{64}$/);

    const cancelledPromise = client.capture();
    await new Promise((resolve) => setTimeout(resolve, 10));
    await client.cancel();
    await assert.rejects(cancelledPromise, (error) => error.name === "AbortError");
  } finally {
    globalThis.fetch = nativeFetch;
    await bridge.close();
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});
