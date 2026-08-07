import assert from "node:assert/strict";
import test from "node:test";
import {
  EditorialDossierValidationError,
  currentCurationStatus,
  effectivePermission,
  parseEditorialDossier,
} from "../lib/editorial-dossier.mjs";

function minimalDossier(overrides = {}) {
  return {
    schemaVersion: 1,
    work: {
      creators: [{ name: "Pixinguinha", role: "composer" }],
      id: "obra-carinhoso",
      preferredTitle: "Carinhoso",
    },
    curation: {
      canonicalClaims: [
        {
          centrality: "nuclear",
          context: "choro",
          justification: "Ausencia dificil de justificar no repertorio de choro.",
          reach: "comunidade",
        },
      ],
      status: "candidata",
    },
    rights: {
      actions: {
        exibir_metadados: "permitida",
        distribuir_musicxml: "nao_avaliada",
      },
      status: "nao_verificado",
    },
    ...overrides,
  };
}

test("accepts a work dossier without edition or MusicXML asset", () => {
  const dossier = minimalDossier();

  assert.equal(parseEditorialDossier(dossier).work.id, "obra-carinhoso");
  assert.equal(
    effectivePermission(dossier.rights, "distribuir_musicxml"),
    "bloqueada",
  );
});

test("rejects unknown controlled vocabulary values", () => {
  assert.throws(
    () =>
      parseEditorialDossier(
        minimalDossier({
          curation: { status: "publicada" },
        }),
      ),
    /curation.status possui valor invalido/,
  );
});

test("rejects unknown creator roles", () => {
  assert.throws(
    () =>
      parseEditorialDossier(
        minimalDossier({
          work: {
            creators: [{ name: "Pixinguinha", role: "genius" }],
            id: "obra-carinhoso",
            preferredTitle: "Carinhoso",
          },
        }),
      ),
    /work\.creators\[0\]\.role possui valor invalido/,
  );
});

test("derives curation status from the current decision", () => {
  const dossier = parseEditorialDossier(
    minimalDossier({
      curation: {
        currentDecisionId: "decisao-001",
        decisions: [
          {
            decidedAt: "2026-08-07",
            decidedBy: "bancada-editorial",
            id: "decisao-001",
            justification: "Fixture de decisao vigente.",
            status: "aceita",
          },
        ],
        status: "em_revisao",
      },
    }),
  );

  assert.equal(currentCurationStatus(dossier.curation), "aceita");
});

test("rejects a current decision id without matching decision", () => {
  assert.throws(
    () =>
      parseEditorialDossier(
        minimalDossier({
          curation: {
            currentDecisionId: "decisao-ausente",
            decisions: [],
            status: "em_revisao",
          },
        }),
      ),
    /curation\.currentDecisionId referencia decisao inexistente/,
  );
});

test("rejects dossiers without schema version", () => {
  const dossier = minimalDossier();
  delete dossier.schemaVersion;

  assert.throws(
    () => parseEditorialDossier(dossier),
    /schemaVersion deve ser 1/,
  );
});

test("requires evidence sources to reference declared sources", () => {
  const dossier = minimalDossier({
    evidence: [
      {
        assessedAt: "2026-08-07",
        assessedBy: "pesquisador",
        claim: "A obra aparece em repertorio de roda.",
        criterion: "circulacao",
        direction: "sustenta",
        id: "ev-001",
        justification: "Testemunho usado como fixture.",
        sources: [{ sourceId: "fonte-ausente", locator: "p. 12" }],
        strength: "moderada",
      },
    ],
    sources: [
      {
        id: "fonte-presente",
        title: "Songbook de teste",
        type: "songbook",
      },
    ],
  });

  assert.throws(
    () => parseEditorialDossier(dossier),
    /sourceId referencia fonte inexistente/,
  );
});

test("collects validation issues for invalid nested entities", () => {
  assert.throws(
    () =>
      parseEditorialDossier(
        minimalDossier({
          assets: [{ id: "asset-1", status: "valido", type: "midi" }],
          rights: { actions: { baixar_pdf: "talvez" }, status: "liberado" },
        }),
      ),
    (error) => {
      assert.ok(error instanceof EditorialDossierValidationError);
      assert.match(error.message, /assets\[0\]\.type possui valor invalido/);
      assert.match(error.message, /rights\.actions\.baixar_pdf/);
      return true;
    },
  );
});

test("requires valid assets to be versioned and tied to an edition", () => {
  assert.throws(
    () =>
      parseEditorialDossier(
        minimalDossier({
          assets: [
            {
              checksum: "not-a-sha",
              checksumAlgorithm: "md5",
              generatedAt: "hoje",
              id: "asset-1",
              path: "/musicxml/../segredo.musicxml",
              status: "valido",
              type: "musicxml",
            },
          ],
          editions: [{ id: "lead-sheet", status: "valida" }],
        }),
      ),
    (error) => {
      assert.ok(error instanceof EditorialDossierValidationError);
      assert.match(error.message, /assets\[0\]\.checksum deve ser um SHA-256/);
      assert.match(error.message, /assets\[0\]\.checksumAlgorithm possui valor invalido/);
      assert.match(error.message, /assets\[0\]\.generatedAt deve ser uma data ISO 8601 valida/);
      assert.match(error.message, /assets\[0\]\.path deve apontar para caminho seguro/);
      assert.match(error.message, /assets\[0\]\.editionId deve ser texto nao vazio/);
      assert.match(error.message, /assets\[0\]\.generatedBy deve ser texto nao vazio/);
      return true;
    },
  );
});

test("rejects assets pointing to missing editions", () => {
  assert.throws(
    () =>
      parseEditorialDossier(
        minimalDossier({
          assets: [
            {
              checksum: "a".repeat(64),
              checksumAlgorithm: "sha256",
              editionId: "edicao-ausente",
              generatedAt: "2026-08-07",
              generatedBy: "fixture",
              id: "asset-1",
              path: "/musicxml/carinhoso.musicxml",
              status: "valido",
              type: "musicxml",
            },
          ],
          editions: [{ id: "lead-sheet", status: "valida" }],
        }),
      ),
    /assets\[0\]\.editionId referencia edicao inexistente/,
  );
});
