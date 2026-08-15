import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  GET,
  PUT,
} from "../app/api/import/dossiers/[workId]/route.ts";
import { publicCatalogFromDossiers } from "../lib/dossier-catalog-projection.mjs";
import { decisionRecordHash } from "../lib/editorial-dossier.mjs";

function fixtureMusicXml() {
  return `<?xml version="1.0"?>
<score-partwise version="4.0">
  <work><work-title>Obra fixture</work-title></work>
  <identification><creator type="composer">Autora Fixture</creator></identification>
  <part-list><score-part id="P1"><part-name>Melodia</part-name></score-part></part-list>
  <part id="P1"><measure number="1"><attributes><divisions>1</divisions></attributes><harmony><root><root-step>C</root-step></root><kind text="C">major</kind></harmony><note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note></measure></part>
</score-partwise>`;
}

function fixtureDossier(xml) {
  const decision = {
    decidedAt: "2026-08-15",
    decidedBy: "Editora Fixture",
    id: "decisao-fixture",
    justification: "Fixture sintetica aceita para testar o editor de metadados.",
    reviews: [{
      conflictOfInterest: false,
      reviewedAt: "2026-08-15",
      reviewedBy: "Revisora Independente",
      role: "revisao-editorial",
      summary: "Fixture revisada independentemente.",
    }],
    status: "aceita",
  };
  const checksum = createHash("sha256").update(xml).digest("hex");
  return {
    schemaVersion: 1,
    publicCatalogId: "obra-fixture",
    work: {
      creators: [{ name: "Autora Fixture", role: "composer" }],
      id: "obra-fixture",
      preferredTitle: "Obra fixture",
    },
    curation: {
      currentDecisionId: decision.id,
      decisions: [{ ...decision, recordHash: decisionRecordHash(decision) }],
      status: "aceita",
    },
    sources: [],
    evidence: [],
    editions: [{
      chords: ["C"],
      encodedKey: "C maior",
      genre: "Nao classificado",
      id: "edicao-fixture",
      instrumentation: "Melodia",
      level: "Nao classificado",
      notes: "Fixture sintetica.",
      publicCatalogId: "obra-fixture",
      source: "Fonte fixture",
      status: "valida",
      tags: [],
      title: "Obra fixture",
    }],
    assets: [{
      checksum,
      checksumAlgorithm: "sha256",
      editionId: "edicao-fixture",
      generatedAt: "2026-08-15",
      generatedBy: "teste",
      id: "asset-fixture",
      path: "/musicxml/fixture/asset-fixture.musicxml",
      status: "valido",
      type: "musicxml",
    }],
    rights: {
      status: "liberado",
      actions: {
        baixar_pdf: "nao_avaliada",
        distribuir_musicxml: "permitida",
        exibir_metadados: "permitida",
        exibir_partitura: "permitida",
        imprimir: "permitida",
        reproduzir_playback: "permitida",
      },
    },
  };
}

async function fixtureRoot({ brokenMusicXml = false } = {}) {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cancioneiro-edition-"));
  await fs.mkdir(path.join(projectRoot, "data", "dossiers"), { recursive: true });
  await fs.mkdir(path.join(projectRoot, "public", "musicxml", "fixture"), { recursive: true });
  const xml = fixtureMusicXml();
  const dossier = fixtureDossier(xml);
  await fs.writeFile(
    path.join(projectRoot, "data", "dossiers", "obra-fixture.json"),
    `${JSON.stringify(dossier, null, 2)}\n`,
  );
  await fs.writeFile(
    path.join(projectRoot, "public", "musicxml", "fixture", "asset-fixture.musicxml"),
    xml,
  );
  await fs.writeFile(
    path.join(projectRoot, "public", "catalog.json"),
    `${JSON.stringify(publicCatalogFromDossiers([dossier]), null, 2)}\n`,
  );
  if (brokenMusicXml) {
    await fs.writeFile(
      path.join(projectRoot, "public", "musicxml", "broken.musicxml"),
      "nao e MusicXML",
    );
  }
  return projectRoot;
}

function context() {
  return { params: Promise.resolve({ workId: "obra-fixture" }) };
}

function putRequest(fingerprint, genre = "Baiao") {
  return new Request(
    "http://localhost:3000/api/import/dossiers/obra-fixture",
    {
      body: JSON.stringify({
        editionId: "edicao-fixture",
        expectedFingerprint: fingerprint,
        genre,
        level: "Intermediario",
        notes: "Metadados revisados em fixture.",
        source: "Fonte editorial fixture",
        tags: ["baiao", "nordeste"],
      }),
      headers: { "Content-Type": "application/json" },
      method: "PUT",
    },
  );
}

test("edition endpoint rejects public hosts before filesystem access", async () => {
  const response = await GET(
    new Request("https://example.com/api/import/dossiers/obra-fixture"),
    context(),
  );
  assert.equal(response.status, 403);
});

test("atualiza dossie e catalogo sem tocar no MusicXML", async () => {
  const projectRoot = await fixtureRoot();
  const previousRoot = process.env.CANCIONEIRO_PROJECT_ROOT;
  process.env.CANCIONEIRO_PROJECT_ROOT = projectRoot;

  try {
    const initialResponse = await GET(
      new Request("http://localhost:3000/api/import/dossiers/obra-fixture"),
      context(),
    );
    const initial = await initialResponse.json();
    const musicXmlPath = path.join(
      projectRoot,
      "public",
      "musicxml",
      "fixture",
      "asset-fixture.musicxml",
    );
    const musicXmlBefore = await fs.readFile(musicXmlPath);

    const updateResponse = await PUT(putRequest(initial.fingerprint), context());
    const updated = await updateResponse.json();
    assert.equal(updateResponse.status, 200);
    assert.equal(updated.updated, true);

    const dossier = JSON.parse(
      await fs.readFile(
        path.join(projectRoot, "data", "dossiers", "obra-fixture.json"),
        "utf8",
      ),
    );
    const edition = dossier.editions.find((item) => item.id === "edicao-fixture");
    const catalog = JSON.parse(
      await fs.readFile(path.join(projectRoot, "public", "catalog.json"), "utf8"),
    );
    assert.equal(edition.genre, "Baiao");
    assert.deepEqual(edition.tags, ["baiao", "nordeste"]);
    assert.equal(catalog.songs[0].genre, "Baiao");
    assert.deepEqual(await fs.readFile(musicXmlPath), musicXmlBefore);
    await assert.rejects(
      () => fs.access(path.join(projectRoot, "data", "editorial.json")),
      /ENOENT/,
    );

    const staleResponse = await PUT(putRequest(initial.fingerprint, "Forro"), context());
    const stale = await staleResponse.json();
    assert.equal(staleResponse.status, 409);
    assert.equal(stale.code, "DOSSIER_CHANGED");
  } finally {
    if (previousRoot === undefined) delete process.env.CANCIONEIRO_PROJECT_ROOT;
    else process.env.CANCIONEIRO_PROJECT_ROOT = previousRoot;
    await fs.rm(projectRoot, { recursive: true, force: true });
  }
});

test("restaura dossie e catalogo quando a regeneracao falha", async () => {
  const projectRoot = await fixtureRoot({ brokenMusicXml: true });
  const previousRoot = process.env.CANCIONEIRO_PROJECT_ROOT;
  process.env.CANCIONEIRO_PROJECT_ROOT = projectRoot;
  const dossierPath = path.join(projectRoot, "data", "dossiers", "obra-fixture.json");
  const catalogPath = path.join(projectRoot, "public", "catalog.json");

  try {
    const [dossierBefore, catalogBefore] = await Promise.all([
      fs.readFile(dossierPath, "utf8"),
      fs.readFile(catalogPath, "utf8"),
    ]);
    const initialResponse = await GET(
      new Request("http://localhost:3000/api/import/dossiers/obra-fixture"),
      context(),
    );
    const initial = await initialResponse.json();
    const updateResponse = await PUT(putRequest(initial.fingerprint), context());

    assert.equal(updateResponse.status, 500);
    assert.equal(await fs.readFile(dossierPath, "utf8"), dossierBefore);
    assert.equal(await fs.readFile(catalogPath, "utf8"), catalogBefore);
  } finally {
    if (previousRoot === undefined) delete process.env.CANCIONEIRO_PROJECT_ROOT;
    else process.env.CANCIONEIRO_PROJECT_ROOT = previousRoot;
    await fs.rm(projectRoot, { recursive: true, force: true });
  }
});
