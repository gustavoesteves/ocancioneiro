import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createPrivateCapture,
  discardPrivateCapture,
} from "../lib/private-capture-store.mjs";
import { runPrivateCaptureOps } from "../scripts/private-capture-ops.mjs";

const XML = `<?xml version="1.0"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Melodia</part-name></score-part></part-list>
  <part id="P1"><measure number="1"/></part>
</score-partwise>`;

function outputBuffer() {
  let contents = "";
  return {
    output: { write: (value) => { contents += value; } },
    read: () => contents,
  };
}

test("verifica e restaura captura sem expor XML, caminho ou autoria", async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "capture-ops-test-"));
  const captureId = "capture_ops_fixture_000001";
  try {
    await createPrivateCapture({
      captureId,
      confirmedBy: "nome-privado-do-editor",
      editionId: "edicao-fixture",
      projectRoot,
      provenance: "manual_file",
      workId: "obra-fixture",
      xml: XML,
    });
    const verifyOutput = outputBuffer();
    const verified = await runPrivateCaptureOps({
      args: ["verify", captureId],
      output: verifyOutput.output,
      projectRoot,
    });
    assert.equal(verified.verified, true);
    assert.doesNotMatch(verifyOutput.read(), /score-partwise/);
    assert.doesNotMatch(verifyOutput.read(), /nome-privado-do-editor/);
    assert.doesNotMatch(verifyOutput.read(), new RegExp(projectRoot));

    const discarded = await discardPrivateCapture({ captureId, projectRoot });
    const restoreOutput = outputBuffer();
    const restored = await runPrivateCaptureOps({
      args: ["restore", captureId, discarded.trashId],
      output: restoreOutput.output,
      projectRoot,
    });
    assert.deepEqual(restored, { captureId, restored: true });
  } finally {
    await fs.rm(projectRoot, { recursive: true, force: true });
  }
});

test("recuperacao sem transacoes interrompidas e idempotente", async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "capture-ops-test-"));
  try {
    const buffered = outputBuffer();
    const result = await runPrivateCaptureOps({
      args: ["recover-promotions"],
      output: buffered.output,
      projectRoot,
    });
    assert.deepEqual(result, {
      recoveredCount: 0,
      releasedStaleLock: false,
      transactionIds: [],
    });
  } finally {
    await fs.rm(projectRoot, { recursive: true, force: true });
  }
});

test("recuperacao libera lock abandonado por processo encerrado", async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "capture-ops-test-"));
  try {
    const lockPath = path.join(
      projectRoot,
      ".local",
      "cancioneiro",
      "locks",
      "promotion-catalog.lock",
    );
    await fs.mkdir(lockPath, { recursive: true });
    await fs.writeFile(
      path.join(lockPath, "owner.json"),
      `${JSON.stringify({ pid: 999_999_999, transactionId: "promotion_abandoned" })}\n`,
    );
    const buffered = outputBuffer();
    const result = await runPrivateCaptureOps({
      args: ["recover-promotions"],
      output: buffered.output,
      projectRoot,
    });
    assert.equal(result.releasedStaleLock, true);
    await assert.rejects(() => fs.access(lockPath), /ENOENT/);
  } finally {
    await fs.rm(projectRoot, { recursive: true, force: true });
  }
});
