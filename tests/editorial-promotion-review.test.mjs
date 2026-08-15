import assert from "node:assert/strict";
import test from "node:test";
import {
  applyPromotionReview,
  PromotionReviewError,
} from "../lib/editorial-promotion-review.mjs";
import { parseEditorialDossier } from "../lib/editorial-dossier.mjs";
import { promotionGateState } from "../lib/promotion-policy.mjs";

function candidateDossier() {
  return {
    schemaVersion: 1,
    work: {
      creators: [{ name: "Autora Fixture", role: "composer" }],
      id: "obra-fixture",
      preferredTitle: "Obra fixture",
    },
    curation: { status: "candidata" },
    sources: [],
    evidence: [],
    editions: [
      {
        genre: "Choro",
        id: "edicao-fixture",
        level: "Intermediario",
        notes: "Edicao capturada.",
        source: "Fonte fixture",
        status: "em_revisao",
        tags: [],
        title: "Obra fixture",
      },
    ],
    assets: [],
    rights: {
      status: "nao_verificado",
      actions: {
        baixar_pdf: "nao_avaliada",
        distribuir_musicxml: "nao_avaliada",
        exibir_metadados: "permitida",
        exibir_partitura: "nao_avaliada",
        imprimir: "nao_avaliada",
        reproduzir_playback: "nao_avaliada",
      },
    },
  };
}

const review = {
  curationAccepted: true,
  curationDecidedBy: "Editora Fixture",
  curationJustification: "A obra foi aceita depois da verificacao editorial documentada.",
  curationReviewedBy: "Revisora Independente",
  decisionId: "decisao-promocao-fixture",
  editionId: "edicao-fixture",
  editionReviewed: true,
  editionReviewedBy: "Revisor Musical",
  reviewedAt: "2026-08-15T12:00:00.000Z",
  rightsBasis: "Dominio publico e procedencia da edicao verificados documentalmente.",
  rightsConfirmed: true,
  rightsConfirmedBy: "Responsavel Juridica",
};

test("conclui os tres gates sem publicar asset e preserva a trilha de autoria", () => {
  const original = candidateDossier();
  const before = promotionGateState(original, review.editionId);
  assert.equal(before.ready, false);
  assert.equal(before.editionValid, false);
  assert.equal(before.curationAccepted, false);
  assert.ok(before.blockedRights.length > 0);

  const result = applyPromotionReview(original, review);
  const parsed = parseEditorialDossier(result.dossier);
  const edition = parsed.editions[0];
  const decision = parsed.curation.decisions[0];

  assert.equal(result.gates.ready, true);
  assert.equal(edition.status, "valida");
  assert.equal(edition.validatedBy, "Revisor Musical");
  assert.equal(parsed.curation.currentDecisionId, decision.id);
  assert.equal(decision.status, "aceita");
  assert.equal(decision.decidedBy, "Editora Fixture");
  assert.equal(decision.reviews[0].reviewedBy, "Revisora Independente");
  assert.match(decision.recordHash, /^[a-f0-9]{64}$/);
  assert.equal(parsed.rights.confirmedBy, "Responsavel Juridica");
  assert.equal(parsed.rights.actions.distribuir_musicxml, "permitida");
  assert.equal(parsed.rights.actions.baixar_pdf, "nao_avaliada");
  assert.deepEqual(parsed.assets, []);
  assert.equal(original.editions[0].status, "em_revisao");
});

test("rejeita uma decisao sem revisao independente", () => {
  assert.throws(
    () => applyPromotionReview(candidateDossier(), {
      ...review,
      curationReviewedBy: "editora fixture",
    }),
    (error) =>
      error instanceof PromotionReviewError &&
      error.code === "REVIEWER_NOT_INDEPENDENT",
  );
});

test("nao infere direitos ou validacao sem confirmacoes explicitas", () => {
  assert.throws(
    () => applyPromotionReview(candidateDossier(), { ...review, rightsConfirmed: false }),
    (error) =>
      error instanceof PromotionReviewError &&
      error.code === "INVALID_PROMOTION_REVIEW",
  );
});

test("aceita justificativas concisas sem um limite minimo oculto", () => {
  const result = applyPromotionReview(candidateDossier(), {
    ...review,
    curationJustification: "Lead sheet completo",
    rightsBasis: "Dominio publico",
  });

  assert.equal(result.gates.ready, true);
  assert.equal(
    result.dossier.curation.decisions[0].justification,
    "Lead sheet completo",
  );
  assert.equal(result.dossier.rights.basis, "Dominio publico");
});
