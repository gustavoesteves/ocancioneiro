import { createHash } from "node:crypto";
import { parseEditorialDossier } from "./editorial-dossier.mjs";

const editableFields = ["genre", "level", "notes", "source", "tags"];

export class EditionMetadataError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "EditionMetadataError";
    this.code = code;
  }
}

export function editionFileFingerprint(contents) {
  return createHash("sha256").update(contents, "utf8").digest("hex");
}

function requiredText(value, field, maximum) {
  if (typeof value !== "string" || !value.trim()) {
    throw new EditionMetadataError(
      "INVALID_EDITION_METADATA",
      `${field} e obrigatorio.`,
    );
  }
  const normalized = value.trim();
  if (normalized.length > maximum) {
    throw new EditionMetadataError(
      "INVALID_EDITION_METADATA",
      `${field} excede ${maximum} caracteres.`,
    );
  }
  return normalized;
}

function notesText(value) {
  if (typeof value !== "string") {
    throw new EditionMetadataError(
      "INVALID_EDITION_METADATA",
      "notes deve ser texto.",
    );
  }
  if (value.length > 5_000) {
    throw new EditionMetadataError(
      "INVALID_EDITION_METADATA",
      "notes excede 5000 caracteres.",
    );
  }
  return value.trim();
}

function tagsValue(value) {
  if (!Array.isArray(value)) {
    throw new EditionMetadataError(
      "INVALID_EDITION_METADATA",
      "tags deve ser uma lista.",
    );
  }
  if (value.length > 50) {
    throw new EditionMetadataError(
      "INVALID_EDITION_METADATA",
      "tags aceita no maximo 50 itens.",
    );
  }
  const seen = new Set();
  const tags = [];
  for (const item of value) {
    if (typeof item !== "string" || !item.trim() || item.trim().length > 64) {
      throw new EditionMetadataError(
        "INVALID_EDITION_METADATA",
        "Cada tag deve ter entre 1 e 64 caracteres.",
      );
    }
    const tag = item.trim();
    const key = tag.toLocaleLowerCase("pt-BR");
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  return tags;
}

export function editableEdition(edition) {
  return {
    genre: edition.genre ?? "",
    id: edition.id,
    level: edition.level ?? "",
    notes: edition.notes ?? "",
    source: edition.source ?? "",
    status: edition.status,
    tags: Array.isArray(edition.tags) ? edition.tags : [],
    title: edition.title ?? edition.id,
  };
}

export function updateEditionMetadata(
  dossier,
  { editionId, genre, level, notes, source, tags },
) {
  const parsed = parseEditorialDossier(dossier);
  if (typeof editionId !== "string" || !editionId.trim()) {
    throw new EditionMetadataError(
      "INVALID_EDITION_METADATA",
      "editionId e obrigatorio.",
    );
  }
  const existing = (parsed.editions ?? []).find(
    (edition) => edition.id === editionId.trim(),
  );
  if (!existing) {
    throw new EditionMetadataError(
      "EDITION_NOT_FOUND",
      "Edicao editorial nao encontrada.",
    );
  }

  const metadata = {
    genre: requiredText(genre, "genre", 128),
    level: requiredText(level, "level", 128),
    notes: notesText(notes),
    source: requiredText(source, "source", 512),
    tags: tagsValue(tags),
  };
  const changed = editableFields.some(
    (field) => JSON.stringify(editableEdition(existing)[field]) !== JSON.stringify(metadata[field]),
  );
  if (!changed) {
    return { changed: false, dossier: parsed, edition: editableEdition(existing) };
  }

  const nextDossier = parseEditorialDossier({
    ...parsed,
    editions: parsed.editions.map((edition) =>
      edition.id === existing.id ? { ...edition, ...metadata } : edition,
    ),
  });
  const nextEdition = nextDossier.editions.find(
    (edition) => edition.id === existing.id,
  );
  return {
    changed: true,
    dossier: nextDossier,
    edition: editableEdition(nextEdition),
  };
}
