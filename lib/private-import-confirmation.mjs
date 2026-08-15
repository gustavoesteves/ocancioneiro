import { promises as fs } from "node:fs";
import path from "node:path";
import { parseEditorialDossier } from "./editorial-dossier.mjs";
import { createPrivateCapture, PrivateCaptureError } from "./private-capture-store.mjs";

function withoutEdition(editions, editionId) {
  return (editions ?? []).filter((edition) => edition.id !== editionId);
}

export function ensurePrivateImportedEdition(
  dossier,
  { editionId, editorial, metadata },
) {
  const parsed = parseEditorialDossier(dossier);
  const existing = (parsed.editions ?? []).find((edition) => edition.id === editionId);
  if (existing) return { created: false, dossier: parsed, edition: existing };

  const edition = {
    chords: metadata.chords ?? [],
    encodedKey: metadata.key,
    genre: editorial.genre,
    id: editionId,
    instrumentation: metadata.instrumentation,
    level: editorial.level,
    notationProfile: { kind: "lead_sheet" },
    notes: editorial.notes ?? "",
    source: editorial.source,
    status: "em_revisao",
    tags: editorial.tags ?? [],
    title: metadata.title,
  };
  const next = parseEditorialDossier({
    ...parsed,
    editions: [...withoutEdition(parsed.editions, editionId), edition],
  });
  return { created: true, dossier: next, edition };
}

async function writeTextAtomically(filePath, value) {
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fs.writeFile(temporaryPath, value, { encoding: "utf8", flag: "wx" });
    await fs.rename(temporaryPath, filePath);
  } finally {
    await fs.rm(temporaryPath, { force: true });
  }
}

export async function confirmPrivateImport({
  capture,
  dossierEntry,
  editionId,
  editorial,
  metadata,
  projectRoot = process.cwd(),
  xml,
}) {
  const projectRootReal = await fs.realpath(projectRoot);
  const dossierInputPath = path.resolve(dossierEntry.filePath);
  const dossierStat = await fs.lstat(dossierInputPath);
  if (!dossierStat.isFile() || dossierStat.isSymbolicLink()) {
    throw new PrivateCaptureError(
      "UNSAFE_DOSSIER_PATH",
      "O dossie precisa ser um arquivo regular.",
    );
  }
  const dossierPath = await fs.realpath(dossierInputPath);
  const dossierRoot = path.join(projectRootReal, "data", "dossiers");
  const relativeDossier = path.relative(dossierRoot, dossierPath);
  if (
    relativeDossier.startsWith("..") ||
    path.isAbsolute(relativeDossier) ||
    path.extname(dossierPath) !== ".json"
  ) {
    throw new PrivateCaptureError(
      "UNSAFE_DOSSIER_PATH",
      "O dossie precisa permanecer em data/dossiers/.",
    );
  }

  const originalDossier = await fs.readFile(dossierPath, "utf8");
  const editionResult = ensurePrivateImportedEdition(dossierEntry.dossier, {
    editionId,
    editorial,
    metadata,
  });
  let dossierWritten = false;

  try {
    if (editionResult.created) {
      await writeTextAtomically(
        dossierPath,
        `${JSON.stringify(editionResult.dossier, null, 2)}\n`,
      );
      dossierWritten = true;
    }

    const stored = await createPrivateCapture({
      ...capture,
      editionId,
      metadata,
      projectRoot: projectRootReal,
      workId: editionResult.dossier.work.id,
      xml,
    });
    return {
      captureCreated: stored.created,
      dossier: editionResult.dossier,
      editionCreated: editionResult.created,
      record: stored.record,
    };
  } catch (error) {
    if (dossierWritten) await writeTextAtomically(dossierPath, originalDossier);
    throw error;
  }
}
