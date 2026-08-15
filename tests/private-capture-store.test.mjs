import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  canonicalizeMusicXml,
  createPrivateCapture,
  discardPrivateCapture,
  listPrivateCaptures,
  privateCapturePaths,
  restorePrivateCapture,
  sha256,
  verifyPrivateCapture,
} from "../lib/private-capture-store.mjs";

const XML = `<?xml version="1.0"?>\r\n<score-partwise version="4.0">\r\n  <work><work-title>Carinhoso</work-title></work>\r\n  <identification><creator type="composer">Pixinguinha</creator></identification>\r\n  <part-list><score-part id="P1"><part-name>Melodia</part-name></score-part></part-list>\r\n  <part id="P1"><measure number="1"/></part>\r\n</score-partwise>`;

async function fixtureRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cancioneiro-private-"));
  await fs.mkdir(path.join(root, "public"));
  return root;
}

test("preserva o XML bruto e sela hashes distintos fora de public", async () => {
  const projectRoot = await fixtureRoot();
  const captureId = "capture_test_0000000001";

  try {
    const result = await createPrivateCapture({
      captureId,
      capturedAt: "2026-08-13T20:00:00.000Z",
      confirmedBy: "editor-fixture",
      confirmedAt: "2026-08-13T20:01:00.000Z",
      editionId: "edicao-importada-carinhoso",
      expectedRawSha256: sha256(XML),
      metadata: { partCount: 1 },
      projectRoot,
      protocol: "cancioneiro.musescore.capture/1",
      provenance: "musescore_export",
      requestId: "request_test_0000000001",
      workId: "obra-carinhoso",
      xml: XML,
    });
    const paths = await privateCapturePaths(projectRoot, captureId);
    const serializedRecord = await fs.readFile(paths.record, "utf8");

    assert.equal(result.created, true);
    assert.equal(await fs.readFile(paths.rawXml, "utf8"), XML);
    assert.equal(await fs.readFile(paths.canonicalXml, "utf8"), canonicalizeMusicXml(XML));
    assert.equal(result.record.rawSha256, sha256(XML));
    assert.equal(result.record.confirmedBy, "editor-fixture");
    assert.equal(result.record.canonicalSha256, sha256(canonicalizeMusicXml(XML)));
    assert.notEqual(result.record.rawSha256, result.record.canonicalSha256);
    assert.equal(path.relative(path.join(projectRoot, "public"), paths.directory).startsWith(".."), true);
    assert.equal(serializedRecord.includes(projectRoot), false);
    assert.equal(serializedRecord.includes(os.userInfo().username), false);
    assert.equal(
      (await verifyPrivateCapture({ captureId, projectRoot })).verified,
      true,
    );
    const listed = await listPrivateCaptures({ projectRoot });
    assert.equal(listed.issues.length, 0);
    assert.equal(listed.captures.length, 1);
    assert.equal(listed.captures[0].captureId, captureId);
    assert.equal(listed.captures[0].metadata.title, "Carinhoso");
    assert.equal("confirmedBy" in listed.captures[0], false);
    assert.equal(JSON.stringify(listed).includes(XML), false);
    assert.equal(JSON.stringify(listed).includes(projectRoot), false);

    const repeated = await createPrivateCapture({
      captureId,
      capturedAt: "2026-08-13T20:00:00.000Z",
      confirmedBy: "editor-fixture",
      editionId: "edicao-importada-carinhoso",
      expectedRawSha256: sha256(XML),
      projectRoot,
      provenance: "musescore_export",
      requestId: "request_test_0000000001",
      workId: "obra-carinhoso",
      xml: XML,
    });
    assert.equal(repeated.created, false);
    assert.equal(repeated.record.confirmedAt, result.record.confirmedAt);
  } finally {
    await fs.rm(projectRoot, { recursive: true, force: true });
  }
});

test("listagem omite capturas inseguras sem interromper a fila", async () => {
  const projectRoot = await fixtureRoot();
  const captureId = "capture_test_0000000004";

  try {
    await createPrivateCapture({
      captureId,
      confirmedBy: "editor-fixture",
      editionId: "edicao-a",
      projectRoot,
      provenance: "manual_file",
      workId: "obra-a",
      xml: XML,
    });
    const paths = await privateCapturePaths(projectRoot, captureId);
    await fs.chmod(paths.record, 0o600);
    await fs.writeFile(paths.record, "{}\n");

    const listed = await listPrivateCaptures({ projectRoot });
    assert.equal(listed.captures.length, 0);
    assert.deepEqual(listed.issues, [
      { captureId, code: "PRIVATE_CAPTURE_INTEGRITY" },
    ]);
  } finally {
    await fs.rm(projectRoot, { recursive: true, force: true });
  }
});

test("rejeita hash divergente e reutilizacao conflitante do captureId", async () => {
  const projectRoot = await fixtureRoot();
  const captureId = "capture_test_0000000002";

  try {
    await assert.rejects(
      () =>
        createPrivateCapture({
          captureId,
          confirmedBy: "editor-fixture",
          editionId: "edicao-a",
          expectedRawSha256: "0".repeat(64),
          projectRoot,
          provenance: "manual_file",
          workId: "obra-a",
          xml: XML,
        }),
      (error) => error.code === "RAW_HASH_MISMATCH",
    );

    await createPrivateCapture({
      captureId,
      confirmedBy: "editor-fixture",
      editionId: "edicao-a",
      projectRoot,
      provenance: "manual_file",
      workId: "obra-a",
      xml: XML,
    });
    await assert.rejects(
      () =>
        createPrivateCapture({
          captureId,
          confirmedBy: "editor-fixture",
          editionId: "edicao-b",
          projectRoot,
          provenance: "manual_file",
          workId: "obra-a",
          xml: XML,
        }),
      (error) => error.code === "CAPTURE_ID_CONFLICT",
    );
  } finally {
    await fs.rm(projectRoot, { recursive: true, force: true });
  }
});

test("descarte e recuperacao movem a captura sem apagar o historico", async () => {
  const projectRoot = await fixtureRoot();
  const captureId = "capture_test_0000000003";

  try {
    await createPrivateCapture({
      captureId,
      confirmedBy: "editor-fixture",
      editionId: "edicao-a",
      projectRoot,
      provenance: "manual_file",
      workId: "obra-a",
      xml: XML,
    });
    const discarded = await discardPrivateCapture({ captureId, projectRoot });
    const paths = await privateCapturePaths(projectRoot, captureId);
    await assert.rejects(() => fs.access(paths.directory), /ENOENT/);
    assert.equal(discarded.recoverable, true);

    const restored = await restorePrivateCapture({
      captureId,
      projectRoot,
      trashId: discarded.trashId,
    });
    assert.equal(restored.restored, true);
    assert.equal(restored.record.captureId, captureId);
    await fs.access(paths.rawXml);
  } finally {
    await fs.rm(projectRoot, { recursive: true, force: true });
  }
});
