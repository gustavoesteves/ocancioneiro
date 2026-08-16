import { decisionRecordHash, parseEditorialDossier } from "./editorial-dossier.mjs";
import {
  minimumResearchState,
  promotionGateState,
  requiredPromotionActions,
} from "./promotion-policy.mjs";

export class PromotionReviewError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PromotionReviewError";
    this.code = code;
  }
}

function requiredText(value, field, maximum = 2_000) {
  if (typeof value !== "string" || !value.trim()) {
    throw new PromotionReviewError("INVALID_PROMOTION_REVIEW", `${field} e obrigatorio.`);
  }
  const normalized = value.trim();
  if (normalized.length > maximum) {
    throw new PromotionReviewError(
      "INVALID_PROMOTION_REVIEW",
      `${field} excede ${maximum} caracteres.`,
    );
  }
  return normalized;
}

function requiredConfirmation(value, field) {
  if (value !== true) {
    throw new PromotionReviewError(
      "INVALID_PROMOTION_REVIEW",
      `${field} precisa ser confirmado explicitamente.`,
    );
  }
}

function notationProfile(kind, instrument, justification) {
  if (kind === "lead_sheet") return { kind };
  if (kind !== "partitura_instrumental_original") {
    throw new PromotionReviewError(
      "INVALID_PROMOTION_REVIEW",
      "Perfil de notacao invalido.",
    );
  }
  if (!new Set(["piano", "violao"]).has(instrument)) {
    throw new PromotionReviewError(
      "INVALID_PROMOTION_REVIEW",
      "A partitura instrumental original precisa ser classificada como piano ou violao.",
    );
  }
  return {
    instrument,
    justification: requiredText(
      justification,
      "Justificativa da partitura instrumental original",
    ),
    kind,
  };
}

export function applyPromotionReview(
  dossier,
  {
    curationAccepted,
    curationDecidedBy,
    curationJustification,
    curationReviewedBy,
    decisionId,
    editionId,
    notationInstrument,
    notationJustification,
    notationKind,
    editionReviewed,
    editionReviewedBy,
    reviewedAt,
    rightsBasis,
    rightsConfirmed,
    rightsConfirmedBy,
  },
) {
  const parsed = parseEditorialDossier(dossier);
  const normalizedEditionId = requiredText(editionId, "editionId", 128);
  const edition = (parsed.editions ?? []).find(
    (candidate) => candidate.id === normalizedEditionId,
  );
  if (!edition) {
    throw new PromotionReviewError("EDITION_NOT_FOUND", "Edicao editorial nao encontrada.");
  }

  requiredConfirmation(editionReviewed, "A revisao da edicao");
  requiredConfirmation(curationAccepted, "A aceitacao curatorial");
  requiredConfirmation(rightsConfirmed, "A confirmacao dos direitos");
  const research = minimumResearchState(parsed);
  if (!research.complete) {
    throw new PromotionReviewError(
      "RESEARCH_INCOMPLETE",
      `Pesquisa minima incompleta: ${research.pending.join(", ")}.`,
    );
  }

  const normalizedEditionReviewedBy = requiredText(
    editionReviewedBy,
    "Responsavel pela revisao da edicao",
    128,
  );
  const normalizedDecidedBy = requiredText(
    curationDecidedBy,
    "Responsavel pela decisao curatorial",
    128,
  );
  const normalizedReviewedBy = requiredText(
    curationReviewedBy,
    "Revisor independente da curadoria",
    128,
  );
  if (
    normalizedDecidedBy.localeCompare(normalizedReviewedBy, "pt-BR", {
      sensitivity: "base",
    }) === 0
  ) {
    throw new PromotionReviewError(
      "REVIEWER_NOT_INDEPENDENT",
      "A decisao curatorial e a revisao independente precisam ter responsaveis diferentes.",
    );
  }
  const normalizedJustification = requiredText(
    curationJustification,
    "Justificativa curatorial",
  );
  const normalizedRightsConfirmedBy = requiredText(
    rightsConfirmedBy,
    "Responsavel pela verificacao de direitos",
    128,
  );
  const normalizedRightsBasis = requiredText(
    rightsBasis,
    "Base da verificacao de direitos",
  );
  const normalizedDecisionId = requiredText(decisionId, "decisionId", 128);
  const normalizedReviewedAt = requiredText(reviewedAt, "reviewedAt", 64);
  if (Number.isNaN(Date.parse(normalizedReviewedAt))) {
    throw new PromotionReviewError(
      "INVALID_PROMOTION_REVIEW",
      "reviewedAt deve ser uma data ISO 8601 valida.",
    );
  }

  const decision = {
    decidedAt: normalizedReviewedAt,
    decidedBy: normalizedDecidedBy,
    id: normalizedDecisionId,
    justification: normalizedJustification,
    reviews: [
      {
        conflictOfInterest: false,
        reviewedAt: normalizedReviewedAt,
        reviewedBy: normalizedReviewedBy,
        role: "revisao-editorial-independente",
        summary: `Revisao independente registrada para a edicao ${normalizedEditionId}.`,
      },
    ],
    status: "aceita",
  };
  const normalizedNotationProfile = notationProfile(
    notationKind ?? edition.notationProfile?.kind ?? "lead_sheet",
    notationInstrument ?? edition.notationProfile?.instrument,
    notationJustification ?? edition.notationProfile?.justification,
  );
  const actions = { ...parsed.rights.actions };
  for (const action of requiredPromotionActions) actions[action] = "permitida";

  const nextDossier = parseEditorialDossier({
    ...parsed,
    curation: {
      ...parsed.curation,
      currentDecisionId: decision.id,
      decisions: [
        ...(parsed.curation.decisions ?? []),
        { ...decision, recordHash: decisionRecordHash(decision) },
      ],
      status: "aceita",
    },
    editions: parsed.editions.map((candidate) =>
      candidate.id === normalizedEditionId
        ? {
            ...candidate,
            notationProfile: normalizedNotationProfile,
            status: "valida",
            validatedAt: normalizedReviewedAt,
            validatedBy: normalizedEditionReviewedBy,
          }
        : candidate,
    ),
    rights: {
      ...parsed.rights,
      actions,
      basis: normalizedRightsBasis,
      confirmedAt: normalizedReviewedAt,
      confirmedBy: normalizedRightsConfirmedBy,
      status: "liberado",
    },
  });

  return {
    dossier: nextDossier,
    gates: promotionGateState(nextDossier, normalizedEditionId),
  };
}
