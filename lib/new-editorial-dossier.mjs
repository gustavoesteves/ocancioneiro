import { promises as fs } from "node:fs";
import path from "node:path";
import { parseEditorialDossier } from "./editorial-dossier.mjs";
import { slugify } from "./musicxml-metadata.mjs";

function creatorFromComposer(composer) {
  const name = typeof composer === "string" ? composer.trim() : "";
  if (!name || slugify(name) === "nao-informado") {
    return { name: "Autoria nao informada", role: "unknown" };
  }
  return { name, role: "composer" };
}

export function buildCandidateEditorialDossier({ composer, title, workId }) {
  if (!/^obra-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(workId)) {
    throw new Error("workId invalido para novo dossie editorial");
  }

  return parseEditorialDossier({
    schemaVersion: 1,
    work: {
      creators: [creatorFromComposer(composer)],
      id: workId,
      identityNotes:
        "Dossie candidato criado por uma captura local; identidade, fontes e curadoria precisam de revisao humana.",
      preferredTitle: title,
    },
    curation: { status: "candidata" },
    sources: [],
    evidence: [],
    editions: [],
    assets: [],
    rights: {
      actions: {
        baixar_pdf: "nao_avaliada",
        distribuir_musicxml: "nao_avaliada",
        exibir_metadados: "permitida",
        exibir_partitura: "nao_avaliada",
        imprimir: "nao_avaliada",
        reproduzir_playback: "nao_avaliada",
      },
      status: "nao_verificado",
    },
  });
}

export async function reserveCandidateEditorialDossier({
  dossier,
  dossierDirectory,
}) {
  const parsed = parseEditorialDossier(dossier);
  await fs.mkdir(dossierDirectory, { recursive: true });
  const filePath = path.join(dossierDirectory, `${parsed.work.id}.json`);
  const temporaryPath = path.join(
    dossierDirectory,
    `.${parsed.work.id}.${process.pid}.${Date.now()}.tmp`,
  );

  try {
    await fs.writeFile(
      temporaryPath,
      `${JSON.stringify(parsed, null, 2)}\n`,
      { encoding: "utf8", flag: "wx" },
    );
    await fs.link(temporaryPath, filePath);
  } finally {
    await fs.rm(temporaryPath, { force: true });
  }

  return { dossier: parsed, filePath };
}
