import { constants as fsConstants, promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { parseCatalog } from "./catalog.mjs";
import {
  parseEditorialDossier,
} from "./editorial-dossier.mjs";
import { promotionGateState } from "./promotion-policy.mjs";
import {
  legacyProjectionIssues,
  publicCatalogFromDossiers,
} from "./dossier-catalog-projection.mjs";
import {
  privateCapturePaths,
  sha256,
  verifyPrivateCapture,
} from "./private-capture-store.mjs";
import {
  validateAssetChecksums,
  validateMusicXmlAssets,
  loadEditorialDossiers,
} from "../scripts/validate-dossiers.mjs";

const publicIdPattern = /^[a-z0-9][a-z0-9-]{0,127}$/;
const transactionIdPattern = /^promotion_[a-f0-9]{32}$/;

export class PrivatePromotionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PrivatePromotionError";
    this.code = code;
  }
}

function requireText(value, field, maximum = 128) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maximum) {
    throw new PrivatePromotionError("INVALID_PROMOTION", `${field} invalido.`);
  }
  return value.trim();
}

function requirePublicId(value) {
  if (typeof value !== "string" || !publicIdPattern.test(value)) {
    throw new PrivatePromotionError("INVALID_PROMOTION", "publicId invalido.");
  }
  return value;
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function writeTextAtomically(filePath, contents) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporaryPath, contents, { encoding: "utf8", flag: "wx" });
    await fs.rename(temporaryPath, filePath);
  } finally {
    await fs.rm(temporaryPath, { force: true });
  }
}

async function writeJsonAtomically(filePath, value) {
  return writeTextAtomically(filePath, json(value));
}

function relativeInside(root, target, field) {
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new PrivatePromotionError("UNSAFE_PROMOTION_PATH", `${field} inseguro.`);
  }
  return relative.split(path.sep).join("/");
}

function resolveInside(root, relative, field) {
  if (typeof relative !== "string" || relative.includes("\\")) {
    throw new PrivatePromotionError("UNSAFE_PROMOTION_PATH", `${field} inseguro.`);
  }
  const target = path.resolve(root, relative);
  relativeInside(root, target, field);
  return target;
}

function assetVersionId(publicId, checksum) {
  return `asset-musicxml-${publicId}-${checksum.slice(0, 12)}`;
}

function assetPublicPath(publicId, assetId) {
  return `/musicxml/${publicId}/${assetId}.musicxml`;
}

export function assertPromotionAllowed(dossier, record) {
  const parsed = parseEditorialDossier(dossier);
  if (parsed.work.id !== record.workId) {
    throw new PrivatePromotionError(
      "PROMOTION_IDENTITY_MISMATCH",
      "A captura nao pertence ao dossie selecionado.",
    );
  }
  const gates = promotionGateState(parsed, record.editionId);
  const edition = gates.edition;
  if (!edition) {
    throw new PrivatePromotionError(
      "PROMOTION_EDITION_NOT_FOUND",
      "A edicao vinculada a captura nao existe.",
    );
  }
  if (!gates.editionValid) {
    throw new PrivatePromotionError(
      "PROMOTION_EDITION_NOT_VALID",
      "A edicao precisa estar valida antes da promocao.",
    );
  }
  if (!gates.curationAccepted) {
    throw new PrivatePromotionError(
      "PROMOTION_CURATION_NOT_ACCEPTED",
      "A curadoria da obra precisa estar aceita antes da promocao.",
    );
  }
  if (gates.blockedRights.length > 0) {
    throw new PrivatePromotionError(
      "PROMOTION_RIGHTS_BLOCKED",
      `Direitos nao permitem promocao: ${gates.blockedRights.join(", ")}.`,
    );
  }
  return { dossier: parsed, edition };
}

export function preparePromotedDossier(
  dossier,
  { captureId, checksum, editionId, promotedAt, promotedBy, publicId },
) {
  const parsed = parseEditorialDossier(dossier);
  const edition = (parsed.editions ?? []).find(
    (candidate) => candidate.id === editionId,
  );
  if (!edition) {
    throw new PrivatePromotionError(
      "PROMOTION_EDITION_NOT_FOUND",
      "A edicao vinculada a captura nao existe.",
    );
  }
  if (parsed.publicCatalogId && parsed.publicCatalogId !== publicId) {
    throw new PrivatePromotionError(
      "PROMOTION_PUBLIC_ID_CONFLICT",
      "O dossie ja possui outro identificador publico.",
    );
  }
  if (edition.publicCatalogId && edition.publicCatalogId !== publicId) {
    throw new PrivatePromotionError(
      "PROMOTION_PUBLIC_ID_CONFLICT",
      "A edicao ja possui outro identificador publico.",
    );
  }

  const assets = parsed.assets ?? [];
  const matchingAsset = assets.find(
    (asset) =>
      asset.type === "musicxml" &&
      asset.editionId === editionId &&
      asset.checksum === checksum,
  );
  if (matchingAsset) {
    return {
      asset: matchingAsset,
      dossier: parsed,
      idempotent: true,
      promoted: false,
    };
  }

  const currentAssets = assets.filter(
    (asset) => asset.type === "musicxml" && asset.status === "valido",
  );
  if (currentAssets.length > 1) {
    throw new PrivatePromotionError(
      "PROMOTION_STATE_INCONSISTENT",
      "O dossie possui mais de um MusicXML publico vigente.",
    );
  }
  const currentAsset = currentAssets[0] ?? null;
  const assetId = assetVersionId(publicId, checksum);
  const publicPath = assetPublicPath(publicId, assetId);
  const replacementReason = `Substituicao promovida da captura ${captureId} em ${promotedAt}.`;
  const retainedAssets = assets.map((asset) =>
    asset.id === currentAsset?.id
      ? {
          ...asset,
          replacedByAssetId: assetId,
          replacementReason,
          status: "substituido",
        }
      : asset,
  );
  const promotedAsset = {
    checksum,
    checksumAlgorithm: "sha256",
    editionId,
    generatedAt: promotedAt.slice(0, 10),
    generatedBy: promotedBy,
    id: assetId,
    path: publicPath,
    ...(currentAsset ? { replacesAssetId: currentAsset.id } : {}),
    status: "valido",
    type: "musicxml",
  };
  const nextDossier = parseEditorialDossier({
    ...parsed,
    publicCatalogId: publicId,
    editions: (parsed.editions ?? []).map((candidate) =>
      candidate.id === editionId
        ? { ...candidate, publicCatalogId: publicId }
        : candidate,
    ),
    assets: [...retainedAssets, promotedAsset],
  });

  return {
    asset: promotedAsset,
    dossier: nextDossier,
    idempotent: false,
    promoted: true,
  };
}

async function assertExistingPromotionConsistent({ asset, catalogPath, projectRoot }) {
  const assetPath = resolveInside(
    path.join(projectRoot, "public"),
    asset.path.replace(/^\/+/, ""),
    "asset publico",
  );
  const contents = await fs.readFile(assetPath, "utf8").catch((error) => {
    if (error?.code === "ENOENT") {
      throw new PrivatePromotionError(
        "PROMOTION_STATE_INCONSISTENT",
        "O asset promovido esta ausente.",
      );
    }
    throw error;
  });
  if (sha256(contents) !== asset.checksum) {
    throw new PrivatePromotionError(
      "PROMOTION_STATE_INCONSISTENT",
      "O asset promovido possui hash divergente.",
    );
  }
  const catalog = parseCatalog(JSON.parse(await fs.readFile(catalogPath, "utf8")));
  if (!catalog.songs.some((song) => song.musicxml === asset.path)) {
    throw new PrivatePromotionError(
      "PROMOTION_STATE_INCONSISTENT",
      "O catalogo nao referencia o asset promovido.",
    );
  }
}

async function acquireLock(root, transactionId) {
  const lockRoot = path.join(root, "locks");
  const lockPath = path.join(lockRoot, "promotion-catalog.lock");
  await fs.mkdir(lockRoot, { recursive: true, mode: 0o700 });
  try {
    await fs.mkdir(lockPath, { mode: 0o700 });
    try {
      await fs.writeFile(
        path.join(lockPath, "owner.json"),
        json({ pid: process.pid, transactionId, startedAt: new Date().toISOString() }),
        { encoding: "utf8", flag: "wx", mode: 0o600 },
      );
    } catch (error) {
      await fs.rm(lockPath, { recursive: true, force: true });
      throw error;
    }
    return lockPath;
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    throw new PrivatePromotionError(
      "PROMOTION_CONFLICT",
      "Outra promocao desta edicao esta em andamento.",
    );
  }
}

async function updateJournal(transactionDirectory, current, updates) {
  const next = { ...current, ...updates };
  await writeJsonAtomically(path.join(transactionDirectory, "journal.json"), next);
  return next;
}

async function validateStagedPromotion({ dossier, dossierPath, transactionDirectory, xml }) {
  const validationRoot = path.join(transactionDirectory, "validation");
  const validationDossierPath = path.join(
    validationRoot,
    "data",
    "dossiers",
    path.basename(dossierPath),
  );
  const asset = (dossier.assets ?? []).find(
    (candidate) => candidate.type === "musicxml" && candidate.status === "valido",
  );
  if (!asset) {
    throw new PrivatePromotionError(
      "PROMOTION_VALIDATION_FAILED",
      "A promocao nao produziu asset vigente.",
    );
  }
  const validationAssetPath = resolveInside(
    path.join(validationRoot, "public"),
    asset.path.replace(/^\/+/, ""),
    "asset de validacao",
  );
  await fs.mkdir(path.dirname(validationDossierPath), { recursive: true });
  await fs.mkdir(path.dirname(validationAssetPath), { recursive: true });
  await Promise.all([
    fs.writeFile(validationDossierPath, json(dossier), "utf8"),
    fs.writeFile(validationAssetPath, xml, "utf8"),
  ]);
  const entries = [{ dossier, filePath: validationDossierPath }];
  await validateAssetChecksums(entries, { projectRoot: validationRoot });
  await validateMusicXmlAssets(entries, { projectRoot: validationRoot });
}

async function restoreTransaction(projectRoot, transactionDirectory, journal, reason) {
  const dossierPath = resolveInside(projectRoot, journal.dossierRelativePath, "dossie");
  const catalogPath = resolveInside(projectRoot, journal.catalogRelativePath, "catalogo");
  const assetPath = resolveInside(projectRoot, journal.assetRelativePath, "asset");
  const beforeDossier = path.join(transactionDirectory, "before", "dossier.json");
  const beforeCatalog = path.join(transactionDirectory, "before", "catalog.json");
  const [currentDossier, currentCatalog, originalDossier, originalCatalog] =
    await Promise.all([
      fs.readFile(dossierPath, "utf8"),
      fs.readFile(catalogPath, "utf8"),
      fs.readFile(beforeDossier, "utf8"),
      fs.readFile(beforeCatalog, "utf8"),
    ]);
  const dossierCanRestore = [
    journal.originalDossierSha256,
    journal.nextDossierSha256,
  ].includes(sha256(currentDossier));
  const catalogCanRestore = [
    journal.originalCatalogSha256,
    journal.nextCatalogSha256,
  ].includes(sha256(currentCatalog));
  if (
    !dossierCanRestore &&
    (JSON.parse(currentDossier).assets ?? []).some(
      (asset) => asset.id === journal.assetId,
    )
  ) {
    throw new PrivatePromotionError(
      "PROMOTION_RECOVERY_CONFLICT",
      "O dossie mudou depois de receber o asset; recuperacao manual necessaria.",
    );
  }
  if (
    !catalogCanRestore &&
    JSON.parse(currentCatalog).songs?.some(
      (song) => song.musicxml === `/${journal.assetRelativePath.replace(/^public\//, "")}`,
    )
  ) {
    throw new PrivatePromotionError(
      "PROMOTION_RECOVERY_CONFLICT",
      "O catalogo mudou depois da promocao; recuperacao manual necessaria.",
    );
  }
  if (dossierCanRestore) await writeTextAtomically(dossierPath, originalDossier);
  if (catalogCanRestore) await writeTextAtomically(catalogPath, originalCatalog);
  await fs.rm(assetPath, { force: true });
  return updateJournal(transactionDirectory, journal, {
    failure: reason,
    preservedExternalCatalogChange: !catalogCanRestore,
    preservedExternalDossierChange: !dossierCanRestore,
    recoveredAt: new Date().toISOString(),
    state: "rolled_back",
  });
}

async function maybeFail(options, phase, details) {
  if (typeof options.onPhase === "function") {
    await options.onPhase(phase, details);
  }
  if (options.failAfterPhase === phase) {
    throw new PrivatePromotionError(
      "INJECTED_PROMOTION_FAILURE",
      `Falha injetada depois de ${phase}.`,
    );
  }
  if (options.crashAfterPhase === phase) {
    const error = new PrivatePromotionError(
      "SIMULATED_PROMOTION_CRASH",
      `Interrupcao simulada depois de ${phase}.`,
    );
    error.simulatedCrash = true;
    throw error;
  }
}

export async function promotePrivateCapture({
  captureId,
  projectRoot = process.cwd(),
  promotedAt = new Date().toISOString(),
  promotedBy,
  publicId,
  ...options
}) {
  requirePublicId(publicId);
  promotedBy = requireText(promotedBy, "promotedBy");
  const projectRootReal = await fs.realpath(projectRoot);
  const verified = await verifyPrivateCapture({ captureId, projectRoot: projectRootReal });
  const record = verified.record;
  const capturePaths = await privateCapturePaths(projectRootReal, captureId);
  const xml = await fs.readFile(capturePaths.canonicalXml, "utf8");
  const dossierEntries = await loadEditorialDossiers(
    path.join(projectRootReal, "data", "dossiers"),
  );
  const dossierEntry = dossierEntries.find(
    (entry) => entry.dossier.work.id === record.workId,
  );
  if (!dossierEntry) {
    throw new PrivatePromotionError(
      "PROMOTION_DOSSIER_NOT_FOUND",
      "Dossie da captura privada nao encontrado.",
    );
  }
  const allowed = assertPromotionAllowed(dossierEntry.dossier, record);
  const prepared = preparePromotedDossier(allowed.dossier, {
    captureId,
    checksum: record.canonicalSha256,
    editionId: record.editionId,
    promotedAt,
    promotedBy,
    publicId,
  });
  const catalogPath = path.join(projectRootReal, "public", "catalog.json");
  if (prepared.idempotent) {
    if (prepared.asset.status !== "valido") {
      return {
        asset: prepared.asset,
        captureId,
        historical: true,
        idempotent: true,
        promoted: false,
        transactionId: null,
      };
    }
    await assertExistingPromotionConsistent({
      asset: prepared.asset,
      catalogPath,
      projectRoot: projectRootReal,
    });
    return {
      asset: prepared.asset,
      captureId,
      idempotent: true,
      promoted: false,
      transactionId: null,
    };
  }

  const transactionId = `promotion_${randomUUID().replaceAll("-", "")}`;
  const transactionDirectory = path.join(
    capturePaths.root,
    "transactions",
    transactionId,
  );
  const dossierPath = await fs.realpath(dossierEntry.filePath);
  const assetPath = resolveInside(
    path.join(projectRootReal, "public"),
    prepared.asset.path.replace(/^\/+/, ""),
    "asset publico",
  );
  const existingAsset = await fs.access(assetPath, fsConstants.F_OK).then(
    () => true,
    (error) => {
      if (error?.code === "ENOENT") return false;
      throw error;
    },
  );
  if (existingAsset) {
    throw new PrivatePromotionError(
      "PROMOTION_ASSET_CONFLICT",
      "O caminho da nova versao ja existe.",
    );
  }

  const originalDossier = await fs.readFile(dossierPath, "utf8");
  const originalCatalog = await fs.readFile(catalogPath, "utf8");
  const originalDossierSha256 = sha256(originalDossier);
  let journal = {
    schemaVersion: 1,
    transactionId,
    state: "preparing",
    captureId,
    workId: record.workId,
    editionId: record.editionId,
    publicId,
    assetId: prepared.asset.id,
    checksum: prepared.asset.checksum,
    promotedAt,
    promotedBy,
    dossierRelativePath: relativeInside(projectRootReal, dossierPath, "dossie"),
    catalogRelativePath: relativeInside(projectRootReal, catalogPath, "catalogo"),
    assetRelativePath: relativeInside(projectRootReal, assetPath, "asset"),
  };
  let preserveInterruptedState = false;
  let lockPath = null;

  try {
    lockPath = await acquireLock(capturePaths.root, transactionId);
    await fs.mkdir(path.join(transactionDirectory, "before"), {
      recursive: true,
      mode: 0o700,
    });
    await Promise.all([
      fs.writeFile(
        path.join(transactionDirectory, "before", "dossier.json"),
        originalDossier,
        "utf8",
      ),
      fs.writeFile(
        path.join(transactionDirectory, "before", "catalog.json"),
        originalCatalog,
        "utf8",
      ),
      fs.writeFile(path.join(transactionDirectory, "asset.musicxml"), xml, "utf8"),
      fs.writeFile(
        path.join(transactionDirectory, "next-dossier.json"),
        json(prepared.dossier),
        "utf8",
      ),
    ]);

    const allDossiers = dossierEntries.map((entry) =>
      entry.dossier.work.id === record.workId ? prepared.dossier : entry.dossier,
    );
    const nextCatalog = publicCatalogFromDossiers(allDossiers);
    parseCatalog(nextCatalog);
    const projected = nextCatalog.songs.find((song) => song.id === publicId);
    if (projected?.musicxml !== prepared.asset.path) {
      throw new PrivatePromotionError(
        "PROMOTION_VALIDATION_FAILED",
        "O catalogo preparado nao referencia a nova versao.",
      );
    }
    const projectionIssues = legacyProjectionIssues(prepared.dossier);
    if (projectionIssues.length > 0) {
      throw new PrivatePromotionError(
        "PROMOTION_VALIDATION_FAILED",
        `Promocao bloqueada: ${projectionIssues.join(", ")}.`,
      );
    }
    await validateStagedPromotion({
      dossier: prepared.dossier,
      dossierPath,
      transactionDirectory,
      xml,
    });
    await fs.writeFile(
      path.join(transactionDirectory, "next-catalog.json"),
      json(nextCatalog),
      "utf8",
    );
    journal = await updateJournal(transactionDirectory, journal, {
      nextCatalogSha256: sha256(json(nextCatalog)),
      nextDossierSha256: sha256(json(prepared.dossier)),
      originalCatalogSha256: sha256(originalCatalog),
      originalDossierSha256,
      state: "prepared",
    });
    await maybeFail(options, "prepared", { journal, transactionDirectory });

    const currentDossierText = await fs.readFile(dossierPath, "utf8");
    const currentDossier = parseEditorialDossier(JSON.parse(currentDossierText));
    assertPromotionAllowed(currentDossier, record);
    if (sha256(currentDossierText) !== originalDossierSha256) {
      throw new PrivatePromotionError(
        "PROMOTION_DOSSIER_CHANGED",
        "O dossie mudou durante a promocao; tente novamente.",
      );
    }

    await fs.mkdir(path.dirname(assetPath), { recursive: true });
    await fs.copyFile(
      path.join(transactionDirectory, "asset.musicxml"),
      assetPath,
      fsConstants.COPYFILE_EXCL,
    );
    journal = await updateJournal(transactionDirectory, journal, {
      state: "asset_written",
    });
    await maybeFail(options, "asset_written", { journal, transactionDirectory });

    const beforeDossierCommit = await fs.readFile(dossierPath, "utf8");
    assertPromotionAllowed(
      parseEditorialDossier(JSON.parse(beforeDossierCommit)),
      record,
    );
    if (sha256(beforeDossierCommit) !== originalDossierSha256) {
      throw new PrivatePromotionError(
        "PROMOTION_DOSSIER_CHANGED",
        "O dossie mudou durante a promocao; tente novamente.",
      );
    }
    await writeTextAtomically(dossierPath, json(prepared.dossier));
    journal = await updateJournal(transactionDirectory, journal, {
      state: "dossier_written",
    });
    await maybeFail(options, "dossier_written", { journal, transactionDirectory });

    const committedDossierText = await fs.readFile(dossierPath, "utf8");
    if (sha256(committedDossierText) !== sha256(json(prepared.dossier))) {
      throw new PrivatePromotionError(
        "PROMOTION_DOSSIER_CHANGED",
        "O dossie mudou antes da atualizacao do catalogo.",
      );
    }
    await writeTextAtomically(catalogPath, json(nextCatalog));
    journal = await updateJournal(transactionDirectory, journal, {
      state: "catalog_written",
    });
    await maybeFail(options, "catalog_written", { journal, transactionDirectory });

    journal = await updateJournal(transactionDirectory, journal, {
      completedAt: new Date().toISOString(),
      state: "committed",
    });
    await fs.rm(path.join(transactionDirectory, "asset.musicxml"), { force: true });
    await fs.rm(path.join(transactionDirectory, "validation"), {
      recursive: true,
      force: true,
    });
    return {
      asset: prepared.asset,
      captureId,
      idempotent: false,
      promoted: true,
      promotedBy,
      transactionId,
    };
  } catch (error) {
    preserveInterruptedState = error?.simulatedCrash === true;
    if (!preserveInterruptedState) {
      const journalPath = path.join(transactionDirectory, "journal.json");
      const persistedJournal = await fs
        .readFile(journalPath, "utf8")
        .then(JSON.parse)
        .catch(() => null);
      if (persistedJournal) {
        await restoreTransaction(
          projectRootReal,
          transactionDirectory,
          persistedJournal,
          error instanceof Error ? error.message : String(error),
        );
      } else {
        await fs.rm(transactionDirectory, { recursive: true, force: true });
      }
    }
    throw error;
  } finally {
    if (!preserveInterruptedState) {
      if (lockPath) await fs.rm(lockPath, { recursive: true, force: true });
    }
  }
}

export async function recoverInterruptedPromotions({
  force = false,
  projectRoot = process.cwd(),
} = {}) {
  const projectRootReal = await fs.realpath(projectRoot);
  const probeCaptureId = "capture_recovery_00000001";
  const paths = await privateCapturePaths(projectRootReal, probeCaptureId);
  const transactionRoot = path.join(paths.root, "transactions");
  const lockPath = path.join(paths.root, "locks", "promotion-catalog.lock");
  const owner = await fs
    .readFile(path.join(lockPath, "owner.json"), "utf8")
    .then(JSON.parse)
    .catch(() => null);
  let staleLock = false;
  if (!force && Number.isSafeInteger(owner?.pid)) {
    let alive = true;
    try {
      process.kill(owner.pid, 0);
    } catch (error) {
      alive = error?.code === "EPERM";
    }
    if (alive) {
      throw new PrivatePromotionError(
        "PROMOTION_CONFLICT",
        "Existe uma promocao ativa; a recuperacao nao pode interrompe-la.",
      );
    }
    staleLock = true;
  } else if (force && owner) {
    staleLock = true;
  }
  const entries = await fs.readdir(transactionRoot, { withFileTypes: true }).catch((error) => {
    if (error?.code === "ENOENT") return [];
    throw error;
  });
  const recovered = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || !transactionIdPattern.test(entry.name)) continue;
    const transactionDirectory = path.join(transactionRoot, entry.name);
    const journalPath = path.join(transactionDirectory, "journal.json");
    const journal = await fs
      .readFile(journalPath, "utf8")
      .then(JSON.parse)
      .catch(() => null);
    if (!journal || ["committed", "rolled_back"].includes(journal.state)) continue;
    await restoreTransaction(
      projectRootReal,
      transactionDirectory,
      journal,
      "Recuperacao automatica de transacao interrompida.",
    );
    await fs.rm(lockPath, {
      recursive: true,
      force: true,
    });
    recovered.push(journal.transactionId);
  }
  if (staleLock) {
    await fs.rm(lockPath, { recursive: true, force: true });
  }
  return { recovered, releasedStaleLock: staleLock };
}

export async function rollbackPromotion({
  projectRoot = process.cwd(),
  rolledBackBy,
  transactionId,
}) {
  rolledBackBy = requireText(rolledBackBy, "rolledBackBy");
  if (!transactionIdPattern.test(transactionId)) {
    throw new PrivatePromotionError("INVALID_PROMOTION", "transactionId invalido.");
  }
  const projectRootReal = await fs.realpath(projectRoot);
  const paths = await privateCapturePaths(
    projectRootReal,
    "capture_rollback_000000001",
  );
  const transactionDirectory = path.join(paths.root, "transactions", transactionId);
  const journal = JSON.parse(
    await fs.readFile(path.join(transactionDirectory, "journal.json"), "utf8"),
  );
  if (journal.state !== "committed") {
    throw new PrivatePromotionError(
      "PROMOTION_NOT_ROLLBACKABLE",
      "A transacao nao esta comprometida para rollback.",
    );
  }
  const dossierPath = resolveInside(projectRootReal, journal.dossierRelativePath, "dossie");
  const currentDossier = parseEditorialDossier(
    JSON.parse(await fs.readFile(dossierPath, "utf8")),
  );
  const currentAsset = (currentDossier.assets ?? []).find(
    (asset) => asset.id === journal.assetId && asset.status === "valido",
  );
  if (!currentAsset) {
    throw new PrivatePromotionError(
      "PROMOTION_ROLLBACK_CONFLICT",
      "Uma versao posterior ou outra alteracao impede este rollback.",
    );
  }
  const catalogPath = resolveInside(
    projectRootReal,
    journal.catalogRelativePath,
    "catalogo",
  );
  const [currentDossierText, currentCatalogText] = await Promise.all([
    fs.readFile(dossierPath, "utf8"),
    fs.readFile(catalogPath, "utf8"),
  ]);
  if (
    sha256(currentDossierText) !== journal.nextDossierSha256 ||
    sha256(currentCatalogText) !== journal.nextCatalogSha256
  ) {
    throw new PrivatePromotionError(
      "PROMOTION_ROLLBACK_CONFLICT",
      "Dossie ou catalogo mudou depois da promocao; rollback automatico recusado.",
    );
  }
  const lockPath = await acquireLock(paths.root, transactionId);
  try {
    const restored = await restoreTransaction(
      projectRootReal,
      transactionDirectory,
      journal,
      `Rollback solicitado por ${rolledBackBy}.`,
    );
    await updateJournal(transactionDirectory, restored, {
      rolledBackAt: new Date().toISOString(),
      rolledBackBy,
    });
    return { rolledBack: true, transactionId };
  } finally {
    await fs.rm(lockPath, { recursive: true, force: true });
  }
}
