import assert from "node:assert/strict";
import test from "node:test";
import {
  EditorialDossierValidationError,
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
