import assert from "node:assert/strict";
import test from "node:test";
import {
  addEditorialResearch,
  EditorialResearchError,
} from "../lib/editorial-research.mjs";

function dossier() {
  return {
    schemaVersion: 1,
    work: {
      creators: [{ name: "Chiquinha Gonzaga", role: "composer" }],
      id: "obra-atraente",
      preferredTitle: "Atraente",
    },
    curation: { status: "em_pesquisa" },
    evidence: [],
    sources: [],
    editions: [],
    assets: [],
    rights: {
      actions: { exibir_metadados: "permitida" },
      status: "nao_verificado",
    },
  };
}

const input = {
  assessedAt: "2026-08-15T18:00:00.000Z",
  canonicalClaim: {
    centrality: "nuclear",
    context: "repertorio brasileiro para piano",
    justification: "A obra permanece como referencia historica e instrumental.",
    reach: "nacional",
  },
  evidence: {
    assessedBy: "Pesquisadora Fixture",
    claim: "A obra integra o repertorio historico brasileiro para piano.",
    criterion: "valor_historico",
    direction: "sustenta",
    justification: "A fonte cataloga a obra e documenta sua permanencia.",
    locator: "verbete Atraente",
    strength: "moderada",
    strengthJustification: "Fonte institucional com identificacao verificavel.",
  },
  evidenceId: "evidencia-atraente-1",
  source: {
    accessedAt: "2026-08-15",
    persistentId: "acervo:atraente",
    reference: "Catalogo institucional",
    responsible: "Instituicao Fixture",
    title: "Registro catalografico de Atraente",
    type: "catalogo_ou_acervo",
    url: "https://example.org/atraente",
  },
  sourceId: "fonte-atraente-1",
};

test("adiciona fonte, evidencia e afirmacao canonica ligadas", () => {
  const result = addEditorialResearch(dossier(), input);

  assert.equal(result.dossier.sources[0].id, input.sourceId);
  assert.equal(result.dossier.evidence[0].id, input.evidenceId);
  assert.equal(result.dossier.evidence[0].sources[0].sourceId, input.sourceId);
  assert.deepEqual(result.dossier.curation.canonicalClaims[0].evidenceIds, [
    input.evidenceId,
  ]);
});

test("rejeita URL insegura e vocabulario aberto", () => {
  assert.throws(
    () =>
      addEditorialResearch(dossier(), {
        ...input,
        source: { ...input.source, url: "file:///tmp/fonte" },
      }),
    (error) =>
      error instanceof EditorialResearchError && error.code === "INVALID_RESEARCH",
  );
  assert.throws(
    () =>
      addEditorialResearch(dossier(), {
        ...input,
        evidence: { ...input.evidence, criterion: "popularidade" },
      }),
    /Criterio possui valor invalido/,
  );
});
