import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { GET } from "../app/api/import/review/route.ts";

test("review endpoint rejects public hosts and origins", async () => {
  const publicHost = await GET(new Request("https://example.com/api/import/review"));
  assert.equal(publicHost.status, 403);

  const publicOrigin = await GET(
    new Request("http://localhost:3000/api/import/review", {
      headers: { Origin: "https://example.com" },
    }),
  );
  assert.equal(publicOrigin.status, 403);
});

test("review endpoint exposes dossier coverage and contradictions", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cancioneiro-review-api-"));
  const previousRoot = process.env.CANCIONEIRO_PROJECT_ROOT;
  process.env.CANCIONEIRO_PROJECT_ROOT = root;
  try {
    await fs.mkdir(path.join(root, "data", "dossiers"), { recursive: true });
    await fs.mkdir(path.join(root, "public"), { recursive: true });
    await fs.writeFile(
      path.join(root, "data", "dossiers", "obra-fixture.json"),
      `${JSON.stringify({
        schemaVersion: 1,
        work: {
          creators: [{ name: "Autora Fixture", role: "composer" }],
          id: "obra-fixture",
          preferredTitle: "Obra fixture",
        },
        curation: { status: "em_pesquisa" },
        sources: [
          {
            id: "fonte-fixture",
            title: "Fonte fixture",
            type: "catalogo_ou_acervo",
          },
        ],
        evidence: [
          {
            assessedAt: "2026-08-15",
            assessedBy: "Pesquisadora Fixture",
            claim: "A obra circula.",
            criterion: "circulacao",
            direction: "sustenta",
            id: "evidencia-sustenta",
            justification: "Fonte positiva.",
            sources: [{ sourceId: "fonte-fixture" }],
            strength: "moderada",
            strengthJustification: "Fonte identificada.",
          },
          {
            assessedAt: "2026-08-15",
            assessedBy: "Pesquisadora Fixture",
            claim: "A circulacao e limitada.",
            criterion: "circulacao",
            direction: "contradiz",
            id: "evidencia-contradiz",
            justification: "Fonte limita a afirmacao.",
            sources: [{ sourceId: "fonte-fixture" }],
            strength: "fraca",
            strengthJustification: "Fonte contextual.",
          },
        ],
        editions: [],
        assets: [],
        rights: {
          actions: { exibir_metadados: "permitida" },
          status: "nao_verificado",
        },
      }, null, 2)}\n`,
    );

    const response = await GET(new Request("http://localhost:3000/api/import/review"));
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(
      body.coverage.rows.find((row) => row.criterion === "circulacao").contradiz,
      1,
    );
    assert.deepEqual(body.reviewReport[0].pending, [
      "sem decisao vigente",
      "evidencias contraditorias: circulacao",
    ]);
  } finally {
    if (previousRoot === undefined) delete process.env.CANCIONEIRO_PROJECT_ROOT;
    else process.env.CANCIONEIRO_PROJECT_ROOT = previousRoot;
    await fs.rm(root, { recursive: true, force: true });
  }
});
