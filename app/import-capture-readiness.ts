export type ImportCaptureReadinessInput = {
  dossierSelected: boolean;
  editionSelected: boolean;
  hasIdentityDifferences: boolean;
  identityConfirmed: boolean;
  privateCaptureConfirmed: boolean;
  responsibleProvided: boolean;
  saving: boolean;
};

export type ImportCaptureReadiness = {
  disabled: boolean;
  guidance: string | null;
  label: string;
};

export function importCaptureReadiness({
  dossierSelected,
  editionSelected,
  hasIdentityDifferences,
  identityConfirmed,
  privateCaptureConfirmed,
  responsibleProvided,
  saving,
}: ImportCaptureReadinessInput): ImportCaptureReadiness {
  if (saving) {
    return { disabled: true, guidance: null, label: "Gravando..." };
  }
  if (privateCaptureConfirmed) {
    return {
      disabled: true,
      guidance: null,
      label: "Captura privada confirmada",
    };
  }
  if (!dossierSelected) {
    return {
      disabled: true,
      guidance: "Escolha uma obra no acervo como dossie de destino.",
      label: "Escolha um dossie de destino",
    };
  }
  if (!editionSelected) {
    return {
      disabled: true,
      guidance: "Selecione uma edicao no painel do dossie escolhido.",
      label: "Selecione uma edicao editorial",
    };
  }
  if (hasIdentityDifferences && !identityConfirmed) {
    return {
      disabled: true,
      guidance: "Confira e confirme as divergencias de titulo ou autoria.",
      label: "Confirme as divergencias de identidade",
    };
  }
  if (!responsibleProvided) {
    return {
      disabled: true,
      guidance: "Informe o responsavel pela confirmacao desta captura.",
      label: "Informe o responsavel pela confirmacao",
    };
  }

  return {
    disabled: false,
    guidance: null,
    label: "Confirmar captura privada",
  };
}
