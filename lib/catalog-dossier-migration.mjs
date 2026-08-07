import { parseCatalog } from "./catalog.mjs";
import { parseEditorialDossier } from "./editorial-dossier.mjs";

const defaultMigrationDate = "2026-08-07";

const publicActions = {
  exibir_metadados: "permitida",
  exibir_partitura: "permitida",
  reproduzir_playback: "permitida",
  imprimir: "permitida",
  distribuir_musicxml: "permitida",
};

function workIdFromSongId(id) {
  return id.startsWith("obra-") ? id : `obra-${id}`;
}

function creatorFromComposer(composer) {
  const name = composer.trim();
  if (!name || name === "Nao informado") {
    return { name: "Autoria nao informada", role: "unknown" };
  }

  return { name, role: "composer" };
}

function migrationDecision(migratedAt) {
  return {
    decidedAt: migratedAt,
    decidedBy: "migracao-catalogo-legado",
    id: "decisao-migracao-legado",
    justification:
      "Entrada ja publicada no catalogo legado; aceita tecnicamente para preservar equivalencia durante a migracao.",
    status: "aceita",
  };
}

function legacySource(song) {
  if (!song.source.trim()) return [];

  return [
    {
      id: "fonte-legada",
      reference: song.source,
      title: song.source,
      type: "catalogo_ou_acervo",
    },
  ];
}

function reviewPending(song) {
  const pending = [
    "curadoria canonica precisa de revisao humana",
    "direitos herdados da publicacao legada precisam de confirmacao",
  ];

  if (song.source.trim()) {
    pending.push("fonte legada precisa de estruturacao");
  } else {
    pending.push("fonte legada ausente");
  }

  if (song.notes.trim()) {
    pending.push("nota legada precisa de classificacao editorial");
  }

  if (!song.sourceHash) {
    pending.push("asset sem sourceHash legado");
  }

  return pending;
}

export function migrateSongToDossier(
  song,
  { migratedAt = defaultMigrationDate } = {},
) {
  const parsed = parseCatalog({ songs: [song] }).songs[0];
  const asset = {
    editionId: "edicao-legada",
    generatedAt: migratedAt,
    generatedBy: "migracao-catalogo-legado",
    id: "asset-musicxml-legado",
    path: parsed.musicxml,
    status: parsed.sourceHash ? "valido" : "pendente",
    type: "musicxml",
  };
  if (parsed.sourceHash) {
    asset.checksum = parsed.sourceHash;
    asset.checksumAlgorithm = "sha256";
  }

  const dossier = {
    schemaVersion: 1,
    publicCatalogId: parsed.id,
    work: {
      creators: [creatorFromComposer(parsed.composer)],
      id: workIdFromSongId(parsed.id),
      preferredTitle: parsed.title,
    },
    curation: {
      currentDecisionId: "decisao-migracao-legado",
      decisions: [migrationDecision(migratedAt)],
      status: "em_revisao",
    },
    editions: [
      {
        chords: parsed.chords,
        encodedKey: parsed.key,
        genre: parsed.genre,
        id: "edicao-legada",
        instrumentation: parsed.instrumentation,
        level: parsed.level,
        notes: parsed.notes,
        publicCatalogId: parsed.id,
        source: parsed.source,
        status: "valida",
        tags: parsed.tags,
        title: parsed.title,
      },
    ],
    assets: [asset],
    rights: {
      actions: publicActions,
      status: "liberado",
    },
    sources: legacySource(parsed),
    migration: {
      from: "public/catalog.json",
      migratedAt,
      pending: reviewPending(parsed),
    },
  };

  return parseEditorialDossier(dossier);
}

export function migrateCatalogToDossiers(
  catalog,
  { migratedAt = defaultMigrationDate } = {},
) {
  const parsed = parseCatalog(catalog);
  const dossiers = parsed.songs.map((song) =>
    migrateSongToDossier(song, { migratedAt }),
  );

  return {
    dossiers,
    report: dossiers.map((dossier) => ({
      id: dossier.publicCatalogId,
      pending: dossier.migration.pending,
      title: dossier.work.preferredTitle,
    })),
  };
}
