import assert from "node:assert/strict";
import test from "node:test";
import {
  addEditorialResearch,
  EditorialResearchError,
  recordEditorialResearchEvent,
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

test("reutiliza fonte existente em nova evidencia sem duplica-la", () => {
  const first = addEditorialResearch(dossier(), input);
  const second = addEditorialResearch(first.dossier, {
    ...input,
    existingSourceId: input.sourceId,
    evidence: {
      ...input.evidence,
      claim: "A obra tambem e citada como referencia instrumental.",
      criterion: "valor_instrumental_ou_pedagogico",
    },
    evidenceId: "evidencia-atraente-2",
    source: undefined,
    sourceId: undefined,
  });

  assert.equal(second.dossier.sources.length, 1);
  assert.equal(second.dossier.evidence.length, 2);
  assert.equal(second.dossier.evidence[1].sources[0].sourceId, input.sourceId);
  assert.equal(second.source.id, input.sourceId);
});

test("rejeita reutilizacao de fonte inexistente", () => {
  assert.throws(
    () =>
      addEditorialResearch(dossier(), {
        ...input,
        existingSourceId: "fonte-ausente",
        source: undefined,
        sourceId: undefined,
      }),
    /Fonte existente nao encontrada/,
  );
});

test("registra correcao de pesquisa sem alterar fonte ou evidencia", () => {
  const first = addEditorialResearch(dossier(), input);
  const result = recordEditorialResearchEvent(first.dossier, {
    eventId: "historico-correcao-1",
    reason: "Referencia catalografica normalizada depois da revisao.",
    recordedAt: "2026-08-15T19:00:00.000Z",
    recordedBy: "Editora Fixture",
    targetId: input.sourceId,
    targetType: "source",
    type: "correcao",
  });

  assert.equal(result.dossier.sources.length, 1);
  assert.equal(result.dossier.evidence.length, 1);
  assert.equal(result.dossier.researchEvents[0].targetId, input.sourceId);
});

test("registra substituicao de evidencia apontando para registro substituto", () => {
  const first = addEditorialResearch(dossier(), input);
  const second = addEditorialResearch(first.dossier, {
    ...input,
    evidence: {
      ...input.evidence,
      claim: "A obra tem circulacao documentada em outra fonte.",
      criterion: "circulacao",
    },
    evidenceId: "evidencia-atraente-2",
    source: {
      ...input.source,
      persistentId: "acervo:atraente:2",
      title: "Segundo registro catalografico de Atraente",
      url: "https://example.org/atraente/2",
    },
    sourceId: "fonte-atraente-2",
  });
  const result = recordEditorialResearchEvent(second.dossier, {
    eventId: "historico-substituicao-1",
    reason: "Evidencia mais precisa substitui a leitura preliminar.",
    recordedAt: "2026-08-15T19:10:00.000Z",
    recordedBy: "Editora Fixture",
    replacementId: "evidencia-atraente-2",
    targetId: input.evidenceId,
    targetType: "evidence",
    type: "substituicao",
  });

  assert.equal(result.dossier.researchEvents[0].replacementId, "evidencia-atraente-2");
});

test("rejeita substituicao por registro inexistente", () => {
  const first = addEditorialResearch(dossier(), input);

  assert.throws(
    () =>
      recordEditorialResearchEvent(first.dossier, {
        eventId: "historico-substituicao-1",
        reason: "Tentativa invalida.",
        recordedAt: "2026-08-15T19:10:00.000Z",
        recordedBy: "Editora Fixture",
        replacementId: "evidencia-ausente",
        targetId: input.evidenceId,
        targetType: "evidence",
        type: "substituicao",
      }),
    /Registro substituto nao encontrado/,
  );
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
