import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  GET,
  PATCH,
  POST,
} from "../app/api/import/dossiers/[workId]/research/route.ts";

function dossier() {
  return {
    schemaVersion: 1,
    work: {
      creators: [{ name: "Autora Fixture", role: "composer" }],
      id: "obra-fixture",
      preferredTitle: "Obra fixture",
    },
    curation: { status: "em_pesquisa" },
    sources: [],
    evidence: [],
    editions: [],
    assets: [],
    rights: {
      actions: { exibir_metadados: "permitida" },
      status: "nao_verificado",
    },
  };
}

async function fixtureRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cancioneiro-research-"));
  await fs.mkdir(path.join(root, "data", "dossiers"), { recursive: true });
  await fs.mkdir(path.join(root, "public"), { recursive: true });
  await fs.writeFile(
    path.join(root, "data", "dossiers", "obra-fixture.json"),
    `${JSON.stringify(dossier(), null, 2)}\n`,
  );
  await fs.writeFile(
    path.join(root, "public", "catalog.json"),
    `${JSON.stringify({ schemaVersion: 2, songs: [] })}\n`,
  );
  return root;
}

const context = { params: Promise.resolve({ workId: "obra-fixture" }) };

function request(fingerprint, overrides = {}) {
  return new Request(
    "http://localhost:3000/api/import/dossiers/obra-fixture/research",
    {
      body: JSON.stringify({
        canonicalClaim: {
          centrality: "contextual",
          context: "choro",
          justification: "A fonte documenta presenca continuada no repertorio.",
          reach: "nacional",
        },
        evidence: {
          assessedBy: "Pesquisadora Fixture",
          claim: "A obra circula no repertorio documentado.",
          criterion: "circulacao",
          direction: "sustenta",
          justification: "Registro institucional reencontravel.",
          locator: "verbete principal",
          strength: "moderada",
          strengthJustification: "A fonte e institucional e identificada.",
        },
        expectedFingerprint: fingerprint,
        source: {
          accessedAt: "2026-08-15",
          title: "Catalogo fixture",
          type: "catalogo_ou_acervo",
          url: "https://example.org/catalogo",
        },
        ...overrides,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    },
  );
}

test("research endpoint rejects public hosts", async () => {
  const response = await GET(
    new Request("https://example.com/api/import/dossiers/obra-fixture/research"),
    context,
  );
  assert.equal(response.status, 403);
});

test("registra pesquisa ligada com concorrencia otimista", async () => {
  const root = await fixtureRoot();
  const previousRoot = process.env.CANCIONEIRO_PROJECT_ROOT;
  process.env.CANCIONEIRO_PROJECT_ROOT = root;
  try {
    const initialResponse = await GET(
      new Request("http://localhost:3000/api/import/dossiers/obra-fixture/research"),
      context,
    );
    const initial = await initialResponse.json();
    const updateResponse = await POST(request(initial.fingerprint), context);
    const updated = await updateResponse.json();

    assert.equal(updateResponse.status, 200);
    assert.equal(updated.updated, true);
    assert.equal(updated.sources.length, 1);
    assert.equal(updated.evidence.length, 1);
    assert.equal(updated.canonicalClaims.length, 1);

    const staleResponse = await POST(request(initial.fingerprint), context);
    assert.equal(staleResponse.status, 409);
  } finally {
    if (previousRoot === undefined) delete process.env.CANCIONEIRO_PROJECT_ROOT;
    else process.env.CANCIONEIRO_PROJECT_ROOT = previousRoot;
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("reutiliza fonte existente sem criar duplicata", async () => {
  const root = await fixtureRoot();
  const previousRoot = process.env.CANCIONEIRO_PROJECT_ROOT;
  process.env.CANCIONEIRO_PROJECT_ROOT = root;
  try {
    const initialResponse = await GET(
      new Request("http://localhost:3000/api/import/dossiers/obra-fixture/research"),
      context,
    );
    const initial = await initialResponse.json();
    const firstResponse = await POST(request(initial.fingerprint), context);
    const first = await firstResponse.json();
    const sourceId = first.sources[0].id;

    const secondResponse = await POST(
      request(first.fingerprint, {
        evidence: {
          assessedBy: "Pesquisadora Fixture",
          claim: "A mesma fonte sustenta outro criterio editorial.",
          criterion: "valor_historico",
          direction: "sustenta",
          justification: "O registro institucional tambem contextualiza a historia.",
          locator: "verbete historico",
          strength: "moderada",
          strengthJustification: "A fonte permanece identificada e reencontravel.",
        },
        existingSourceId: sourceId,
        source: undefined,
      }),
      context,
    );
    const second = await secondResponse.json();

    assert.equal(secondResponse.status, 200);
    assert.equal(second.sources.length, 1);
    assert.equal(second.evidence.length, 2);
    assert.equal(second.evidence[1].sources[0].sourceId, sourceId);
  } finally {
    if (previousRoot === undefined) delete process.env.CANCIONEIRO_PROJECT_ROOT;
    else process.env.CANCIONEIRO_PROJECT_ROOT = previousRoot;
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("registra historico de correcao por PATCH com concorrencia otimista", async () => {
  const root = await fixtureRoot();
  const previousRoot = process.env.CANCIONEIRO_PROJECT_ROOT;
  process.env.CANCIONEIRO_PROJECT_ROOT = root;
  try {
    const initialResponse = await GET(
      new Request("http://localhost:3000/api/import/dossiers/obra-fixture/research"),
      context,
    );
    const initial = await initialResponse.json();
    const firstResponse = await POST(request(initial.fingerprint), context);
    const first = await firstResponse.json();
    const sourceId = first.sources[0].id;

    const historyResponse = await PATCH(
      new Request(
        "http://localhost:3000/api/import/dossiers/obra-fixture/research",
        {
          body: JSON.stringify({
            expectedFingerprint: first.fingerprint,
            reason: "Fonte revisada e referencia normalizada.",
            recordedBy: "Pesquisadora Fixture",
            targetId: sourceId,
            targetType: "source",
            type: "correcao",
          }),
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        },
      ),
      context,
    );
    const history = await historyResponse.json();

    assert.equal(historyResponse.status, 200);
    assert.equal(history.researchEvents.length, 1);
    assert.equal(history.researchEvents[0].targetId, sourceId);
    assert.equal(history.sources.length, 1);
  } finally {
    if (previousRoot === undefined) delete process.env.CANCIONEIRO_PROJECT_ROOT;
    else process.env.CANCIONEIRO_PROJECT_ROOT = previousRoot;
    await fs.rm(root, { recursive: true, force: true });
  }
});
