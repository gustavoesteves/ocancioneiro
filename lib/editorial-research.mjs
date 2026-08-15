import {
  editorialVocabulary,
  parseEditorialDossier,
} from "./editorial-dossier.mjs";

export class EditorialResearchError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "EditorialResearchError";
    this.code = code;
  }
}

function requiredText(value, field, maximum = 2_000) {
  if (typeof value !== "string" || !value.trim()) {
    throw new EditorialResearchError("INVALID_RESEARCH", `${field} e obrigatorio.`);
  }
  const normalized = value.trim();
  if (normalized.length > maximum) {
    throw new EditorialResearchError(
      "INVALID_RESEARCH",
      `${field} excede ${maximum} caracteres.`,
    );
  }
  return normalized;
}

function optionalText(value, field, maximum = 2_000) {
  if (value == null || value === "") return undefined;
  return requiredText(value, field, maximum);
}

function enumValue(value, values, field) {
  if (!values.includes(value)) {
    throw new EditorialResearchError("INVALID_RESEARCH", `${field} possui valor invalido.`);
  }
  return value;
}

function isoDate(value, field) {
  const normalized = requiredText(value, field, 64);
  if (Number.isNaN(Date.parse(normalized))) {
    throw new EditorialResearchError("INVALID_RESEARCH", `${field} deve ser uma data valida.`);
  }
  return normalized;
}

function optionalHttpUrl(value) {
  const normalized = optionalText(value, "URL da fonte", 2_048);
  if (!normalized) return undefined;
  let url;
  try {
    url = new URL(normalized);
  } catch {
    throw new EditorialResearchError("INVALID_RESEARCH", "URL da fonte invalida.");
  }
  if (!new Set(["http:", "https:"]).has(url.protocol)) {
    throw new EditorialResearchError(
      "INVALID_RESEARCH",
      "URL da fonte precisa usar HTTP ou HTTPS.",
    );
  }
  return url.toString();
}

export function addEditorialResearch(
  dossier,
  {
    assessedAt,
    canonicalClaim,
    evidence,
    evidenceId,
    existingSourceId,
    source = {},
    sourceId,
  },
) {
  const parsed = parseEditorialDossier(dossier);
  const normalizedExistingSourceId = optionalText(
    existingSourceId,
    "existingSourceId",
    128,
  );
  const normalizedSourceId = normalizedExistingSourceId
    ? normalizedExistingSourceId
    : requiredText(sourceId, "sourceId", 128);
  const normalizedEvidenceId = requiredText(evidenceId, "evidenceId", 128);
  const existingSource = normalizedExistingSourceId
    ? (parsed.sources ?? []).find((candidate) => candidate.id === normalizedSourceId)
    : null;

  if (normalizedExistingSourceId && !existingSource) {
    throw new EditorialResearchError(
      "INVALID_RESEARCH",
      "Fonte existente nao encontrada.",
    );
  }

  const sourceRecord = existingSource
    ? null
    : {
        accessedAt: isoDate(source.accessedAt, "Data de consulta"),
        id: normalizedSourceId,
        persistentId: optionalText(source.persistentId, "Identificador persistente", 512),
        reference: optionalText(source.reference, "Referencia", 2_000),
        responsible: optionalText(source.responsible, "Responsavel pela fonte", 512),
        title: requiredText(source.title, "Titulo da fonte", 512),
        type: enumValue(source.type, editorialVocabulary.sourceTypes, "Tipo da fonte"),
        url: optionalHttpUrl(source.url),
      };
  if (sourceRecord) {
    Object.keys(sourceRecord).forEach((key) => {
      if (sourceRecord[key] === undefined) delete sourceRecord[key];
    });
  }

  const locator = optionalText(evidence.locator, "Localizador da evidencia", 512);
  const evidenceRecord = {
    assessedAt: isoDate(assessedAt, "Data da avaliacao"),
    assessedBy: requiredText(evidence.assessedBy, "Responsavel pela avaliacao", 128),
    claim: requiredText(evidence.claim, "Afirmacao sustentada"),
    criterion: enumValue(
      evidence.criterion,
      editorialVocabulary.evidenceCriteria,
      "Criterio",
    ),
    direction: enumValue(
      evidence.direction,
      editorialVocabulary.evidenceDirections,
      "Direcao",
    ),
    id: normalizedEvidenceId,
    justification: requiredText(evidence.justification, "Justificativa da evidencia"),
    sources: [
      {
        ...(locator ? { locator } : {}),
        sourceId: normalizedSourceId,
      },
    ],
    strength: enumValue(
      evidence.strength,
      editorialVocabulary.evidenceStrengths,
      "Forca",
    ),
    strengthJustification: requiredText(
      evidence.strengthJustification,
      "Justificativa da forca",
    ),
  };

  const currentDecisionId = parsed.curation.currentDecisionId;
  const canonicalClaimRecord = {
    centrality: enumValue(
      canonicalClaim.centrality,
      editorialVocabulary.centrality,
      "Centralidade",
    ),
    context: requiredText(canonicalClaim.context, "Contexto canonico", 512),
    ...(currentDecisionId ? { decisionId: currentDecisionId } : {}),
    evidenceIds: [normalizedEvidenceId],
    justification: requiredText(
      canonicalClaim.justification,
      "Justificativa da afirmacao canonica",
    ),
    reach: enumValue(
      canonicalClaim.reach,
      editorialVocabulary.canonicalReach,
      "Alcance",
    ),
  };

  const next = parseEditorialDossier({
    ...parsed,
    curation: {
      ...parsed.curation,
      canonicalClaims: [
        ...(parsed.curation.canonicalClaims ?? []),
        canonicalClaimRecord,
      ],
    },
    evidence: [...(parsed.evidence ?? []), evidenceRecord],
    sources: sourceRecord
      ? [...(parsed.sources ?? []), sourceRecord]
      : (parsed.sources ?? []),
  });

  return {
    canonicalClaim: canonicalClaimRecord,
    dossier: next,
    evidence: evidenceRecord,
    source: sourceRecord ?? existingSource,
  };
}

export function recordEditorialResearchEvent(
  dossier,
  {
    eventId,
    reason,
    recordedAt,
    recordedBy,
    replacementId,
    targetId,
    targetType,
    type,
  },
) {
  const parsed = parseEditorialDossier(dossier);
  const normalizedTargetType = enumValue(
    targetType,
    editorialVocabulary.researchEventTargetTypes,
    "Tipo do alvo",
  );
  const candidates = normalizedTargetType === "source"
    ? (parsed.sources ?? [])
    : (parsed.evidence ?? []);
  const normalizedTargetId = requiredText(targetId, "targetId", 128);
  const target = candidates.find((candidate) => candidate.id === normalizedTargetId);
  if (!target) {
    throw new EditorialResearchError(
      "INVALID_RESEARCH",
      "Registro original nao encontrado.",
    );
  }

  const normalizedType = enumValue(
    type,
    editorialVocabulary.researchEventTypes,
    "Tipo do evento",
  );
  const normalizedReplacementId = optionalText(replacementId, "replacementId", 128);
  if (normalizedType === "substituicao") {
    if (!normalizedReplacementId) {
      throw new EditorialResearchError(
        "INVALID_RESEARCH",
        "replacementId e obrigatorio para substituicao.",
      );
    }
    if (normalizedReplacementId === normalizedTargetId) {
      throw new EditorialResearchError(
        "INVALID_RESEARCH",
        "replacementId deve apontar para outro registro.",
      );
    }
    if (!candidates.some((candidate) => candidate.id === normalizedReplacementId)) {
      throw new EditorialResearchError(
        "INVALID_RESEARCH",
        "Registro substituto nao encontrado.",
      );
    }
  }

  const event = {
    id: requiredText(eventId, "eventId", 128),
    reason: requiredText(reason, "Motivo do historico"),
    recordedAt: isoDate(recordedAt, "Data do historico"),
    recordedBy: requiredText(recordedBy, "Responsavel pelo historico", 128),
    ...(normalizedReplacementId ? { replacementId: normalizedReplacementId } : {}),
    targetId: normalizedTargetId,
    targetType: normalizedTargetType,
    type: normalizedType,
  };

  const next = parseEditorialDossier({
    ...parsed,
    researchEvents: [...(parsed.researchEvents ?? []), event],
  });

  return { dossier: next, event };
}

export function editorialResearchSnapshot(dossier) {
  const parsed = parseEditorialDossier(dossier);
  return {
    canonicalClaims: parsed.curation.canonicalClaims ?? [],
    evidence: parsed.evidence ?? [],
    researchEvents: parsed.researchEvents ?? [],
    sources: parsed.sources ?? [],
  };
}
