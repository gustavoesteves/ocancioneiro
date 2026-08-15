import assert from "node:assert/strict";
import test from "node:test";
import { suggestImportDestination } from "../app/import-destination-suggestion.ts";

function dossier(overrides = {}) {
  return {
    assetCount: 0,
    blockedPromotionRights: [],
    creators: [],
    currentDecision: null,
    editionCount: 1,
    editions: [{ id: "edicao-importada-asa-branca", status: "em_revisao", title: "Asa branca" }],
    projectionIssues: [],
    publicCatalogId: null,
    publicable: false,
    rightsStatus: "nao_verificado",
    sources: [],
    status: "candidata",
    title: "Asa branca",
    workId: "obra-asa-branca",
    ...overrides,
  };
}

test("prepara nova obra automaticamente quando nao ha correspondencia", () => {
  assert.deepEqual(suggestImportDestination("asa-branca", []), {
    editionId: null,
    mode: "new",
    workId: null,
  });
});

test("sugere obra e edicao importada existentes pelo identificador estavel", () => {
  assert.deepEqual(suggestImportDestination("asa-branca", [dossier()]), {
    editionId: "edicao-importada-asa-branca",
    mode: "existing",
    workId: "obra-asa-branca",
  });
});

test("usa alias publico e exige escolha quando ha varias edicoes ambiguas", () => {
  const existing = dossier({
    editions: [
      { id: "edicao-a", status: "valida", title: "A" },
      { id: "edicao-b", status: "em_revisao", title: "B" },
    ],
    publicCatalogId: "asa-branca",
    workId: "obra-identidade-estavel",
  });

  assert.deepEqual(suggestImportDestination("asa-branca", [existing]), {
    editionId: null,
    mode: "existing",
    workId: "obra-identidade-estavel",
  });
});
