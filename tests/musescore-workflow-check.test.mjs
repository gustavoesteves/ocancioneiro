import assert from "node:assert/strict";
import test from "node:test";
import { runMuseScoreWorkflowCheck } from "../scripts/check-musescore-workflow.mjs";

test("ensaia captura, promocao, pacote e rollback com fixture sintetica livre", async () => {
  assert.deepEqual(await runMuseScoreWorkflowCheck(), {
    captureVerified: true,
    packageAssetCount: 1,
    privateCapturePreservedAfterRollback: true,
    publicAssetRemovedAfterRollback: true,
    rollbackPackageAssetCount: 0,
  });
});
