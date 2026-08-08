const schemaVersion = 1;

export const editorialVocabulary = {
  assetChecksumAlgorithms: ["sha256"],
  assetStates: ["pendente", "valido", "inconsistente", "substituido", "bloqueado"],
  assetTypes: ["musicxml", "pdf", "imagem", "audio", "outro"],
  canonicalReach: ["nacional", "regional", "comunidade"],
  centrality: ["nuclear", "consolidada", "contextual"],
  creatorRoles: [
    "composer",
    "lyricist",
    "arranger",
    "editor",
    "translator",
    "attributed",
    "unknown",
  ],
  curationStatuses: [
    "candidata",
    "em_pesquisa",
    "em_revisao",
    "aceita",
    "rejeitada",
    "inconclusiva",
  ],
  editionStatuses: [
    "inexistente",
    "em_transcricao",
    "em_revisao",
    "valida",
    "substituida",
  ],
  evidenceCriteria: [
    "permanencia",
    "circulacao",
    "formacao_de_linguagem",
    "influencia",
    "regravacao_relevante",
    "valor_instrumental_ou_pedagogico",
    "valor_historico",
    "representatividade",
  ],
  evidenceDirections: ["sustenta", "contradiz", "contextualiza"],
  evidenceLocatorTypes: ["pagina", "faixa", "compasso", "item_acervo", "url"],
  evidenceStrengths: ["forte", "moderada", "fraca"],
  publicActions: [
    "exibir_metadados",
    "exibir_partitura",
    "reproduzir_playback",
    "imprimir",
    "baixar_pdf",
    "distribuir_musicxml",
  ],
  rightsPermissions: ["nao_avaliada", "permitida", "restrita", "bloqueada"],
  rightsStatuses: [
    "nao_verificado",
    "em_analise",
    "liberado",
    "restrito",
    "bloqueado",
  ],
  sourceTypes: [
    "manuscrito",
    "edicao_publicada",
    "gravacao",
    "catalogo_ou_acervo",
    "songbook",
    "curriculo_ou_material_didatico",
    "programa",
    "entrevista_ou_depoimento",
    "estudo_ou_artigo",
    "fonte_digital",
  ],
};

export class EditorialDossierValidationError extends Error {
  constructor(issues) {
    super(`Dossie editorial invalido:\n- ${issues.join("\n- ")}`);
    this.name = "EditorialDossierValidationError";
    this.issues = issues;
  }
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function pushRequiredString(issues, value, field) {
  if (!isNonEmptyString(value)) {
    issues.push(`${field} deve ser texto nao vazio`);
  }
}

function pushOptionalString(issues, value, field) {
  if (value !== undefined && typeof value !== "string") {
    issues.push(`${field} deve ser texto`);
  }
}

function pushEnum(issues, value, values, field) {
  if (!values.includes(value)) {
    issues.push(`${field} possui valor invalido: ${String(value)}`);
  }
}

function pushStringArray(issues, value, field) {
  if (
    value !== undefined &&
    (!Array.isArray(value) || !value.every(isNonEmptyString))
  ) {
    issues.push(`${field} deve ser um array de textos nao vazios`);
  }
}

function pushUniqueId(issues, seenIds, id, field) {
  if (!isNonEmptyString(id)) {
    issues.push(`${field} deve ser texto nao vazio`);
    return;
  }

  if (seenIds.has(id)) {
    issues.push(`${field} duplicado: ${id}`);
  }
  seenIds.add(id);
}

function pushIsoDate(issues, value, field) {
  if (
    value !== undefined &&
    (typeof value !== "string" || Number.isNaN(Date.parse(value)))
  ) {
    issues.push(`${field} deve ser uma data ISO 8601 valida`);
  }
}

function pushSha256(issues, value, field) {
  if (value !== undefined && !/^[a-f0-9]{64}$/.test(value)) {
    issues.push(`${field} deve ser um SHA-256 hexadecimal`);
  }
}

function isSafePublicMusicXmlPath(value) {
  if (typeof value !== "string" || !value.startsWith("/musicxml/")) {
    return false;
  }

  try {
    return !decodeURIComponent(value)
      .split("/")
      .some((segment) => segment === "." || segment === "..");
  } catch {
    return false;
  }
}

function validateCreators(issues, creators) {
  if (!Array.isArray(creators) || creators.length === 0) {
    issues.push("work.creators deve conter ao menos um autor");
    return;
  }

  creators.forEach((creator, index) => {
    const prefix = `work.creators[${index}]`;
    if (!isRecord(creator)) {
      issues.push(`${prefix} deve ser um objeto`);
      return;
    }

    pushRequiredString(issues, creator.name, `${prefix}.name`);
    pushEnum(issues, creator.role, editorialVocabulary.creatorRoles, `${prefix}.role`);
  });
}

function validateWork(issues, work) {
  if (!isRecord(work)) {
    issues.push("work deve ser um objeto");
    return;
  }

  pushRequiredString(issues, work.id, "work.id");
  pushRequiredString(issues, work.preferredTitle, "work.preferredTitle");
  pushStringArray(issues, work.alternateTitles, "work.alternateTitles");
  pushOptionalString(issues, work.identityNotes, "work.identityNotes");
  validateCreators(issues, work.creators);
}

function validateCanonicalClaims(issues, claims) {
  if (claims === undefined) return;
  if (!Array.isArray(claims)) {
    issues.push("curation.canonicalClaims deve ser um array");
    return;
  }

  claims.forEach((claim, index) => {
    const prefix = `curation.canonicalClaims[${index}]`;
    if (!isRecord(claim)) {
      issues.push(`${prefix} deve ser um objeto`);
      return;
    }

    pushRequiredString(issues, claim.context, `${prefix}.context`);
    pushEnum(issues, claim.centrality, editorialVocabulary.centrality, `${prefix}.centrality`);
    pushEnum(issues, claim.reach, editorialVocabulary.canonicalReach, `${prefix}.reach`);
    pushOptionalString(issues, claim.justification, `${prefix}.justification`);
    pushOptionalString(issues, claim.decisionId, `${prefix}.decisionId`);
  });
}

function validateCurationDecisions(issues, decisions) {
  if (decisions === undefined) return new Set();
  if (!Array.isArray(decisions)) {
    issues.push("curation.decisions deve ser um array");
    return new Set();
  }

  const decisionIds = new Set();
  decisions.forEach((decision, index) => {
    const prefix = `curation.decisions[${index}]`;
    if (!isRecord(decision)) {
      issues.push(`${prefix} deve ser um objeto`);
      return;
    }

    pushUniqueId(issues, decisionIds, decision.id, `${prefix}.id`);
    pushEnum(
      issues,
      decision.status,
      editorialVocabulary.curationStatuses,
      `${prefix}.status`,
    );
    pushRequiredString(issues, decision.justification, `${prefix}.justification`);
    pushRequiredString(issues, decision.decidedBy, `${prefix}.decidedBy`);
    pushIsoDate(issues, decision.decidedAt, `${prefix}.decidedAt`);
  });

  return decisionIds;
}

function validateCuration(issues, curation) {
  if (!isRecord(curation)) {
    issues.push("curation deve ser um objeto");
    return;
  }

  pushEnum(
    issues,
    curation.status,
    editorialVocabulary.curationStatuses,
    "curation.status",
  );
  const decisionIds = validateCurationDecisions(issues, curation.decisions);
  if (
    curation.currentDecisionId !== undefined &&
    !decisionIds.has(curation.currentDecisionId)
  ) {
    issues.push("curation.currentDecisionId referencia decisao inexistente");
  }
  validateCanonicalClaims(issues, curation.canonicalClaims);
}

function validateSources(issues, sources) {
  if (sources === undefined) return new Set();
  if (!Array.isArray(sources)) {
    issues.push("sources deve ser um array");
    return new Set();
  }

  const sourceIds = new Set();
  const persistentIds = new Set();
  sources.forEach((source, index) => {
    const prefix = `sources[${index}]`;
    if (!isRecord(source)) {
      issues.push(`${prefix} deve ser um objeto`);
      return;
    }

    pushUniqueId(issues, sourceIds, source.id, `${prefix}.id`);
    pushEnum(issues, source.type, editorialVocabulary.sourceTypes, `${prefix}.type`);
    pushRequiredString(issues, source.title, `${prefix}.title`);
    pushOptionalString(issues, source.responsible, `${prefix}.responsible`);
    pushOptionalString(issues, source.persistentId, `${prefix}.persistentId`);
    pushOptionalString(issues, source.reference, `${prefix}.reference`);
    pushOptionalString(issues, source.url, `${prefix}.url`);
    pushIsoDate(issues, source.accessedAt, `${prefix}.accessedAt`);

    if (isNonEmptyString(source.persistentId)) {
      if (persistentIds.has(source.persistentId)) {
        issues.push(`${prefix}.persistentId duplicado: ${source.persistentId}`);
      }
      persistentIds.add(source.persistentId);
    }
  });

  return sourceIds;
}

function validateEvidenceSources(issues, sources, sourceIds, prefix) {
  if (sources === undefined) return;
  if (!Array.isArray(sources)) {
    issues.push(`${prefix}.sources deve ser um array`);
    return;
  }

  sources.forEach((sourceUse, index) => {
    const sourcePrefix = `${prefix}.sources[${index}]`;
    if (!isRecord(sourceUse)) {
      issues.push(`${sourcePrefix} deve ser um objeto`);
      return;
    }

    pushRequiredString(issues, sourceUse.sourceId, `${sourcePrefix}.sourceId`);
    if (isNonEmptyString(sourceUse.sourceId) && !sourceIds.has(sourceUse.sourceId)) {
      issues.push(`${sourcePrefix}.sourceId referencia fonte inexistente`);
    }
    pushOptionalString(issues, sourceUse.locator, `${sourcePrefix}.locator`);

    if (sourceUse.locators !== undefined) {
      if (!Array.isArray(sourceUse.locators) || sourceUse.locators.length === 0) {
        issues.push(`${sourcePrefix}.locators deve conter localizadores`);
      } else {
        sourceUse.locators.forEach((locator, locatorIndex) => {
          const locatorPrefix = `${sourcePrefix}.locators[${locatorIndex}]`;
          if (!isRecord(locator)) {
            issues.push(`${locatorPrefix} deve ser um objeto`);
            return;
          }

          pushEnum(
            issues,
            locator.type,
            editorialVocabulary.evidenceLocatorTypes,
            `${locatorPrefix}.type`,
          );
          pushRequiredString(issues, locator.value, `${locatorPrefix}.value`);
          pushOptionalString(issues, locator.note, `${locatorPrefix}.note`);
        });
      }
    }
  });
}

function validateEvidence(issues, evidence, sourceIds) {
  if (evidence === undefined) return;
  if (!Array.isArray(evidence)) {
    issues.push("evidence deve ser um array");
    return;
  }

  const evidenceIds = new Set();
  evidence.forEach((item, index) => {
    const prefix = `evidence[${index}]`;
    if (!isRecord(item)) {
      issues.push(`${prefix} deve ser um objeto`);
      return;
    }

    pushUniqueId(issues, evidenceIds, item.id, `${prefix}.id`);
    pushRequiredString(issues, item.claim, `${prefix}.claim`);
    pushEnum(
      issues,
      item.criterion,
      editorialVocabulary.evidenceCriteria,
      `${prefix}.criterion`,
    );
    pushEnum(
      issues,
      item.direction,
      editorialVocabulary.evidenceDirections,
      `${prefix}.direction`,
    );
    pushEnum(
      issues,
      item.strength,
      editorialVocabulary.evidenceStrengths,
      `${prefix}.strength`,
    );
    pushRequiredString(issues, item.justification, `${prefix}.justification`);
    pushRequiredString(
      issues,
      item.strengthJustification,
      `${prefix}.strengthJustification`,
    );
    pushRequiredString(issues, item.assessedBy, `${prefix}.assessedBy`);
    pushIsoDate(issues, item.assessedAt, `${prefix}.assessedAt`);
    validateEvidenceSources(issues, item.sources, sourceIds, prefix);
  });
}

function validateAssets(issues, assets, editionIds) {
  if (assets === undefined) return;
  if (!Array.isArray(assets)) {
    issues.push("assets deve ser um array");
    return;
  }

  const assetIds = new Set();
  assets.forEach((asset, index) => {
    const prefix = `assets[${index}]`;
    if (!isRecord(asset)) {
      issues.push(`${prefix} deve ser um objeto`);
      return;
    }

    pushUniqueId(issues, assetIds, asset.id, `${prefix}.id`);
    pushEnum(issues, asset.type, editorialVocabulary.assetTypes, `${prefix}.type`);
    pushEnum(issues, asset.status, editorialVocabulary.assetStates, `${prefix}.status`);
    pushOptionalString(issues, asset.editionId, `${prefix}.editionId`);
    pushOptionalString(issues, asset.path, `${prefix}.path`);
    pushOptionalString(issues, asset.checksum, `${prefix}.checksum`);
    pushSha256(issues, asset.checksum, `${prefix}.checksum`);
    if (
      asset.checksumAlgorithm !== undefined &&
      !editorialVocabulary.assetChecksumAlgorithms.includes(asset.checksumAlgorithm)
    ) {
      issues.push(`${prefix}.checksumAlgorithm possui valor invalido`);
    }
    pushOptionalString(issues, asset.generatedBy, `${prefix}.generatedBy`);
    pushIsoDate(issues, asset.generatedAt, `${prefix}.generatedAt`);
    pushOptionalString(issues, asset.archivedBy, `${prefix}.archivedBy`);
    pushOptionalString(issues, asset.archiveReason, `${prefix}.archiveReason`);
    pushIsoDate(issues, asset.archivedAt, `${prefix}.archivedAt`);
    pushOptionalString(issues, asset.replacedByAssetId, `${prefix}.replacedByAssetId`);
    pushOptionalString(issues, asset.replacesAssetId, `${prefix}.replacesAssetId`);
    pushOptionalString(issues, asset.replacementReason, `${prefix}.replacementReason`);

    if (
      isNonEmptyString(asset.editionId) &&
      !editionIds.has(asset.editionId)
    ) {
      issues.push(`${prefix}.editionId referencia edicao inexistente`);
    }

    if (asset.type === "musicxml" && asset.path !== undefined) {
      if (!isSafePublicMusicXmlPath(asset.path)) {
        issues.push(`${prefix}.path deve apontar para caminho seguro em /musicxml/`);
      }
    }

    if (asset.status === "valido") {
      pushRequiredString(issues, asset.editionId, `${prefix}.editionId`);
      pushRequiredString(issues, asset.path, `${prefix}.path`);
      pushRequiredString(issues, asset.checksum, `${prefix}.checksum`);
      pushEnum(
        issues,
        asset.checksumAlgorithm,
        editorialVocabulary.assetChecksumAlgorithms,
        `${prefix}.checksumAlgorithm`,
      );
      pushRequiredString(issues, asset.generatedBy, `${prefix}.generatedBy`);
      if (asset.generatedAt === undefined) {
        issues.push(`${prefix}.generatedAt deve ser uma data ISO 8601 valida`);
      }
    }

    if (asset.status === "substituido") {
      pushRequiredString(issues, asset.replacedByAssetId, `${prefix}.replacedByAssetId`);
      pushRequiredString(issues, asset.replacementReason, `${prefix}.replacementReason`);
      pushRequiredString(issues, asset.path, `${prefix}.path`);
      pushRequiredString(issues, asset.checksum, `${prefix}.checksum`);
      pushEnum(
        issues,
        asset.checksumAlgorithm,
        editorialVocabulary.assetChecksumAlgorithms,
        `${prefix}.checksumAlgorithm`,
      );
    }
  });

  assets.forEach((asset, index) => {
    if (!isRecord(asset) || !isNonEmptyString(asset.id)) return;
    const prefix = `assets[${index}]`;

    if (isNonEmptyString(asset.replacedByAssetId)) {
      const successor = assets.find(
        (candidate) =>
          isRecord(candidate) && candidate.id === asset.replacedByAssetId,
      );
      if (!successor) {
        issues.push(`${prefix}.replacedByAssetId referencia asset inexistente`);
      } else if (successor.replacesAssetId !== asset.id) {
        issues.push(`${prefix}.replacedByAssetId deve apontar para asset sucessor reciproco`);
      }
    }

    if (isNonEmptyString(asset.replacesAssetId)) {
      const previous = assets.find(
        (candidate) =>
          isRecord(candidate) && candidate.id === asset.replacesAssetId,
      );
      if (!previous) {
        issues.push(`${prefix}.replacesAssetId referencia asset inexistente`);
      } else if (previous.status !== "substituido") {
        issues.push(`${prefix}.replacesAssetId deve apontar para asset substituido`);
      }
    }
  });
}

function validateEditions(issues, editions) {
  if (editions === undefined) return new Set();
  if (!Array.isArray(editions)) {
    issues.push("editions deve ser um array");
    return new Set();
  }

  const editionIds = new Set();
  editions.forEach((edition, index) => {
    const prefix = `editions[${index}]`;
    if (!isRecord(edition)) {
      issues.push(`${prefix} deve ser um objeto`);
      return;
    }

    pushUniqueId(issues, editionIds, edition.id, `${prefix}.id`);
    pushEnum(
      issues,
      edition.status,
      editorialVocabulary.editionStatuses,
      `${prefix}.status`,
    );
    pushOptionalString(issues, edition.title, `${prefix}.title`);
    pushOptionalString(issues, edition.encodedKey, `${prefix}.encodedKey`);
    pushStringArray(issues, edition.chords, `${prefix}.chords`);
    pushStringArray(issues, edition.tags, `${prefix}.tags`);
    [
      "genre",
      "instrumentation",
      "level",
      "notes",
      "publicCatalogId",
      "source",
    ].forEach((field) => {
      pushOptionalString(issues, edition[field], `${prefix}.${field}`);
    });
  });

  return editionIds;
}

function validateRights(issues, rights) {
  if (!isRecord(rights)) {
    issues.push("rights deve ser um objeto");
    return;
  }

  pushEnum(issues, rights.status, editorialVocabulary.rightsStatuses, "rights.status");

  if (!isRecord(rights.actions)) {
    issues.push("rights.actions deve ser um objeto");
    return;
  }

  Object.entries(rights.actions).forEach(([action, permission]) => {
    pushEnum(
      issues,
      action,
      editorialVocabulary.publicActions,
      `rights.actions.${action}`,
    );
    pushEnum(
      issues,
      permission,
      editorialVocabulary.rightsPermissions,
      `rights.actions.${action}`,
    );
  });
}

export function effectivePermission(rights, action) {
  const permission = rights?.actions?.[action] ?? "nao_avaliada";
  return permission === "nao_avaliada" ? "bloqueada" : permission;
}

export function currentCurationStatus(curation) {
  if (!curation?.currentDecisionId) {
    return curation?.status;
  }

  return (
    curation.decisions?.find(
      (decision) => decision.id === curation.currentDecisionId,
    )?.status ?? curation.status
  );
}

export function parseEditorialDossier(value) {
  const issues = [];

  if (!isRecord(value)) {
    throw new EditorialDossierValidationError(["dossie deve ser um objeto"]);
  }

  if (value.schemaVersion !== schemaVersion) {
    issues.push(`schemaVersion deve ser ${schemaVersion}`);
  }

  validateWork(issues, value.work);
  validateCuration(issues, value.curation);
  const sourceIds = validateSources(issues, value.sources);
  validateEvidence(issues, value.evidence, sourceIds);
  const editionIds = validateEditions(issues, value.editions);
  validateAssets(issues, value.assets, editionIds);
  validateRights(issues, value.rights);

  if (issues.length > 0) {
    throw new EditorialDossierValidationError(issues);
  }

  return value;
}
