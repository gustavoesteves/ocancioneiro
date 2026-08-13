import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { currentCurationStatus } from "../lib/editorial-dossier.mjs";
import {
  decisionRevisionDiffs,
  dossierReviewReport,
  evidenceCoverageMatrix,
  formatDossierForReview,
  leadSheetScopeFindings,
  leadSheetScopeReport,
  listDossierFiles,
  loadEditorialDossiers,
  validateAssetChecksums,
  validateMusicXmlAssets,
  writeDossierReviewFiles,
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

test("reports canonical claims without related evidence", () => {
  const report = dossierReviewReport([
    {
      dossier: {
        ...dossier("obra-afirmacao-sem-evidencia", "Obra com afirmacao"),
        curation: {
          canonicalClaims: [
            {
              centrality: "nuclear",
              context: "choro",
              justification: "Hipotese ainda sem evidencia relacionada.",
              reach: "comunidade",
            },
          ],
          status: "candidata",
        },
      },
      filePath: "data/dossiers/obra-afirmacao-sem-evidencia.json",
    },
  ]);

  assert.ok(
    report[0].pending.includes("afirmacao canonica sem evidencias relacionadas"),
  );
});

test("reports final decisions without independent review", () => {
  const report = dossierReviewReport([
    {
      dossier: {
        ...dossier("obra-sem-revisao-independente", "Obra sem revisao independente"),
        curation: {
          currentDecisionId: "decisao-sem-independente",
          decisions: [
            {
              decidedAt: "2026-08-13",
              decidedBy: "bancada-editorial",
              id: "decisao-sem-independente",
              rationale: "Decisao final ainda sem uma revisao independente.",
              reviews: [
                {
                  conflictOfInterest: false,
                  reviewedAt: "2026-08-13",
                  reviewedBy: "bancada-editorial",
                  role: "revisao-editorial",
                  summary: "Revisao registrada pela mesma pessoa da decisao.",
                },
              ],
              status: "aceita",
            },
          ],
          status: "aceita",
        },
      },
      filePath: "data/dossiers/obra-sem-revisao-independente.json",
    },
  ]);

  assert.ok(
    report[0].pending.includes(
      "decisao sem revisao independente: decisao-sem-independente",
    ),
  );
});

test("does not report final decisions with independent review", () => {
  const report = dossierReviewReport([
    {
      dossier: {
        ...dossier("obra-com-revisao-independente", "Obra com revisao independente"),
        curation: {
          currentDecisionId: "decisao-com-independente",
          decisions: [
            {
              decidedAt: "2026-08-13",
              decidedBy: "bancada-editorial",
              id: "decisao-com-independente",
              rationale: "Decisao final com revisao independente registrada.",
              reviews: [
                {
                  conflictOfInterest: false,
                  reviewedAt: "2026-08-13",
                  reviewedBy: "revisor-independente",
                  role: "revisao-editorial",
                  summary: "Revisao independente registrada.",
                },
              ],
              status: "aceita",
            },
          ],
          status: "aceita",
        },
      },
      filePath: "data/dossiers/obra-com-revisao-independente.json",
    },
  ]);

  assert.ok(
    !report[0].pending.includes(
      "decisao sem revisao independente: decisao-com-independente",
    ),
  );
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

test("generates an explicit evidence coverage matrix without percentages", () => {
  const matrix = evidenceCoverageMatrix([
    {
      dossier: {
        ...dossier("obra-a", "Obra A"),
        evidence: [
          {
            assessedAt: "2026-08-07",
            assessedBy: "pesquisador",
            claim: "A obra permanece em uso.",
            criterion: "permanencia",
            direction: "sustenta",
            id: "evidencia-permanencia-a",
            justification: "Fonte registra uso continuado.",
            sources: [{ sourceId: "fonte-a", locator: "p. 1" }],
            strength: "moderada",
            strengthJustification: "Fonte direta, mas unica.",
          },
          {
            assessedAt: "2026-08-07",
            assessedBy: "pesquisador",
            claim: "A circulacao e limitada no recorte consultado.",
            criterion: "circulacao",
            direction: "contradiz",
            id: "evidencia-circulacao-a",
            justification: "Fonte comparativa nao registra a obra.",
            sources: [{ sourceId: "fonte-a", locator: "indice" }],
            strength: "fraca",
            strengthJustification: "Ausencia em indice nao e prova conclusiva.",
          },
        ],
        sources: [
          {
            id: "fonte-a",
            title: "Fonte A",
            type: "songbook",
          },
        ],
      },
      filePath: "a.json",
    },
    {
      dossier: {
        ...dossier("obra-b", "Obra B"),
        evidence: [
          {
            assessedAt: "2026-08-07",
            assessedBy: "pesquisador",
            claim: "A obra aparece em outra fonte.",
            criterion: "permanencia",
            direction: "contextualiza",
            id: "evidencia-permanencia-b",
            justification: "Fonte qualifica o periodo de uso.",
            sources: [{ sourceId: "fonte-b", locator: "p. 3" }],
            strength: "fraca",
            strengthJustification: "Contextualiza, mas nao sustenta sozinha.",
          },
        ],
        sources: [
          {
            id: "fonte-b",
            title: "Fonte B",
            type: "songbook",
          },
        ],
      },
      filePath: "b.json",
    },
  ]);

  const permanencia = matrix.rows.find((row) => row.criterion === "permanencia");
  const circulacao = matrix.rows.find((row) => row.criterion === "circulacao");
  const influencia = matrix.rows.find((row) => row.criterion === "influencia");

  assert.equal(matrix.method.percentages, false);
  assert.match(matrix.method.counting, /Cada evidencia conta uma vez/);
  assert.deepEqual(permanencia, {
    criterion: "permanencia",
    contextualiza: 1,
    contradiz: 0,
    evidenceCount: 2,
    sustenta: 1,
    workCount: 2,
    workIds: ["obra-a", "obra-b"],
  });
  assert.equal(circulacao.contradiz, 1);
  assert.equal(circulacao.workCount, 1);
  assert.equal(influencia.evidenceCount, 0);
  assert.equal(influencia.workCount, 0);
});

test("generates readable diffs between decision revisions", () => {
  const diffs = decisionRevisionDiffs({
    curation: {
      decisions: [
        {
          decidedAt: "2026-08-07",
          decidedBy: "pesquisador",
          id: "decisao-rascunho",
          justification: "Evidencia ainda insuficiente.",
          status: "em_revisao",
        },
        {
          decidedAt: "2026-08-08",
          decidedBy: "bancada",
          id: "decisao-aceita",
          justification: "Evidencias sustentam a entrada no recorte.",
          locators: [
            {
              beat: "2",
              measure: 8,
              note: "emenda de cifra",
            },
          ],
          reviews: [
            {
              conflictOfInterest: false,
              reviewedAt: "2026-08-08",
              reviewedBy: "revisor",
              role: "membro-da-bancada",
              summary: "Revisao favoravel.",
            },
          ],
          status: "aceita",
        },
      ],
    },
  });

  assert.deepEqual(diffs, [
    {
      changes: [
        { after: "aceita", before: "em_revisao", field: "status" },
        {
          after: "Evidencias sustentam a entrada no recorte.",
          before: "Evidencia ainda insuficiente.",
          field: "justificativa",
        },
        { after: "bancada", before: "pesquisador", field: "responsavel" },
        { after: "2026-08-08", before: "2026-08-07", field: "data" },
        {
          after: "compasso 8, tempo 2, emenda de cifra",
          before: "Nenhum localizador",
          field: "localizadores",
        },
        {
          after: "revisor (membro-da-bancada, conflito: nao)",
          before: "Nenhuma revisao",
          field: "revisoes",
        },
      ],
      from: "decisao-rascunho",
      to: "decisao-aceita",
    },
  ]);
});

test("formats a readable dossier for human review", () => {
  const formatted = formatDossierForReview(
    {
      dossier: {
        ...dossier("obra-revisao", "Obra para revisao"),
        curation: {
          canonicalClaims: [
            {
              centrality: "nuclear",
              context: "choro",
              decisionId: "decisao-revisao",
              justification: "Caso usado para revisar o formato.",
              reach: "comunidade",
            },
          ],
          currentDecisionId: "decisao-revisao",
          decisions: [
            {
              decidedAt: "2026-08-07",
              decidedBy: "pesquisador",
              id: "decisao-rascunho",
              justification: "Entrada ainda em revisao.",
              status: "em_revisao",
            },
            {
              decidedAt: "2026-08-08",
              decidedBy: "bancada",
              id: "decisao-revisao",
              justification: "Entrada em revisao documental.",
              locators: [
                {
                  endMeasure: 4,
                  measure: 3,
                  voice: "melodia",
                },
              ],
              status: "em_revisao",
            },
          ],
          status: "em_revisao",
        },
        evidence: [
          {
            assessedAt: "2026-08-08",
            assessedBy: "pesquisador",
            claim: "A obra aparece em fonte conferivel.",
            criterion: "circulacao",
            direction: "sustenta",
            id: "evidencia-revisao",
            justification: "Fonte lista a obra no repertorio.",
            sources: [
              {
                locators: [{ note: "indice alfabetico", type: "pagina", value: "12" }],
                sourceId: "fonte-revisao",
              },
            ],
            strength: "moderada",
            strengthJustification: "Fonte direta, mas ainda isolada.",
          },
        ],
        sources: [
          {
            id: "fonte-revisao",
            persistentId: "acervo:123",
            title: "Fonte de revisao",
            type: "catalogo_ou_acervo",
          },
        ],
      },
      filePath: "data/dossiers/obra-revisao.json",
    },
    ["conferir segunda fonte independente"],
  );

  assert.match(formatted, /^# Obra para revisao/m);
  assert.match(formatted, /## Pendencias Para Revisao/);
  assert.match(formatted, /conferir segunda fonte independente/);
  assert.match(formatted, /## Diff Entre Decisoes/);
  assert.match(formatted, /decisao-rascunho -> decisao-revisao/);
  assert.match(formatted, /Localizadores: compassos 3-4, voz melodia/);
  assert.match(formatted, /Fonte de revisao \(fonte-revisao\) \[pagina: 12/);
  assert.match(formatted, /evidencia-revisao: circulacao \/ sustenta \/ moderada/);
});

test("writes review dossiers as markdown files", async () => {
  const outputDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "o-cancioneiro-review-"),
  );
  const entry = {
    dossier: dossier("obra-arquivo-revisao", "Obra Arquivo Revisao"),
    filePath: "data/dossiers/obra-arquivo-revisao.json",
  };

  const written = await writeDossierReviewFiles([entry], {
    outputDirectory,
    reviewReport: [
      {
        filePath: entry.filePath,
        label: "obra-arquivo-revisao (Obra Arquivo Revisao)",
        pending: ["sem fonte independente"],
      },
    ],
  });

  assert.deepEqual(written, [path.join(outputDirectory, "obra-arquivo-revisao.md")]);
  assert.match(
    await fs.readFile(written[0], "utf8"),
    /# Obra Arquivo Revisao[\s\S]*sem fonte independente/,
  );
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

test("reports MusicXML content potentially outside lead sheet scope", () => {
  const findings = leadSheetScopeFindings(`<?xml version="1.0"?>
<score-partwise version="4.0">
  <part-list>
    <score-part id="P1"><part-name>Melodia</part-name></score-part>
    <score-part id="P2"><part-name>Piano</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <direction><direction-type><words>Intro livre</words></direction-type></direction>
      <note><pitch><step>C</step><octave>4</octave></pitch><voice>1</voice><duration>1</duration></note>
      <note><chord/><pitch><step>E</step><octave>4</octave></pitch><voice>2</voice><duration>1</duration></note>
      <note><rest/><lyric><text>la</text></lyric><duration>1</duration></note>
      <figured-bass><figure><figure-number>6</figure-number></figure></figured-bass>
    </measure>
  </part>
</score-partwise>`);

  assert.deepEqual(findings, [
    "mais de uma pauta/parte (2)",
    "multiplas vozes (1, 2)",
    "notas simultaneas escritas (1)",
    "direcoes interpretativas ou de arranjo (1)",
    "letra no MusicXML (1)",
    "baixo cifrado ou realizacao harmonica (1)",
  ]);
});

test("builds a lead sheet scope report for valid MusicXML assets", async () => {
  const projectRoot = await writeMusicXmlFixture(`<?xml version="1.0"?>
<score-partwise version="4.0">
  <part-list>
    <score-part id="P1"><part-name>Melodia</part-name></score-part>
    <score-part id="P2"><part-name>Piano</part-name></score-part>
  </part-list>
  <part id="P1"><measure number="1"><note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note></measure></part>
</score-partwise>`);

  const report = await leadSheetScopeReport(
    [
      {
        dossier: {
          ...dossier("obra-arranjo", "Obra com arranjo"),
          assets: [
            {
              id: "asset-arranjo",
              path: "/musicxml/fixture.musicxml",
              status: "valido",
              type: "musicxml",
            },
          ],
        },
        filePath: "data/dossiers/obra-arranjo.json",
      },
    ],
    { projectRoot },
  );

  assert.deepEqual(report, [
    {
      assetId: "asset-arranjo",
      filePath: "data/dossiers/obra-arranjo.json",
      findings: ["mais de uma pauta/parte (2)"],
      label: "obra-arranjo (Obra com arranjo)",
      path: "/musicxml/fixture.musicxml",
    },
  ]);
});
