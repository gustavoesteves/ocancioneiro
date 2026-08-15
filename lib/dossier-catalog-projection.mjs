import {
  PUBLIC_CATALOG_SCHEMA_VERSION,
  parseCatalog,
} from "./catalog.mjs";
import {
  currentCurationStatus,
  effectivePermission,
  parseEditorialDossier,
} from "./editorial-dossier.mjs";

const deliveryActions = [
  "exibir_partitura",
  "reproduzir_playback",
  "imprimir",
  "distribuir_musicxml",
];

const publicActions = [
  ...deliveryActions,
  "baixar_pdf",
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

function firstCurrentMusicXmlAsset(dossier) {
  return (dossier.assets ?? []).find(
    (asset) =>
      asset.type === "musicxml" &&
      asset.status === "valido" &&
      isPublicMusicXmlPath(asset.path),
  );
}

function editionForAsset(dossier, asset) {
  if (!asset?.editionId) return undefined;
  return (dossier.editions ?? []).find((edition) => edition.id === asset.editionId);
}

function preferredEdition(dossier) {
  const currentAsset = firstCurrentMusicXmlAsset(dossier);
  return (
    editionForAsset(dossier, currentAsset) ??
    (dossier.editions ?? []).find((edition) => edition.status === "valida") ??
    dossier.editions?.[0]
  );
}

function permissionIsAllowed(dossier, action) {
  return effectivePermission(dossier.rights, action) === "permitida";
}

export function effectivePublicActions(dossier) {
  const parsed = parseEditorialDossier(dossier);
  const asset = firstCurrentMusicXmlAsset(parsed);
  const edition = editionForAsset(parsed, asset);
  const hasPublicableEdition = edition?.status === "valida";
  const canDeliverMusicXml = Boolean(asset && hasPublicableEdition);
  const actions = Object.fromEntries(
    publicActions.map((action) => [action, false]),
  );

  if (!canDeliverMusicXml) return actions;

  deliveryActions.forEach((action) => {
    actions[action] = permissionIsAllowed(parsed, action);
  });

  // In a static site, showing, playing or printing the score necessarily sends
  // the MusicXML to the browser. These actions cannot be presented as allowed
  // while distribution of that same file is blocked.
  if (!actions.distribuir_musicxml) {
    actions.exibir_partitura = false;
    actions.reproduzir_playback = false;
    actions.imprimir = false;
  }

  // Printing is inseparable from an already rendered score in the browser.
  if (!actions.exibir_partitura) {
    actions.imprimir = false;
    // Playback currently lives in the score viewer. Until a separate audio
    // delivery exists, it cannot be offered without rendering the score.
    actions.reproduzir_playback = false;
  }

  // No public PDF asset is modelled by this catalog version yet.
  actions.baixar_pdf = false;

  return actions;
}

function publicAvailability(dossier, asset, edition, actions) {
  if (!edition) {
    return {
      status: "sem_edicao",
      reason: "Partitura ainda nao disponivel nesta edicao do Cancioneiro.",
      actions,
    };
  }

  if (edition.status !== "valida") {
    return {
      status: "em_revisao",
      reason: "Partitura em revisao editorial.",
      actions,
    };
  }

  if (!asset || !Object.values(actions).some(Boolean)) {
    return {
      status: "bloqueada",
      reason: "Partitura indisponivel para acesso publico neste momento.",
      actions,
    };
  }

  return {
    status: "disponivel",
    reason: actions.exibir_partitura
      ? "Partitura disponivel conforme as permissoes editoriais vigentes."
      : "MusicXML disponivel para download; visualizacao da partitura indisponivel.",
    actions,
  };
}

export function publicProjectionIssues(dossier) {
  const parsed = parseEditorialDossier(dossier);
  const issues = [];

  if (effectivePermission(parsed.rights, "exibir_metadados") !== "permitida") {
    issues.push("direito publico bloqueado: exibir_metadados");
    return issues;
  }

  const actions = effectivePublicActions(parsed);
  const asset = firstCurrentMusicXmlAsset(parsed);
  const edition = preferredEdition(parsed);

  if (currentCurationStatus(parsed.curation) !== "aceita") {
    issues.push("curadoria nao aceita");
  }
  if (!edition) {
    issues.push("sem edicao musical");
  } else if (edition.status !== "valida") {
    issues.push("edicao nao valida");
  }
  if (!asset) {
    issues.push("sem asset MusicXML publico valido");
  }
  deliveryActions.forEach((action) => {
    if (!actions[action]) {
      issues.push(`acao publica indisponivel: ${action}`);
    }
  });

  return issues;
}

export function legacyProjectionIssues(dossier) {
  const parsed = parseEditorialDossier(dossier);
  const issues = [];

  if (currentCurationStatus(parsed.curation) !== "aceita") {
    issues.push("curadoria nao aceita");
  }

  if (effectivePermission(parsed.rights, "exibir_metadados") !== "permitida") {
    issues.push("direito publico bloqueado: exibir_metadados");
  }

  for (const action of deliveryActions) {
    if (effectivePermission(parsed.rights, action) !== "permitida") {
      issues.push(`direito publico bloqueado: ${action}`);
    }
  }

  const asset = firstCurrentMusicXmlAsset(parsed);
  if (!asset || editionForAsset(parsed, asset)?.status !== "valida") {
    issues.push("sem asset MusicXML publico valido");
  }

  return issues;
}

export function publicCatalogEntryFromDossier(dossier) {
  const parsed = parseEditorialDossier(dossier);
  if (
    currentCurationStatus(parsed.curation) !== "aceita" ||
    effectivePermission(parsed.rights, "exibir_metadados") !== "permitida"
  ) {
    return null;
  }

  const asset = firstCurrentMusicXmlAsset(parsed);
  const edition = preferredEdition(parsed);
  const actions = effectivePublicActions(parsed);
  const availability = publicAvailability(parsed, asset, edition, actions);
  const entry = {
    id: edition?.publicCatalogId ?? parsed.publicCatalogId ?? parsed.work.id,
    title: edition?.title ?? parsed.work.preferredTitle,
    composer: legacyComposerFromWork(parsed.work),
    genre: edition?.genre ?? defaultLegacyFields.genre,
    key: edition?.encodedKey ?? defaultLegacyFields.key,
    level: edition?.level ?? defaultLegacyFields.level,
    instrumentation:
      edition?.instrumentation ?? defaultLegacyFields.instrumentation,
    source: edition?.source ?? defaultLegacyFields.source,
    notes:
      edition?.notes ?? parsed.work.identityNotes ?? defaultLegacyFields.notes,
    chords: Array.isArray(edition?.chords)
      ? edition.chords
      : defaultLegacyFields.chords,
    tags: Array.isArray(edition?.tags) ? edition.tags : defaultLegacyFields.tags,
    availability,
  };

  if (availability.actions.distribuir_musicxml && asset) {
    entry.musicxml = asset.path;
    if (isValidSha256(asset.checksum)) {
      entry.sourceHash = asset.checksum;
    }
  }

  return entry;
}

export function legacyCatalogEntryFromDossier(dossier) {
  const entry = publicCatalogEntryFromDossier(dossier);
  if (!entry || legacyProjectionIssues(dossier).length > 0) return null;

  const legacyEntry = { ...entry };
  delete legacyEntry.availability;
  return legacyEntry;
}

export function publicCatalogFromDossiers(dossiers) {
  const songs = dossiers
    .map((dossier) => publicCatalogEntryFromDossier(dossier))
    .filter((entry) => entry !== null)
    .sort((left, right) =>
      left.title.localeCompare(right.title, "pt-BR", { sensitivity: "base" }),
    );

  return parseCatalog({ schemaVersion: PUBLIC_CATALOG_SCHEMA_VERSION, songs });
}

export function legacyCatalogFromDossiers(dossiers) {
  const songs = dossiers
    .map((dossier) => legacyCatalogEntryFromDossier(dossier))
    .filter((entry) => entry !== null)
    .sort((left, right) =>
      left.title.localeCompare(right.title, "pt-BR", { sensitivity: "base" }),
    );

  return parseCatalog({ songs }, { allowLegacy: true });
}
