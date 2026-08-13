import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  currentCurationStatus,
  editorialVocabulary,
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

    if (
      (dossier.curation.canonicalClaims ?? []).some(
        (claim) => (claim.evidenceIds ?? []).length === 0,
      )
    ) {
      pending.push("afirmacao canonica sem evidencias relacionadas");
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

export function evidenceCoverageMatrix(dossiers) {
  const rowsByCriterion = new Map(
    editorialVocabulary.evidenceCriteria.map((criterion) => [
      criterion,
      {
        criterion,
        contextualiza: 0,
        contradiz: 0,
        evidenceCount: 0,
        sustenta: 0,
        workCount: 0,
        workIds: [],
      },
    ]),
  );

  for (const { dossier } of dossiers) {
    const criteriaForWork = new Set();

    for (const evidence of dossier.evidence ?? []) {
      const row = rowsByCriterion.get(evidence.criterion);
      if (!row) continue;

      row.evidenceCount += 1;
      row[evidence.direction] += 1;
      criteriaForWork.add(evidence.criterion);
    }

    for (const criterion of criteriaForWork) {
      const row = rowsByCriterion.get(criterion);
      row.workCount += 1;
      row.workIds.push(dossier.work.id);
    }
  }

  return {
    method: {
      counting: "Cada evidencia conta uma vez no criterio declarado.",
      percentages: false,
      workCount:
        "workCount conta obras distintas com pelo menos uma evidencia no criterio.",
      zeroRows: "Criterios sem evidencia permanecem na matriz para revelar lacunas.",
    },
    rows: Array.from(rowsByCriterion.values()),
  };
}

function markdownText(value) {
  return String(value ?? "").trim().replaceAll("|", "\\|") || "Nao informado";
}

function markdownList(items, formatter) {
  if (!Array.isArray(items) || items.length === 0) return "- Nenhum registro.";
  return items.map((item) => `- ${formatter(item)}`).join("\n");
}

function markdownTable(headers, rows) {
  const headerLine = `| ${headers.join(" | ")} |`;
  const separatorLine = `| ${headers.map(() => "---").join(" | ")} |`;
  const rowLines = rows.map(
    (row) => `| ${row.map((cell) => markdownText(cell).replace(/\n/g, " ")).join(" | ")} |`,
  );

  return [headerLine, separatorLine, ...rowLines].join("\n");
}

function sourceLabelById(dossier) {
  return new Map(
    (dossier.sources ?? []).map((source) => [
      source.id,
      `${source.title} (${source.id})`,
    ]),
  );
}

function formatEvidenceSource(sourceUse, sourceLabels) {
  const label = sourceLabels.get(sourceUse.sourceId) ?? sourceUse.sourceId;
  const locators = [];

  if (sourceUse.locator) locators.push(sourceUse.locator);
  for (const locator of sourceUse.locators ?? []) {
    const note = locator.note ? `, ${locator.note}` : "";
    locators.push(`${locator.type}: ${locator.value}${note}`);
  }

  return locators.length > 0 ? `${label} [${locators.join("; ")}]` : label;
}

function formatPublicActions(actions = {}) {
  const rows = editorialVocabulary.publicActions.map((action) => [
    action,
    actions[action] ?? "nao_informada",
  ]);

  return markdownTable(["Acao", "Permissao"], rows);
}

function decisionReviewSummary(decision) {
  if (!Array.isArray(decision.reviews) || decision.reviews.length === 0) {
    return "Nenhuma revisao";
  }

  return decision.reviews
    .map((review) => {
      const conflict = review.conflictOfInterest
        ? `sim: ${markdownText(review.conflictDescription)}`
        : "nao";
      return `${review.reviewedBy} (${review.role}, conflito: ${conflict})`;
    })
    .join("; ");
}

export function decisionRevisionDiffs(dossier) {
  const decisions = dossier.curation.decisions ?? [];
  if (decisions.length < 2) return [];

  const comparableFields = [
    ["status", (decision) => decision.status],
    ["justificativa", (decision) => decision.justification],
    ["responsavel", (decision) => decision.decidedBy],
    ["data", (decision) => decision.decidedAt],
    ["revisoes", decisionReviewSummary],
  ];

  return decisions.slice(1).map((decision, index) => {
    const previous = decisions[index];
    return {
      changes: comparableFields
        .map(([field, valueFor]) => ({
          after: markdownText(valueFor(decision)),
          before: markdownText(valueFor(previous)),
          field,
        }))
        .filter((change) => change.before !== change.after),
      from: previous.id,
      to: decision.id,
    };
  });
}

function formatDecisionRevisionDiffs(dossier) {
  const diffs = decisionRevisionDiffs(dossier);
  return markdownList(diffs, (diff) => {
    if (diff.changes.length === 0) {
      return `${diff.from} -> ${diff.to}: sem mudancas editoriais detectadas.`;
    }

    const changes = diff.changes
      .map((change) => `${change.field}: ${change.before} -> ${change.after}`)
      .join("; ");

    return `${diff.from} -> ${diff.to}: ${changes}`;
  });
}

export function formatDossierForReview({ dossier, filePath }, review = []) {
  const sourceLabels = sourceLabelById(dossier);
  const currentStatus = currentCurationStatus(dossier.curation);
  const sourceFilePath = path.isAbsolute(filePath)
    ? path.relative(process.cwd(), filePath)
    : filePath;
  const creators = (dossier.work.creators ?? [])
    .map((creator) => `${creator.name} (${creator.role})`)
    .join(", ");

  const canonicalClaims = markdownList(
    dossier.curation.canonicalClaims,
    (claim) =>
      `${claim.context}: ${claim.centrality}, alcance ${claim.reach}. ` +
      `Justificativa: ${markdownText(claim.justification)} ` +
      `Decisao: ${markdownText(claim.decisionId)}. ` +
      `Evidencias: ${markdownText((claim.evidenceIds ?? []).join(", "))}`,
  );

  const decisions = markdownList(
    dossier.curation.decisions,
    (decision) => {
      const reviews = markdownList(
        decision.reviews,
        (review) =>
          `${review.reviewedBy} (${review.role}) em ${markdownText(
            review.reviewedAt,
          )}; conflito: ${review.conflictOfInterest ? "sim" : "nao"}; ` +
          `${review.summary}`,
      ).replaceAll("\n", " ");

      return (
        `${decision.id}: ${decision.status}, por ${decision.decidedBy} em ` +
        `${markdownText(decision.decidedAt)}. ${decision.justification} ` +
        `Revisoes: ${reviews}. Hash: ${markdownText(decision.recordHash)}`
      );
    },
  );

  const sources = markdownList(
    dossier.sources,
    (source) =>
      `${source.id}: ${source.title} (${source.type}). ` +
      `Responsavel: ${markdownText(source.responsible)}. ` +
      `Identificador: ${markdownText(source.persistentId)}. ` +
      `Referencia: ${markdownText(source.reference)}. ` +
      `URL: ${markdownText(source.url)}.`,
  );

  const evidence = markdownList(
    dossier.evidence,
    (item) => {
      const evidenceSources = markdownList(item.sources, (sourceUse) =>
        formatEvidenceSource(sourceUse, sourceLabels),
      ).replaceAll("\n", " ");

      return (
        `${item.id}: ${item.criterion} / ${item.direction} / ${item.strength}. ` +
        `Afirmacao: ${item.claim}. Justificativa: ${item.justification}. ` +
        `Forca: ${item.strengthJustification}. ` +
        `Avaliado por ${item.assessedBy} em ${markdownText(item.assessedAt)}. ` +
        `Fontes: ${evidenceSources}`
      );
    },
  );

  const editions = markdownList(
    dossier.editions,
    (edition) =>
      `${edition.id}: ${edition.title} (${edition.status}). ` +
      `Tom: ${markdownText(edition.encodedKey)}. ` +
      `Cifras: ${Array.isArray(edition.chords) ? edition.chords.join(", ") : "Nao informado"}.`,
  );

  const assets = markdownList(
    dossier.assets,
    (asset) =>
      `${asset.id}: ${asset.type} / ${asset.status}. ` +
      `Caminho: ${markdownText(asset.path)}. Edicao: ${markdownText(asset.editionId)}.`,
  );

  const pending = markdownList(review, (item) => item);
  const revisionDiffs = formatDecisionRevisionDiffs(dossier);

  return `# ${dossier.work.preferredTitle}

## Identificacao

${markdownTable(
  ["Campo", "Valor"],
  [
    ["ID da obra", dossier.work.id],
    ["Arquivo-fonte", sourceFilePath],
    ["Titulo preferencial", dossier.work.preferredTitle],
    ["Titulos alternativos", (dossier.work.alternateTitles ?? []).join(", ")],
    ["Criadores", creators],
    ["Notas de identidade", dossier.work.identityNotes],
  ],
)}

## Estado Editorial

${markdownTable(
  ["Campo", "Valor"],
  [
    ["Status declarado", dossier.curation.status],
    ["Status derivado", currentStatus],
    ["Decisao vigente", dossier.curation.currentDecisionId],
  ],
)}

## Pendencias Para Revisao

${pending}

## Afirmacoes Canonicas

${canonicalClaims}

## Decisoes

${decisions}

## Diff Entre Decisoes

${revisionDiffs}

## Fontes

${sources}

## Evidencias

${evidence}

## Edicoes

${editions}

## Assets

${assets}

## Direitos

Status: ${dossier.rights.status}

${formatPublicActions(dossier.rights.actions)}
`;
}

function safeReviewFileName(dossier) {
  return `${dossier.work.id}.md`;
}

export async function writeDossierReviewFiles(
  dossiers,
  { outputDirectory, reviewReport = dossierReviewReport(dossiers) },
) {
  const reviewByFilePath = new Map(
    reviewReport.map((item) => [item.filePath, item.pending]),
  );
  await fs.mkdir(outputDirectory, { recursive: true });

  const written = [];
  for (const entry of dossiers) {
    const outputPath = path.join(outputDirectory, safeReviewFileName(entry.dossier));
    await fs.writeFile(
      outputPath,
      formatDossierForReview(entry, reviewByFilePath.get(entry.filePath) ?? []),
    );
    written.push(outputPath);
  }

  return written.sort();
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
  reviewDirectory,
  projectRoot = process.cwd(),
} = {}) {
  const dossiers = await loadEditorialDossiers(directory);
  await validateAssetChecksums(dossiers, { projectRoot });
  await validateMusicXmlAssets(dossiers, { projectRoot });
  const report = dossierReviewReport(dossiers);
  const coverage = evidenceCoverageMatrix(dossiers);

  if (report.length > 0) {
    console.log("\nPendencias dos dossies editoriais:");
    report.forEach((item) => {
      console.log(`- ${item.label}: ${item.pending.join(", ")}`);
    });
  }

  console.log("\nCobertura documental por criterio:");
  coverage.rows.forEach((row) => {
    console.log(
      `- ${row.criterion}: ${row.evidenceCount} evidencia(s), ${row.workCount} obra(s)`,
    );
  });
  console.log(
    `Metodo: ${coverage.method.counting} Nao calcula percentuais nem score.`,
  );

  if (reviewDirectory) {
    const written = await writeDossierReviewFiles(dossiers, {
      outputDirectory: reviewDirectory,
      reviewReport: report,
    });
    console.log(`Dossies para revisao exportados: ${written.length}`);
    written.forEach((filePath) => {
      console.log(`- ${path.relative(projectRoot, filePath)}`);
    });
  }

  console.log(`Dossies editoriais validados: ${dossiers.length}`);
}

function parseCliArgs(args) {
  const options = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--review-dir") {
      const directory = args[index + 1];
      if (!directory) {
        throw new Error("--review-dir requer um diretorio de saida");
      }
      options.reviewDirectory = path.resolve(directory);
      index += 1;
    } else if (arg === "--dossier-dir") {
      const directory = args[index + 1];
      if (!directory) {
        throw new Error("--dossier-dir requer um diretorio de entrada");
      }
      options.directory = path.resolve(directory);
      index += 1;
    } else {
      throw new Error(`Opcao desconhecida: ${arg}`);
    }
  }

  return options;
}

const invokedModule = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : null;

if (import.meta.url === invokedModule) {
  let options;
  try {
    options = parseCliArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }

  if (options) {
    main(options).catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
  }
}
