import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  assertMusicXmlDocument,
  metadataFromMusicXml,
} from "./musicxml-metadata.mjs";

export const PRIVATE_CAPTURE_SCHEMA_VERSION = 1;
export const PRIVATE_CAPTURE_ROOT = path.join(".local", "cancioneiro");

const captureIdPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{15,127}$/;
const editorialIdPattern = /^[a-z0-9][a-z0-9_-]{0,127}$/;
const sha256Pattern = /^[a-f0-9]{64}$/;
const provenances = new Set(["manual_file", "musescore_export"]);

export class PrivateCaptureError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PrivateCaptureError";
    this.code = code;
  }
}

export function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function canonicalizeMusicXml(xml) {
  assertMusicXmlDocument("capture.musicxml", xml);
  return `${xml
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t ]+$/gm, "")
    .replace(/>\s+</g, "><")
    .trim()}\n`;
}

function requireSafeId(value, field, pattern) {
  if (typeof value !== "string" || !pattern.test(value)) {
    throw new PrivateCaptureError("INVALID_PRIVATE_CAPTURE", `${field} invalido.`);
  }
  return value;
}

function optionalString(value, maximum = 128) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= maximum ? trimmed : null;
}

function isoInstant(value, fallback) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return fallback;
  return new Date(value).toISOString();
}

function safeMetadata(xml, supplied = {}) {
  const extracted = metadataFromMusicXml(xml, "capture.musicxml");
  return {
    chords: Array.isArray(supplied.chords)
      ? supplied.chords.filter((value) => typeof value === "string").slice(0, 256)
      : extracted.chords,
    composer: optionalString(supplied.composer, 512) ?? extracted.composer,
    instrumentation:
      optionalString(supplied.instrumentation, 512) ?? extracted.instrumentation,
    key: optionalString(supplied.key, 128) ?? extracted.key,
    partCount:
      Number.isSafeInteger(supplied.partCount) && supplied.partCount >= 0
        ? supplied.partCount
        : [...xml.matchAll(/<score-part\b/gi)].length,
    title: optionalString(supplied.title, 512) ?? extracted.title,
  };
}

async function ensurePrivateRoot(projectRoot) {
  const projectRootReal = await fs.realpath(projectRoot);
  const root = path.join(projectRootReal, PRIVATE_CAPTURE_ROOT);
  for (const candidate of [path.dirname(root), root]) {
    const stat = await fs.lstat(candidate).catch((error) => {
      if (error?.code === "ENOENT") return null;
      throw error;
    });
    if (stat?.isSymbolicLink()) {
      throw new PrivateCaptureError(
        "UNSAFE_PRIVATE_ROOT",
        "A area privada nao pode atravessar links simbolicos.",
      );
    }
  }
  await fs.mkdir(root, { recursive: true, mode: 0o700 });
  const rootReal = await fs.realpath(root);
  const relative = path.relative(projectRootReal, rootReal);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new PrivateCaptureError(
      "UNSAFE_PRIVATE_ROOT",
      "A area privada precisa permanecer dentro do projeto local.",
    );
  }

  const publicRelative = path.relative(path.join(projectRootReal, "public"), rootReal);
  if (!publicRelative.startsWith("..") && !path.isAbsolute(publicRelative)) {
    throw new PrivateCaptureError(
      "UNSAFE_PRIVATE_ROOT",
      "A area privada nao pode ficar sob public/.",
    );
  }

  return { projectRoot: projectRootReal, root: rootReal };
}

export async function privateCapturePaths(projectRoot, captureId) {
  requireSafeId(captureId, "captureId", captureIdPattern);
  const resolved = await ensurePrivateRoot(projectRoot);
  const directory = path.join(resolved.root, "captures", captureId);
  return {
    ...resolved,
    canonicalXml: path.join(directory, "canonical.musicxml"),
    directory,
    rawXml: path.join(directory, "raw.musicxml"),
    record: path.join(directory, "record.json"),
  };
}

async function readRecord(recordPath) {
  return JSON.parse(await fs.readFile(recordPath, "utf8"));
}

export async function verifyPrivateCapture({
  captureId,
  projectRoot = process.cwd(),
}) {
  const paths = await privateCapturePaths(projectRoot, captureId);
  const filePaths = [paths.rawXml, paths.canonicalXml, paths.record];
  const stats = await Promise.all(filePaths.map((filePath) => fs.lstat(filePath)));
  if (stats.some((stat) => !stat.isFile() || stat.isSymbolicLink())) {
    throw new PrivateCaptureError(
      "PRIVATE_CAPTURE_INTEGRITY",
      "A captura privada contem arquivo inseguro.",
    );
  }
  const [rawXml, canonicalXml, record] = await Promise.all([
    fs.readFile(paths.rawXml, "utf8"),
    fs.readFile(paths.canonicalXml, "utf8"),
    readRecord(paths.record),
  ]);
  if (
    record.schemaVersion !== PRIVATE_CAPTURE_SCHEMA_VERSION ||
    record.captureId !== captureId ||
    record.rawSha256 !== sha256(rawXml) ||
    record.canonicalSha256 !== sha256(canonicalXml) ||
    canonicalXml !== canonicalizeMusicXml(rawXml)
  ) {
    throw new PrivateCaptureError(
      "PRIVATE_CAPTURE_INTEGRITY",
      "Os hashes da captura privada nao conferem.",
    );
  }
  return { record, verified: true };
}

export async function listPrivateCaptures({ projectRoot = process.cwd() } = {}) {
  const resolved = await ensurePrivateRoot(projectRoot);
  const capturesRoot = path.join(resolved.root, "captures");
  const entries = await fs.readdir(capturesRoot, { withFileTypes: true }).catch((error) => {
    if (error?.code === "ENOENT") return [];
    throw error;
  });
  const captures = [];
  const issues = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.isSymbolicLink() || !captureIdPattern.test(entry.name)) {
      issues.push({ captureId: entry.name, code: "UNSAFE_PRIVATE_CAPTURE" });
      continue;
    }
    try {
      const { record } = await verifyPrivateCapture({
        captureId: entry.name,
        projectRoot: resolved.projectRoot,
      });
      captures.push({
        canonicalSha256: record.canonicalSha256,
        captureId: record.captureId,
        capturedAt: record.capturedAt,
        confirmedAt: record.confirmedAt,
        editionId: record.editionId,
        metadata: {
          composer: record.metadata.composer,
          key: record.metadata.key,
          partCount: record.metadata.partCount,
          title: record.metadata.title,
        },
        state: record.state,
        technicalOrigin: record.provenance.technicalOrigin,
        workId: record.workId,
      });
    } catch (error) {
      issues.push({
        captureId: entry.name,
        code: error instanceof PrivateCaptureError
          ? error.code
          : "PRIVATE_CAPTURE_INTEGRITY",
      });
    }
  }

  captures.sort((left, right) => right.confirmedAt.localeCompare(left.confirmedAt));
  return { captures, issues };
}

function sameConfirmation(record, candidate) {
  return (
    record.captureId === candidate.captureId &&
    record.rawSha256 === candidate.rawSha256 &&
    record.workId === candidate.workId &&
    record.editionId === candidate.editionId
  );
}

export async function createPrivateCapture({
  captureId = `capture_${randomUUID().replaceAll("-", "")}`,
  capturedAt,
  confirmedBy,
  confirmedAt = new Date().toISOString(),
  editionId,
  expectedRawSha256 = null,
  metadata = {},
  musescoreVersion = null,
  pluginVersion = null,
  projectRoot = process.cwd(),
  protocol = null,
  provenance,
  requestId = null,
  workId,
  xml,
}) {
  requireSafeId(captureId, "captureId", captureIdPattern);
  requireSafeId(workId, "workId", editorialIdPattern);
  requireSafeId(editionId, "editionId", editorialIdPattern);
  if (requestId !== null) requireSafeId(requestId, "requestId", captureIdPattern);
  if (!provenances.has(provenance)) {
    throw new PrivateCaptureError(
      "INVALID_PRIVATE_CAPTURE",
      "Proveniencia tecnica invalida.",
    );
  }
  if (typeof xml !== "string" || !xml.trim()) {
    throw new PrivateCaptureError("INVALID_PRIVATE_CAPTURE", "MusicXML ausente.");
  }
  const confirmationAuthor = optionalString(confirmedBy, 128);
  if (!confirmationAuthor) {
    throw new PrivateCaptureError(
      "INVALID_PRIVATE_CAPTURE",
      "confirmedBy e obrigatorio.",
    );
  }

  assertMusicXmlDocument("capture.musicxml", xml);
  const rawSha256 = sha256(xml);
  if (
    expectedRawSha256 !== null &&
    (!sha256Pattern.test(expectedRawSha256) || expectedRawSha256 !== rawSha256)
  ) {
    throw new PrivateCaptureError(
      "RAW_HASH_MISMATCH",
      "O hash recebido nao corresponde ao MusicXML bruto.",
    );
  }

  const canonicalXml = canonicalizeMusicXml(xml);
  const now = isoInstant(confirmedAt, new Date().toISOString());
  const record = {
    schemaVersion: PRIVATE_CAPTURE_SCHEMA_VERSION,
    captureId,
    requestId,
    capturedAt: isoInstant(capturedAt, now),
    confirmedAt: now,
    confirmedBy: confirmationAuthor,
    state: "em_revisao",
    provenance: {
      technicalOrigin: provenance,
      protocol: optionalString(protocol),
      pluginVersion: optionalString(pluginVersion, 64),
      musescoreVersion: optionalString(musescoreVersion, 64),
    },
    workId,
    editionId,
    rawSha256,
    canonicalSha256: sha256(canonicalXml),
    rawByteLength: Buffer.byteLength(xml, "utf8"),
    canonicalByteLength: Buffer.byteLength(canonicalXml, "utf8"),
    canonicalization: "musicxml-whitespace-v1",
    metadata: safeMetadata(xml, metadata),
    files: {
      raw: "raw.musicxml",
      canonical: "canonical.musicxml",
    },
  };

  const paths = await privateCapturePaths(projectRoot, captureId);
  await fs.mkdir(path.dirname(paths.directory), { recursive: true, mode: 0o700 });
  const stagingRoot = path.join(paths.root, "staging");
  const staging = path.join(stagingRoot, randomUUID());
  await fs.mkdir(staging, { recursive: true, mode: 0o700 });

  try {
    await Promise.all([
      fs.writeFile(path.join(staging, "raw.musicxml"), xml, {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      }),
      fs.writeFile(path.join(staging, "canonical.musicxml"), canonicalXml, {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      }),
      fs.writeFile(path.join(staging, "record.json"), `${JSON.stringify(record, null, 2)}\n`, {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      }),
    ]);

    try {
      await fs.rename(staging, paths.directory);
      await Promise.all(
        [paths.rawXml, paths.canonicalXml, paths.record].map((filePath) =>
          fs.chmod(filePath, 0o400),
        ),
      );
      return { created: true, record };
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !("code" in error) ||
        !["EEXIST", "ENOTEMPTY"].includes(error.code)
      ) {
        throw error;
      }

      const existing = (await verifyPrivateCapture({ captureId, projectRoot })).record;
      if (!sameConfirmation(existing, record)) {
        throw new PrivateCaptureError(
          "CAPTURE_ID_CONFLICT",
          "captureId ja existe com outro conteudo ou vinculacao.",
        );
      }
      return { created: false, record: existing };
    }
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
  }
}

export async function discardPrivateCapture({
  captureId,
  discardedAt = new Date().toISOString(),
  projectRoot = process.cwd(),
}) {
  const paths = await privateCapturePaths(projectRoot, captureId);
  const stat = await fs.lstat(paths.directory).catch((error) => {
    if (error?.code === "ENOENT") {
      throw new PrivateCaptureError("CAPTURE_NOT_FOUND", "Captura privada nao encontrada.");
    }
    throw error;
  });
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new PrivateCaptureError("UNSAFE_PRIVATE_CAPTURE", "Captura privada insegura.");
  }

  const record = await readRecord(paths.record);
  const trashId = `${captureId}--${randomUUID()}`;
  const trashRoot = path.join(paths.root, "trash");
  const destination = path.join(trashRoot, trashId);
  await fs.mkdir(trashRoot, { recursive: true, mode: 0o700 });
  await fs.rename(paths.directory, destination);
  try {
    await fs.writeFile(
      path.join(destination, "discard.json"),
      `${JSON.stringify(
        {
          schemaVersion: 1,
          captureId,
          discardedAt: isoInstant(discardedAt, new Date().toISOString()),
          recoverable: true,
          trashId,
        },
        null,
        2,
      )}\n`,
      { encoding: "utf8", flag: "wx", mode: 0o600 },
    );
  } catch (error) {
    await fs.rename(destination, paths.directory).catch(() => {});
    throw error;
  }
  return { captureId, discardedAt, recoverable: true, record, trashId };
}

export async function restorePrivateCapture({
  captureId,
  projectRoot = process.cwd(),
  trashId,
}) {
  requireSafeId(captureId, "captureId", captureIdPattern);
  if (typeof trashId !== "string" || !trashId.startsWith(`${captureId}--`)) {
    throw new PrivateCaptureError("INVALID_PRIVATE_CAPTURE", "trashId invalido.");
  }
  const paths = await privateCapturePaths(projectRoot, captureId);
  const source = path.join(paths.root, "trash", path.basename(trashId));
  if (path.basename(trashId) !== trashId) {
    throw new PrivateCaptureError("INVALID_PRIVATE_CAPTURE", "trashId invalido.");
  }
  await fs.mkdir(path.dirname(paths.directory), { recursive: true, mode: 0o700 });
  await fs.rename(source, paths.directory);
  try {
    const verified = await verifyPrivateCapture({ captureId, projectRoot });
    await fs.rm(path.join(paths.directory, "discard.json"), { force: true });
    return { captureId, record: verified.record, restored: true };
  } catch (error) {
    await fs.rename(paths.directory, source).catch(() => {});
    throw error;
  }
}
