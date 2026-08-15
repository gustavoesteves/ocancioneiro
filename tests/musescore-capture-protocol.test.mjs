import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  CAPTURE_ERROR_CODES,
  CAPTURE_MESSAGE_TYPES,
  CAPTURE_REQUEST_TIMEOUT_MS,
  CaptureProtocolError,
  isCurrentCaptureResponse,
  MAX_CAPTURE_BYTES,
  MAX_PENDING_CAPTURE_REQUESTS,
  MUSESCORE_CAPTURE_PROTOCOL,
  parseCaptureMessage,
  safeParseCaptureMessage,
} from "../lib/musescore-capture-protocol.mjs";

const fixtureRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "musescore-protocol",
);

async function fixture(kind, name) {
  return JSON.parse(
    await fs.readFile(path.join(fixtureRoot, kind, `${name}.json`), "utf8"),
  );
}

test("declares the bounded v1 capture envelope", () => {
  assert.equal(MUSESCORE_CAPTURE_PROTOCOL, "cancioneiro.musescore.capture/1");
  assert.deepEqual(CAPTURE_MESSAGE_TYPES, [
    "SESSION_OPEN",
    "CAPTURE_REQUEST",
    "CAPTURE_READY",
    "CAPTURE_FAILED",
    "STATUS",
  ]);
  assert.equal(CAPTURE_REQUEST_TIMEOUT_MS, 30_000);
  assert.equal(MAX_CAPTURE_BYTES, 16 * 1024 * 1024);
  assert.equal(MAX_PENDING_CAPTURE_REQUESTS, 1);
  assert.ok(CAPTURE_ERROR_CODES.includes("NO_ACTIVE_SCORE"));
  assert.ok(!CAPTURE_MESSAGE_TYPES.includes("MUTATION"));
});

for (const name of [
  "session-open",
  "capture-request",
  "capture-ready",
  "capture-failed",
  "status",
]) {
  test(`accepts the valid ${name} fixture`, async () => {
    const message = await fixture("valid", name);
    assert.equal(parseCaptureMessage(message), message);
  });
}

for (const [name, code] of [
  ["unknown-message", "UNKNOWN_MESSAGE_TYPE"],
  ["mutation-command", "UNKNOWN_MESSAGE_TYPE"],
  ["missing-request-id", "INVALID_PAYLOAD"],
  ["unsupported-protocol", "UNSUPPORTED_PROTOCOL"],
]) {
  test(`rejects the invalid ${name} fixture without side effects`, async () => {
    const message = await fixture("invalid", name);
    assert.throws(
      () => parseCaptureMessage(message),
      (error) => error instanceof CaptureProtocolError && error.code === code,
    );
  });
}

test("reports incomplete payloads with an actionable field", async () => {
  const message = await fixture("valid", "capture-request");
  message.payload.maxBytes = 0;
  const result = safeParseCaptureMessage(message);

  assert.equal(result.success, false);
  assert.equal(result.error.code, "INVALID_PAYLOAD");
  assert.equal(result.error.field, "payload.maxBytes");
});

test("does not correlate a response from another request or session", async () => {
  const response = await fixture("valid", "capture-ready");
  const current = {
    sessionId: response.payload.sessionId,
    pluginSessionId: response.payload.pluginSessionId,
    requestId: response.payload.requestId,
  };

  assert.equal(isCurrentCaptureResponse(response, current), true);
  assert.equal(
    isCurrentCaptureResponse(response, {
      ...current,
      requestId: "capture_request_9999",
    }),
    false,
  );
  assert.equal(
    isCurrentCaptureResponse(response, {
      ...current,
      pluginSessionId: "plugin_session_9999",
    }),
    false,
  );
});

test("rejects unknown fields instead of silently widening the contract", async () => {
  const message = await fixture("valid", "capture-ready");
  message.payload.scorePath = "/Users/editor/score.mscz";

  assert.throws(
    () => parseCaptureMessage(message),
    (error) =>
      error instanceof CaptureProtocolError &&
      error.code === "INVALID_PAYLOAD" &&
      error.field === "payload",
  );
});
