import assert from "node:assert/strict";
import test from "node:test";
import {
  effectivePublicActions,
  legacyCatalogEntryFromDossier,
  legacyCatalogFromDossiers,
  legacyComposerFromWork,
  legacyProjectionIssues,
  publicCatalogEntryFromDossier,
} from "../lib/dossier-catalog-projection.mjs";
import { decisionRecordHash } from "../lib/editorial-dossier.mjs";

const permittedActions = {
  exibir_metadados: "permitida",
  exibir_partitura: "permitida",
  reproduzir_playback: "permitida",
  imprimir: "permitida",
  distribuir_musicxml: "permitida",
};

function acceptedDossier(overrides = {}) {
  const decision = {
    id: "decisao-aceita",
    status: "aceita",
    justification: "Obra aceita para o piloto.",
    decidedBy: "bancada-editorial",
    decidedAt: "2026-08-07",
    reviews: [
      {
        conflictOfInterest: false,
        reviewedAt: "2026-08-07",
        reviewedBy: "revisor-fixture",
        role: "membro-da-bancada",
        summary: "Revisao independente da decisao aceita.",
      },
    ],
  };

  return {
    schemaVersion: 1,
    publicCatalogId: "carinhoso",
    work: {
      id: "obra-carinhoso",
      preferredTitle: "Carinhoso",
      identityNotes: "Nota editorial da obra.",
      creators: [
        { name: "Pixinguinha", role: "composer" },
        { name: "Joao de Barro", role: "lyricist" },
      ],
    },
    curation: {
      status: "em_revisao",
      currentDecisionId: "decisao-aceita",
      decisions: [
        {
          ...decision,
          recordHash: decisionRecordHash(decision),
        },
      ],
    },
    editions: [
      {
        id: "lead-sheet",
        status: "valida",
        title: "Carinhoso",
        encodedKey: "F major",
        genre: "Choro",
        level: "Intermediario",
        instrumentation: "Melodia e cifras",
        source: "Edicao editorial piloto",
        notes: "Lead sheet revisada.",
        chords: ["F", "C7"],
        tags: ["choro", "lead sheet"],
      },
    ],
    assets: [
      {
        id: "asset-musicxml",
        editionId: "lead-sheet",
        type: "musicxml",
        status: "valido",
        path: "/musicxml/carinhoso.musicxml",
        checksum: "a".repeat(64),
        checksumAlgorithm: "sha256",
        generatedAt: "2026-08-07",
        generatedBy: "fixture",
      },
    ],
    rights: {
      status: "liberado",
      actions: permittedActions,
    },
    ...overrides,
  };
}

test("projects an accepted public MusicXML dossier to the legacy catalog shape", () => {
  const entry = legacyCatalogEntryFromDossier(acceptedDossier());

  assert.deepEqual(entry, {
    id: "carinhoso",
    title: "Carinhoso",
    composer: "Pixinguinha",
    genre: "Choro",
    key: "F major",
    level: "Intermediario",
    instrumentation: "Melodia e cifras",
    source: "Edicao editorial piloto",
    musicxml: "/musicxml/carinhoso.musicxml",
    notes: "Lead sheet revisada.",
    chords: ["F", "C7"],
    tags: ["choro", "lead sheet"],
    sourceHash: "a".repeat(64),
  });
});

test("omits accepted works without publicable MusicXML assets", () => {
  const dossier = acceptedDossier({ assets: [] });

  assert.equal(legacyCatalogEntryFromDossier(dossier), null);
  assert.deepEqual(legacyProjectionIssues(dossier), [
    "sem asset MusicXML publico valido",
  ]);
});

test("omits works when any required public action is not permitted", () => {
  const dossier = acceptedDossier({
    rights: {
      status: "em_analise",
      actions: {
        ...permittedActions,
        distribuir_musicxml: "nao_avaliada",
      },
    },
  });

  assert.equal(legacyCatalogEntryFromDossier(dossier), null);
  assert.deepEqual(legacyProjectionIssues(dossier), [
    "direito publico bloqueado: distribuir_musicxml",
  ]);
});

test("omits works whose current curation decision is not accepted", () => {
  const dossier = acceptedDossier({
    curation: {
      status: "candidata",
    },
  });

  assert.equal(legacyCatalogEntryFromDossier(dossier), null);
  assert.deepEqual(legacyProjectionIssues(dossier), ["curadoria nao aceita"]);
});

test("produces a deterministic parseable legacy catalog", () => {
  const catalog = legacyCatalogFromDossiers([
    acceptedDossier({
      publicCatalogId: "z",
      work: {
        ...acceptedDossier().work,
        id: "obra-z",
        preferredTitle: "Zabumba",
      },
      editions: [
        {
          ...acceptedDossier().editions[0],
          title: "Zabumba",
        },
      ],
      assets: [
        {
          id: "asset-z",
          editionId: "lead-sheet",
          type: "musicxml",
          status: "valido",
          path: "/musicxml/zabumba.musicxml",
          checksum: "b".repeat(64),
          checksumAlgorithm: "sha256",
          generatedAt: "2026-08-07",
          generatedBy: "fixture",
        },
      ],
    }),
    acceptedDossier(),
  ]);

  assert.deepEqual(
    catalog.songs.map((song) => song.title),
    ["Carinhoso", "Zabumba"],
  );
});

test("falls back to attributed or unknown creators for legacy composer", () => {
  assert.equal(
    legacyComposerFromWork({
      creators: [{ name: "Autor atribuido", role: "attributed" }],
    }),
    "Autor atribuido",
  );
  assert.equal(
    legacyComposerFromWork({
      creators: [{ name: "Autoria desconhecida", role: "unknown" }],
    }),
    "Autoria desconhecida",
  );
});

test("publishes metadata while omitting a blocked score URL", () => {
  const dossier = acceptedDossier({
    rights: {
      status: "em_analise",
      actions: {
        ...permittedActions,
        exibir_partitura: "bloqueada",
        reproduzir_playback: "bloqueada",
        imprimir: "bloqueada",
        distribuir_musicxml: "bloqueada",
      },
    },
  });

  const entry = publicCatalogEntryFromDossier(dossier);
  assert.equal(entry.title, "Carinhoso");
  assert.equal(entry.musicxml, undefined);
  assert.equal(entry.availability.status, "bloqueada");
  assert.deepEqual(entry.availability.actions, {
    exibir_partitura: false,
    reproduzir_playback: false,
    imprimir: false,
    distribuir_musicxml: false,
    baixar_pdf: false,
  });
});

test("fails closed when a rights action is omitted", () => {
  const dossier = acceptedDossier({
    rights: {
      status: "em_analise",
      actions: {
        exibir_metadados: "permitida",
        exibir_partitura: "permitida",
        reproduzir_playback: "permitida",
        imprimir: "permitida",
      },
    },
  });

  assert.deepEqual(effectivePublicActions(dossier), {
    exibir_partitura: false,
    reproduzir_playback: false,
    imprimir: false,
    distribuir_musicxml: false,
    baixar_pdf: false,
  });
});
