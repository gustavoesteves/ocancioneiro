import assert from "node:assert/strict";
import test from "node:test";
import {
  summarizeEditorialDossier,
  summarizeEditorialDossiers,
} from "../lib/editorial-dossier-summary.mjs";

function dossier(overrides = {}) {
  return {
    schemaVersion: 1,
    publicCatalogId: "carinhoso",
    work: {
      creators: [{ name: "Pixinguinha", role: "composer" }],
      id: "obra-carinhoso",
      preferredTitle: "Carinhoso",
    },
    curation: {
      currentDecisionId: "decisao-aceita",
      decisions: [
        {
          decidedAt: "2026-08-07",
          decidedBy: "bancada-editorial",
          id: "decisao-aceita",
          justification: "Fixture aceita.",
          status: "aceita",
        },
      ],
      status: "em_revisao",
    },
    editions: [{ id: "lead-sheet", status: "valida" }],
    rights: {
      actions: {
        exibir_metadados: "permitida",
      },
      status: "nao_verificado",
    },
    ...overrides,
  };
}

test("summarizes editorial dossier state for the import tool", () => {
  const summary = summarizeEditorialDossier({
    dossier: dossier(),
    filePath: "data/dossiers/obra-carinhoso.json",
  });

  assert.equal(summary.workId, "obra-carinhoso");
  assert.equal(summary.publicCatalogId, "carinhoso");
  assert.equal(summary.status, "aceita");
  assert.equal(summary.editionCount, 1);
  assert.equal(summary.assetCount, 0);
  assert.equal(summary.publicable, false);
  assert.ok(summary.projectionIssues.includes("sem asset MusicXML publico valido"));
});

test("sorts dossier summaries by title", () => {
  const summaries = summarizeEditorialDossiers([
    {
      dossier: dossier({
        publicCatalogId: "z",
        work: {
          creators: [{ name: "Autor", role: "composer" }],
          id: "obra-z",
          preferredTitle: "Zabumba",
        },
      }),
      filePath: "z.json",
    },
    {
      dossier: dossier(),
      filePath: "a.json",
    },
  ]);

  assert.deepEqual(
    summaries.map((summary) => summary.title),
    ["Carinhoso", "Zabumba"],
  );
});
