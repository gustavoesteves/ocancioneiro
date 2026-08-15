import assert from "node:assert/strict";
import test from "node:test";
import { importCaptureReadiness } from "../app/import-capture-readiness.ts";

const ready = {
  dossierSelected: true,
  editionSelected: true,
  hasIdentityDifferences: false,
  identityConfirmed: false,
  privateCaptureConfirmed: false,
  responsibleProvided: true,
  saving: false,
};

test("explica cada requisito que ainda bloqueia a captura", () => {
  assert.equal(
    importCaptureReadiness({ ...ready, dossierSelected: false }).label,
    "Escolha um dossie de destino",
  );
  assert.equal(
    importCaptureReadiness({ ...ready, editionSelected: false }).label,
    "Selecione uma edicao editorial",
  );
  assert.equal(
    importCaptureReadiness({
      ...ready,
      hasIdentityDifferences: true,
      identityConfirmed: false,
    }).label,
    "Confirme as divergencias de identidade",
  );
  assert.equal(
    importCaptureReadiness({ ...ready, responsibleProvided: false }).label,
    "Informe o responsavel pela confirmacao",
  );
});

test("habilita somente quando todos os requisitos foram atendidos", () => {
  assert.deepEqual(importCaptureReadiness(ready), {
    disabled: false,
    guidance: null,
    label: "Confirmar captura privada",
  });
  assert.equal(
    importCaptureReadiness({ ...ready, saving: true }).disabled,
    true,
  );
  assert.equal(
    importCaptureReadiness({ ...ready, privateCaptureConfirmed: true }).disabled,
    true,
  );
});
