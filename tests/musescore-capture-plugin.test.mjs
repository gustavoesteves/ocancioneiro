import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import test from "node:test";

const pluginPath = new URL("../plugins/CancioneiroCapture.qml", import.meta.url);

test("MuseScore plugin is capture-only and points exclusively to loopback", async () => {
  const plugin = await fs.readFile(pluginPath, "utf8");

  assert.match(plugin, /http:\/\/127\.0\.0\.1:47631/);
  assert.match(plugin, /writeScore\(curScore, payload\.destinationPath, "musicxml"\)/);
  assert.match(plugin, /CAPTURE_READY/);
  assert.match(plugin, /CAPTURE_FAILED/);
  assert.match(plugin, /NO_ACTIVE_SCORE/);
  assert.ok(!plugin.includes("startCmd"));
  assert.ok(!plugin.includes("endCmd"));
  assert.ok(!plugin.includes("newElement"));
  assert.ok(!plugin.includes("INSERT_CHORD"));
  assert.ok(!plugin.includes("public/musicxml"));
  assert.ok(!plugin.includes("github.io"));
});

test("MuseScore plugin correlates sessions and prevents concurrent exports", async () => {
  const plugin = await fs.readFile(pluginPath, "utf8");

  assert.match(plugin, /payload\.sessionId !== sessionId/);
  assert.match(plugin, /payload\.pluginSessionId !== pluginSessionId/);
  assert.match(plugin, /payload\.requestId !== activeRequestId/);
  assert.match(plugin, /property bool exportInProgress: false/);
  assert.match(plugin, /REQUEST_DUPLICATE/);
  assert.match(plugin, /clearSession\(\)/);
});
