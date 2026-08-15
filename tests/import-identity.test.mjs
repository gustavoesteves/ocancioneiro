import assert from "node:assert/strict";
import test from "node:test";
import {
  importIdentityDifferences,
  normalizedImportIdentity,
} from "../lib/import-identity.mjs";

const dossier = {
  work: {
    preferredTitle: "Carinhoso",
    creators: [{ name: "Pixinguinha", role: "composer" }],
  },
};

test("normaliza acentos e caixa sem inventar equivalencia editorial", () => {
  assert.equal(normalizedImportIdentity("  João  "), "joao");
  assert.equal(
    importIdentityDifferences(
      { title: "CARINHOSO", composer: "Pixinguinha" },
      dossier,
    ).length,
    0,
  );
});

test("detecta divergencias independentes de titulo e compositor", () => {
  const title = importIdentityDifferences(
    { title: "Rosa", composer: "Pixinguinha" },
    dossier,
  );
  assert.equal(title.length, 1);
  assert.match(title[0], /Titulo capturado/);

  const composer = importIdentityDifferences(
    { title: "Carinhoso", composer: "Outro compositor" },
    dossier,
  );
  assert.equal(composer.length, 1);
  assert.match(composer[0], /Compositor capturado/);

  const both = importIdentityDifferences(
    { title: "Rosa", composer: "Outro compositor" },
    dossier,
  );
  assert.equal(both.length, 2);
});
