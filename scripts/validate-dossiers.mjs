import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  currentCurationStatus,
  effectivePermission,
  parseEditorialDossier,
} from "../lib/editorial-dossier.mjs";
import {
  assertMusicXmlDocument,
  chordsFromMusicXml,
  keyFromMusicXml,
  metadataFromMusicXml,
} from "../lib/musicxml-metadata.mjs";

export const defaultDossierDirectory = path.join(
  process.cwd(),
  "data",
  "dossiers",
);

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

export async function listDossierFiles(directory = defaultDossierDirectory) {
  if (!(await pathExists(directory))) {
    return [];
  }

  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return listDossierFiles(entryPath);
      }

      if (entry.isFile() && entry.name.endsWith(".json")) {
        return [entryPath];
      }

      return [];
    }),
  );

  return files.flat().sort();
}

export async function loadEditorialDossiers(
  directory = defaultDossierDirectory,
) {
  const files = await listDossierFiles(directory);
  const dossiers = [];
  const issues = [];
  const workIds = new Map();

  for (const filePath of files) {
    try {
      const dossier = parseEditorialDossier(
        JSON.parse(await fs.readFile(filePath, "utf8")),
      );
      dossiers.push({ dossier, filePath });

      const existingPath = workIds.get(dossier.work.id);
      if (existingPath) {
        issues.push(
          `${path.relative(directory, filePath)} duplica work.id ${dossier.work.id} de ${path.relative(directory, existingPath)}`,
        );
      } else {
        workIds.set(dossier.work.id, filePath);
      }
    } catch (error) {
      const relativePath = path.relative(directory, filePath);
      issues.push(
        `${relativePath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (issues.length > 0) {
    throw new Error(`Dossies editoriais invalidos:\n- ${issues.join("\n- ")}`);
  }

  return dossiers;
}

export function dossierReviewReport(dossiers) {
  return dossiers.flatMap(({ dossier, filePath }) => {
    const pending = [];
    const label = `${dossier.work.id} (${dossier.work.preferredTitle})`;

    if (!dossier.curation.currentDecisionId) {
      pending.push("sem decisao vigente");
    }

    if (currentCurationStatus(dossier.curation) !== dossier.curation.status) {
      pending.push(
        `status derivado da decisao vigente: ${currentCurationStatus(dossier.curation)}`,
      );
    }

    if (effectivePermission(dossier.rights, "exibir_metadados") !== "permitida") {
      pending.push("metadados publicos nao permitidos");
    }

    if ((dossier.curation.canonicalClaims ?? []).some((claim) => !claim.decisionId)) {
      pending.push("afirmacao canonica sem decisionId");
    }

    if ((dossier.sources ?? []).length === 0) {
      pending.push("sem fontes estruturadas");
    }

    if ((dossier.evidence ?? []).length === 0) {
      pending.push("sem evidencias estruturadas");
    }

    (dossier.evidence ?? []).forEach((evidence) => {
      if ((evidence.sources ?? []).length === 0) {
        pending.push(`evidencia sem fonte: ${evidence.id}`);
      }
    });

    const directionsByCriterion = new Map();
    (dossier.evidence ?? []).forEach((evidence) => {
      if (!directionsByCriterion.has(evidence.criterion)) {
        directionsByCriterion.set(evidence.criterion, new Set());
      }
      directionsByCriterion.get(evidence.criterion).add(evidence.direction);
    });

    directionsByCriterion.forEach((directions, criterion) => {
      if (directions.has("sustenta") && directions.has("contradiz")) {
        pending.push(`evidencias contraditorias: ${criterion}`);
      }
    });

    return pending.length > 0
      ? [
          {
            filePath,
            label,
            pending,
          },
        ]
      : [];
  });
}

function filePathFromPublicAssetPath(projectRoot, publicPath) {
  return path.join(projectRoot, "public", ...publicPath.split("/").filter(Boolean));
}

function normalizeMetadataValue(value) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

function editionForAsset(dossier, asset) {
  if (!asset.editionId) return undefined;
  return (dossier.editions ?? []).find((edition) => edition.id === asset.editionId);
}

export async function validateAssetChecksums(
  dossiers,
  { projectRoot = process.cwd() } = {},
) {
  const issues = [];

  for (const { dossier, filePath } of dossiers) {
    for (const asset of dossier.assets ?? []) {
      if (
        asset.checksumAlgorithm !== "sha256" ||
        typeof asset.checksum !== "string" ||
        typeof asset.path !== "string" ||
        !asset.path.startsWith("/musicxml/")
      ) {
        continue;
      }

      const assetPath = filePathFromPublicAssetPath(projectRoot, asset.path);
      try {
        const actualChecksum = sha256(await fs.readFile(assetPath));
        if (actualChecksum !== asset.checksum) {
          issues.push(`${filePath}: ${asset.id} checksum divergente`);
        }
      } catch (error) {
        if (error.code === "ENOENT") {
          issues.push(`${filePath}: ${asset.id} nao encontrado em ${asset.path}`);
          continue;
        }
        throw error;
      }
    }
  }

  if (issues.length > 0) {
    throw new Error(`Assets editoriais invalidos:\n- ${issues.join("\n- ")}`);
  }
}

export async function validateMusicXmlAssets(
  dossiers,
  { projectRoot = process.cwd() } = {},
) {
  const issues = [];

  for (const { dossier, filePath } of dossiers) {
    for (const asset of dossier.assets ?? []) {
      if (asset.type !== "musicxml" || typeof asset.path !== "string") {
        continue;
      }

      const assetPath = filePathFromPublicAssetPath(projectRoot, asset.path);
      let xml;
      try {
        xml = await fs.readFile(assetPath, "utf8");
        assertMusicXmlDocument(asset.path, xml);
      } catch (error) {
        issues.push(
          `${filePath}: ${asset.id} MusicXML invalido: ${error instanceof Error ? error.message : String(error)}`,
        );
        continue;
      }

      const edition = editionForAsset(dossier, asset);
      if (!edition) continue;

      const metadata = metadataFromMusicXml(xml, path.basename(asset.path));
      const expectedTitle = edition.title ?? dossier.work.preferredTitle;
      if (
        expectedTitle &&
        normalizeMetadataValue(metadata.title) !== normalizeMetadataValue(expectedTitle)
      ) {
        issues.push(`${filePath}: ${asset.id} titulo MusicXML difere da edicao`);
      }

      if (edition.encodedKey && keyFromMusicXml(xml) !== edition.encodedKey) {
        issues.push(`${filePath}: ${asset.id} tonalidade MusicXML difere da edicao`);
      }

      if (Array.isArray(edition.chords) && edition.chords.length > 0) {
        if (chordsFromMusicXml(xml).length === 0) {
          issues.push(
            `${filePath}: ${asset.id} edicao declara cifras mas MusicXML nao contem <harmony>`,
          );
        }
      }
    }
  }

  if (issues.length > 0) {
    throw new Error(`Assets MusicXML invalidos:\n- ${issues.join("\n- ")}`);
  }
}

export async function main({
  directory = defaultDossierDirectory,
  projectRoot = process.cwd(),
} = {}) {
  const dossiers = await loadEditorialDossiers(directory);
  await validateAssetChecksums(dossiers, { projectRoot });
  await validateMusicXmlAssets(dossiers, { projectRoot });
  const report = dossierReviewReport(dossiers);

  if (report.length > 0) {
    console.log("\nPendencias dos dossies editoriais:");
    report.forEach((item) => {
      console.log(`- ${item.label}: ${item.pending.join(", ")}`);
    });
  }

  console.log(`Dossies editoriais validados: ${dossiers.length}`);
}

const invokedModule = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : null;

if (import.meta.url === invokedModule) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
