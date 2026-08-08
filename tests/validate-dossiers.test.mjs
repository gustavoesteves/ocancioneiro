import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { currentCurationStatus } from "../lib/editorial-dossier.mjs";
import {
  dossierReviewReport,
  listDossierFiles,
  loadEditorialDossiers,
  validateAssetChecksums,
  validateMusicXmlAssets,
} from "../scripts/validate-dossiers.mjs";

const fixtureDossierDirectory = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "dossiers",
);

function dossier(id, title) {
  return {
    schemaVersion: 1,
    work: {
      creators: [{ name: "Autor", role: "composer" }],
      id,
      preferredTitle: title,
    },
    curation: {
      status: "candidata",
    },
    rights: {
      actions: {
        exibir_metadados: "permitida",
      },
      status: "nao_verificado",
    },
  };
}

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

function musicXml({ fifths = 0, harmony = true, title = "Fixture" } = {}) {
  return `<?xml version="1.0"?>
<score-partwise version="4.0">
  <work><work-title>${title}</work-title></work>
  <part-list><score-part id="P1"><part-name>Melodia</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions><key><fifths>${fifths}</fifths></key></attributes>
      ${
        harmony
          ? "<harmony><root><root-step>C</root-step></root><kind text=\"C\">major</kind></harmony>"
          : ""
      }
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
  </part>
</score-partwise>`;
}

async function writeMusicXmlFixture(xml) {
  const projectRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "o-cancioneiro-musicxml-assets-"),
  );
  const musicXmlDirectory = path.join(projectRoot, "public", "musicxml");
  await fs.mkdir(musicXmlDirectory, { recursive: true });
  await fs.writeFile(path.join(musicXmlDirectory, "fixture.musicxml"), xml);

  return projectRoot;
}

function musicXmlDossier(editionOverrides = {}) {
  return {
    dossier: {
      assets: [
        {
          editionId: "lead-sheet",
          id: "asset-musicxml",
          path: "/musicxml/fixture.musicxml",
          type: "musicxml",
        },
      ],
      editions: [
        {
          chords: ["C"],
          encodedKey: "C maior",
          id: "lead-sheet",
          status: "valida",
          title: "Fixture",
          ...editionOverrides,
        },
      ],
      work: {
        preferredTitle: "Fixture",
      },
    },
    filePath: "data/dossiers/fixture.json",
  };
}

test("loads the repository editorial dossiers", async () => {
  const loaded = await loadEditorialDossiers();

  assert.ok(
    loaded.some(({ dossier }) => dossier.work.id === "obra-carinhoso"),
  );
});

test(
  "loads lifecycle fixtures for candidate, accepted, rejected and inconclusive works",
  async () => {
    const loaded = await loadEditorialDossiers(fixtureDossierDirectory);
    const statuses = new Map(
      loaded.map(({ dossier }) => [
        dossier.work.id,
        currentCurationStatus(dossier.curation),
      ]),
    );

    assert.equal(loaded.length, 4);
    assert.equal(statuses.get("obra-fixture-candidata"), "candidata");
    assert.equal(statuses.get("obra-fixture-aceita"), "aceita");
    assert.equal(statuses.get("obra-fixture-rejeitada"), "rejeitada");
    assert.equal(statuses.get("obra-fixture-inconclusiva"), "inconclusiva");
  },
);

test("reports editorial review gaps without rejecting the dossier", async () => {
  const report = dossierReviewReport([
    {
      dossier: dossier("obra-sem-decisao", "Obra sem decisao"),
      filePath: "data/dossiers/obra-sem-decisao.json",
    },
  ]);
  report[0].pending.sort();

  assert.deepEqual(report, [
    {
      filePath: "data/dossiers/obra-sem-decisao.json",
      label: "obra-sem-decisao (Obra sem decisao)",
      pending: [
        "sem decisao vigente",
        "sem evidencias estruturadas",
        "sem fontes estruturadas",
      ],
    },
  ]);
});

test("reports evidence without source as an editorial review gap", () => {
  const report = dossierReviewReport([
    {
      dossier: {
        ...dossier("obra-evidencia-sem-fonte", "Obra com evidencia sem fonte"),
        evidence: [
          {
            assessedAt: "2026-08-07",
            assessedBy: "pesquisador",
            claim: "A obra aparece em repertorio de roda.",
            criterion: "circulacao",
            direction: "sustenta",
            id: "evidencia-sem-fonte",
            justification: "Rascunho aguardando fonte estruturada.",
            strength: "fraca",
            strengthJustification: "Sem fonte relacionada, portanto so pode ser fraca.",
          },
        ],
        sources: [
          {
            id: "fonte-nao-usada",
            title: "Fonte ainda nao relacionada",
            type: "songbook",
          },
        ],
      },
      filePath: "data/dossiers/obra-evidencia-sem-fonte.json",
    },
  ]);

  assert.ok(report[0].pending.includes("evidencia sem fonte: evidencia-sem-fonte"));
  assert.ok(!report[0].pending.includes("sem evidencias estruturadas"));
});

test("loads draft evidence without source for review reporting", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "o-cancioneiro-evidence-report-"),
  );

  await fs.writeFile(
    path.join(directory, "obra.json"),
    JSON.stringify(
      {
        ...dossier("obra-evidencia-sem-fonte", "Obra com evidencia sem fonte"),
        evidence: [
          {
            assessedAt: "2026-08-07",
            assessedBy: "pesquisador",
            claim: "A obra aparece em repertorio de roda.",
            criterion: "circulacao",
            direction: "sustenta",
            id: "evidencia-sem-fonte",
            justification: "Rascunho aguardando fonte estruturada.",
            strength: "fraca",
            strengthJustification: "Sem fonte relacionada, portanto so pode ser fraca.",
          },
        ],
      },
      null,
      2,
    ),
  );

  const loaded = await loadEditorialDossiers(directory);
  const report = dossierReviewReport(loaded);

  assert.equal(loaded[0].dossier.evidence[0].id, "evidencia-sem-fonte");
  assert.ok(report[0].pending.includes("evidencia sem fonte: evidencia-sem-fonte"));
});

test("reports contradictory evidence directions by criterion", () => {
  const report = dossierReviewReport([
    {
      dossier: {
        ...dossier("obra-evidencia-contraditoria", "Obra com conflito"),
        evidence: [
          {
            assessedAt: "2026-08-07",
            assessedBy: "pesquisador",
            claim: "A obra aparece em repertorio de roda.",
            criterion: "circulacao",
            direction: "sustenta",
            id: "evidencia-circulacao-sustenta",
            justification: "Fonte de repertorio local registra execucao.",
            sources: [{ sourceId: "fonte-roda", locator: "p. 4" }],
            strength: "moderada",
            strengthJustification: "Fonte direta, mas ainda isolada.",
          },
          {
            assessedAt: "2026-08-07",
            assessedBy: "pesquisador",
            claim: "A obra nao aparece no recorte de songbooks consultados.",
            criterion: "circulacao",
            direction: "contradiz",
            id: "evidencia-circulacao-contradiz",
            justification: "Ausencia recorrente em fontes comparaveis limita a afirmacao.",
            sources: [{ sourceId: "fonte-songbook", locator: "indice" }],
            strength: "fraca",
            strengthJustification: "Ausencia em indice e indiciaria, nao conclusiva.",
          },
        ],
        sources: [
          {
            id: "fonte-roda",
            title: "Relatorio de roda",
            type: "entrevista_ou_depoimento",
          },
          {
            id: "fonte-songbook",
            title: "Songbook consultado",
            type: "songbook",
          },
        ],
      },
      filePath: "data/dossiers/obra-evidencia-contraditoria.json",
    },
  ]);

  assert.ok(report[0].pending.includes("evidencias contraditorias: circulacao"));
});

test("treats a missing dossier directory as empty", async () => {
  const missingDirectory = path.join(
    os.tmpdir(),
    `o-cancioneiro-missing-${Date.now()}`,
  );

  assert.deepEqual(await listDossierFiles(missingDirectory), []);
  assert.deepEqual(await loadEditorialDossiers(missingDirectory), []);
});

test("rejects duplicate work ids across dossier files", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "o-cancioneiro-dossiers-"),
  );

  await fs.writeFile(
    path.join(directory, "a.json"),
    JSON.stringify(dossier("obra-duplicada", "A"), null, 2),
  );
  await fs.writeFile(
    path.join(directory, "b.json"),
    JSON.stringify(dossier("obra-duplicada", "B"), null, 2),
  );

  await assert.rejects(
    () => loadEditorialDossiers(directory),
    /duplica work\.id obra-duplicada/,
  );
});

test("validates declared MusicXML asset checksums against public files", async () => {
  const projectRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "o-cancioneiro-assets-"),
  );
  const musicXmlDirectory = path.join(projectRoot, "public", "musicxml");
  await fs.mkdir(musicXmlDirectory, { recursive: true });
  const xml = "<score-partwise version=\"4.0\"></score-partwise>";
  await fs.writeFile(path.join(musicXmlDirectory, "fixture.musicxml"), xml);

  await validateAssetChecksums(
    [
      {
        dossier: {
          assets: [
            {
              checksum: sha256(xml),
              checksumAlgorithm: "sha256",
              id: "asset-ok",
              path: "/musicxml/fixture.musicxml",
            },
          ],
        },
        filePath: "data/dossiers/fixture.json",
      },
    ],
    { projectRoot },
  );
});

test("rejects MusicXML assets with divergent checksums", async () => {
  const projectRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "o-cancioneiro-assets-"),
  );
  const musicXmlDirectory = path.join(projectRoot, "public", "musicxml");
  await fs.mkdir(musicXmlDirectory, { recursive: true });
  await fs.writeFile(
    path.join(musicXmlDirectory, "fixture.musicxml"),
    "<score-partwise version=\"4.0\"></score-partwise>",
  );

  await assert.rejects(
    () =>
      validateAssetChecksums(
        [
          {
            dossier: {
              assets: [
                {
                  checksum: "a".repeat(64),
                  checksumAlgorithm: "sha256",
                  id: "asset-divergente",
                  path: "/musicxml/fixture.musicxml",
                },
              ],
            },
            filePath: "data/dossiers/fixture.json",
          },
        ],
        { projectRoot },
      ),
    /asset-divergente checksum divergente/,
  );
});

test("validates MusicXML metadata against the declared edition", async () => {
  const projectRoot = await writeMusicXmlFixture(
    musicXml({ fifths: 0, harmony: true, title: "Fixture" }),
  );

  await validateMusicXmlAssets([musicXmlDossier()], { projectRoot });
});

test("rejects MusicXML assets with title or key mismatches", async () => {
  const projectRoot = await writeMusicXmlFixture(
    musicXml({ fifths: 1, harmony: true, title: "Outro titulo" }),
  );

  await assert.rejects(
    () => validateMusicXmlAssets([musicXmlDossier()], { projectRoot }),
    (error) => {
      assert.match(error.message, /titulo MusicXML difere da edicao/);
      assert.match(error.message, /tonalidade MusicXML difere da edicao/);
      return true;
    },
  );
});

test("requires harmony elements when the edition declares chords", async () => {
  const projectRoot = await writeMusicXmlFixture(
    musicXml({ fifths: 0, harmony: false, title: "Fixture" }),
  );

  await assert.rejects(
    () => validateMusicXmlAssets([musicXmlDossier()], { projectRoot }),
    /edicao declara cifras mas MusicXML nao contem <harmony>/,
  );
});
