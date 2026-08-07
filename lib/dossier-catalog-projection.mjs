import { parseCatalog } from "./catalog.mjs";
import {
  currentCurationStatus,
  effectivePermission,
  parseEditorialDossier,
} from "./editorial-dossier.mjs";

const requiredPublicActions = [
  "exibir_metadados",
  "exibir_partitura",
  "reproduzir_playback",
  "imprimir",
  "distribuir_musicxml",
];

const defaultLegacyFields = {
  genre: "Nao classificado",
  key: "Nao informado",
  level: "Nao classificado",
  instrumentation: "Lead sheet",
  notes: "",
  source: "Dossie editorial",
  tags: [],
  chords: [],
};

function isValidSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isPublicMusicXmlPath(path) {
  return typeof path === "string" && path.startsWith("/musicxml/");
}

function creatorsByRole(work, roles) {
  return (work.creators ?? [])
    .filter((creator) => roles.includes(creator.role))
    .map((creator) => creator.name);
}

export function legacyComposerFromWork(work) {
  const composers = creatorsByRole(work, ["composer"]);
  if (composers.length > 0) return composers.join(", ");

  const attributed = creatorsByRole(work, ["attributed"]);
  if (attributed.length > 0) return attributed.join(", ");

  const unknown = creatorsByRole(work, ["unknown"]);
  if (unknown.length > 0) return unknown.join(", ");

  return "Nao informado";
}

function firstPublicableMusicXmlAsset(dossier) {
  return (dossier.assets ?? []).find(
    (asset) =>
      asset.type === "musicxml" &&
      asset.status === "valido" &&
      isPublicMusicXmlPath(asset.path),
  );
}

function editionForAsset(dossier, asset) {
  if (!asset.editionId) return undefined;
  return (dossier.editions ?? []).find((edition) => edition.id === asset.editionId);
}

export function legacyProjectionIssues(dossier) {
  const parsed = parseEditorialDossier(dossier);
  const issues = [];

  if (currentCurationStatus(parsed.curation) !== "aceita") {
    issues.push("curadoria nao aceita");
  }

  for (const action of requiredPublicActions) {
    if (effectivePermission(parsed.rights, action) !== "permitida") {
      issues.push(`direito publico bloqueado: ${action}`);
    }
  }

  if (!firstPublicableMusicXmlAsset(parsed)) {
    issues.push("sem asset MusicXML publico valido");
  }

  return issues;
}

export function legacyCatalogEntryFromDossier(dossier) {
  const parsed = parseEditorialDossier(dossier);
  if (legacyProjectionIssues(parsed).length > 0) return null;

  const asset = firstPublicableMusicXmlAsset(parsed);
  const edition = editionForAsset(parsed, asset) ?? {};
  const entry = {
    id: edition.publicCatalogId ?? parsed.publicCatalogId ?? parsed.work.id,
    title: edition.title ?? parsed.work.preferredTitle,
    composer: legacyComposerFromWork(parsed.work),
    genre: edition.genre ?? defaultLegacyFields.genre,
    key: edition.encodedKey ?? defaultLegacyFields.key,
    level: edition.level ?? defaultLegacyFields.level,
    instrumentation: edition.instrumentation ?? defaultLegacyFields.instrumentation,
    source: edition.source ?? defaultLegacyFields.source,
    musicxml: asset.path,
    notes: edition.notes ?? parsed.work.identityNotes ?? defaultLegacyFields.notes,
    chords: Array.isArray(edition.chords)
      ? edition.chords
      : defaultLegacyFields.chords,
    tags: Array.isArray(edition.tags) ? edition.tags : defaultLegacyFields.tags,
  };

  if (isValidSha256(asset.checksum)) {
    entry.sourceHash = asset.checksum;
  }

  return entry;
}

export function legacyCatalogFromDossiers(dossiers) {
  const songs = dossiers
    .map((dossier) => legacyCatalogEntryFromDossier(dossier))
    .filter((entry) => entry !== null)
    .sort((left, right) =>
      left.title.localeCompare(right.title, "pt-BR", { sensitivity: "base" }),
    );

  return parseCatalog({ songs });
}
