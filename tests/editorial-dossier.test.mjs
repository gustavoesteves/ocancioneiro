import assert from "node:assert/strict";
import test from "node:test";
import {
  EditorialDossierValidationError,
  currentCurationStatus,
  decisionRecordHash,
  effectivePermission,
  parseEditorialDossier,
} from "../lib/editorial-dossier.mjs";

function minimalDossier(overrides = {}) {
  return {
    schemaVersion: 1,
    work: {
      creators: [{ name: "Pixinguinha", role: "composer" }],
      id: "obra-carinhoso",
      preferredTitle: "Carinhoso",
    },
    curation: {
      canonicalClaims: [
        {
          centrality: "nuclear",
          context: "choro",
          justification: "Ausencia dificil de justificar no repertorio de choro.",
          reach: "comunidade",
        },
      ],
      status: "candidata",
    },
    rights: {
      actions: {
        exibir_metadados: "permitida",
        distribuir_musicxml: "nao_avaliada",
      },
      status: "nao_verificado",
    },
    ...overrides,
  };
}

test("accepts a work dossier without edition or MusicXML asset", () => {
  const dossier = minimalDossier();

  assert.equal(parseEditorialDossier(dossier).work.id, "obra-carinhoso");
  assert.equal(
    effectivePermission(dossier.rights, "distribuir_musicxml"),
    "bloqueada",
  );
});

test("rejects unknown controlled vocabulary values", () => {
  assert.throws(
    () =>
      parseEditorialDossier(
        minimalDossier({
          curation: { status: "publicada" },
        }),
      ),
    /curation.status possui valor invalido/,
  );
});

test("rejects unknown creator roles", () => {
  assert.throws(
    () =>
      parseEditorialDossier(
        minimalDossier({
          work: {
            creators: [{ name: "Pixinguinha", role: "genius" }],
            id: "obra-carinhoso",
            preferredTitle: "Carinhoso",
          },
        }),
      ),
    /work\.creators\[0\]\.role possui valor invalido/,
  );
});

test("derives curation status from the current decision", () => {
  const decision = {
    decidedAt: "2026-08-07",
    decidedBy: "bancada-editorial",
    id: "decisao-001",
    justification: "Fixture de decisao vigente.",
    reviews: [
      {
        conflictOfInterest: false,
        reviewedAt: "2026-08-07",
        reviewedBy: "revisor-independente",
        role: "membro-da-bancada",
        summary: "Revisao independente da decisao.",
      },
    ],
    status: "aceita",
  };
  const dossier = parseEditorialDossier(
    minimalDossier({
      curation: {
        currentDecisionId: decision.id,
        decisions: [
          {
            ...decision,
            recordHash: decisionRecordHash(decision),
          },
        ],
        status: "em_revisao",
      },
    }),
  );

  assert.equal(currentCurationStatus(dossier.curation), "aceita");
});

test("accepts multiple contextual canonical claims for the same work", () => {
  const dossier = parseEditorialDossier(
    minimalDossier({
      curation: {
        canonicalClaims: [
          {
            centrality: "nuclear",
            context: "choro",
            justification: "Ausencia dificil de justificar no repertorio de choro.",
            reach: "comunidade",
          },
          {
            centrality: "consolidada",
            context: "musica_brasileira",
            justification: "Circulacao ampla em repertorio brasileiro documentado.",
            reach: "nacional",
          },
        ],
        status: "candidata",
      },
    }),
  );

  assert.deepEqual(
    dossier.curation.canonicalClaims.map((claim) => [
      claim.context,
      claim.centrality,
      claim.reach,
    ]),
    [
      ["choro", "nuclear", "comunidade"],
      ["musica_brasileira", "consolidada", "nacional"],
    ],
  );
});

test("requires decided canonical claims to reference evidence", () => {
  assert.throws(
    () =>
      parseEditorialDossier(
        minimalDossier({
          curation: {
            canonicalClaims: [
              {
                centrality: "nuclear",
                context: "choro",
                decisionId: "decisao-001",
                justification: "Afirmacao decidida precisa apontar evidencias.",
                reach: "comunidade",
              },
            ],
            currentDecisionId: "decisao-001",
            decisions: [
              {
                decidedAt: "2026-08-07",
                decidedBy: "bancada-editorial",
                id: "decisao-001",
                justification: "Fixture de decisao vigente.",
                status: "aceita",
              },
            ],
            status: "em_revisao",
          },
        }),
      ),
    /canonicalClaims\[0\]\.evidenceIds deve conter ao menos uma evidencia relacionada/,
  );
});

test("rejects canonical claims referencing missing evidence", () => {
  assert.throws(
    () =>
      parseEditorialDossier(
        minimalDossier({
          curation: {
            canonicalClaims: [
              {
                centrality: "nuclear",
                context: "choro",
                evidenceIds: ["evidencia-ausente"],
                justification: "Afirmacao com referencia quebrada.",
                reach: "comunidade",
              },
            ],
            status: "candidata",
          },
        }),
      ),
    /canonicalClaims\[0\]\.evidenceIds\[0\] referencia evidencia inexistente/,
  );
});

test("accepts immutable decision records with a matching hash", () => {
  const decision = {
    decidedAt: "2026-08-07",
    decidedBy: "bancada-editorial",
    id: "decisao-001",
    justification: "Fixture de decisao vigente.",
    reviews: [
      {
        conflictOfInterest: false,
        reviewedAt: "2026-08-07",
        reviewedBy: "revisor-independente",
        role: "membro-da-bancada",
        summary: "Revisao independente da decisao.",
      },
    ],
    status: "aceita",
  };
  const dossier = parseEditorialDossier(
    minimalDossier({
      curation: {
        currentDecisionId: decision.id,
        decisions: [
          {
            ...decision,
            recordHash: decisionRecordHash(decision),
          },
        ],
        status: "em_revisao",
      },
    }),
  );

  assert.equal(dossier.curation.decisions[0].recordHash, decisionRecordHash(decision));
});

test("accepts musical locators on curation decisions", () => {
  const decision = {
    decidedAt: "2026-08-07",
    decidedBy: "bancada-editorial",
    id: "decisao-com-localizador",
    justification: "Emenda localizada em trecho ambíguo da lead sheet.",
    locators: [
      {
        beat: "2",
        endMeasure: 9,
        measure: 8,
        note: "cifra alternativa no segundo tempo",
        voice: "melodia",
      },
    ],
    reviews: [
      {
        conflictOfInterest: false,
        reviewedAt: "2026-08-07",
        reviewedBy: "revisor-independente",
        role: "membro-da-bancada",
        summary: "Localizador confere com o trecho revisado.",
      },
    ],
    status: "aceita",
  };

  const dossier = parseEditorialDossier(
    minimalDossier({
      curation: {
        currentDecisionId: decision.id,
        decisions: [
          {
            ...decision,
            recordHash: decisionRecordHash(decision),
          },
        ],
        status: "em_revisao",
      },
    }),
  );

  assert.equal(dossier.curation.decisions[0].locators[0].measure, 8);
  assert.equal(dossier.curation.decisions[0].locators[0].endMeasure, 9);
});

test("rejects invalid musical locators on curation decisions", () => {
  const decision = {
    decidedAt: "2026-08-07",
    decidedBy: "bancada-editorial",
    id: "decisao-localizador-invalido",
    justification: "Decisao com localizadores invalidos.",
    locators: [
      { measure: 0 },
      { endMeasure: 3, measure: 4 },
      { measure: 5, voice: 2 },
    ],
    status: "em_revisao",
  };

  assert.throws(
    () =>
      parseEditorialDossier(
        minimalDossier({
          curation: {
            decisions: [decision],
            status: "em_revisao",
          },
        }),
      ),
    (error) => {
      assert.match(error.message, /decisions\[0\]\.locators\[0\]\.measure/);
      assert.match(
        error.message,
        /decisions\[0\]\.locators\[1\]\.endMeasure deve ser maior ou igual/,
      );
      assert.match(error.message, /decisions\[0\]\.locators\[2\]\.voice deve ser texto/);
      return true;
    },
  );
});

test("requires accepted decisions to include review records", () => {
  const decision = {
    decidedAt: "2026-08-07",
    decidedBy: "bancada-editorial",
    id: "decisao-001",
    justification: "Fixture de decisao aceita sem revisao.",
    status: "aceita",
  };

  assert.throws(
    () =>
      parseEditorialDossier(
        minimalDossier({
          curation: {
            currentDecisionId: "decisao-001",
            decisions: [
              {
                ...decision,
                recordHash: decisionRecordHash(decision),
              },
            ],
            status: "em_revisao",
          },
        }),
      ),
    /decisions\[0\]\.reviews deve conter ao menos uma revisao/,
  );
});

test("requires final decisions to be sealed with a record hash", () => {
  assert.throws(
    () =>
      parseEditorialDossier(
        minimalDossier({
          curation: {
            currentDecisionId: "decisao-001",
            decisions: [
              {
                decidedAt: "2026-08-07",
                decidedBy: "bancada-editorial",
                id: "decisao-001",
                justification: "Fixture de decisao rejeitada sem selo.",
                status: "rejeitada",
              },
            ],
            status: "em_revisao",
          },
        }),
      ),
    /decisions\[0\]\.recordHash deve selar decisao final publicada/,
  );
});

test("requires conflict descriptions when a decision review declares conflict", () => {
  assert.throws(
    () =>
      parseEditorialDossier(
        minimalDossier({
          curation: {
            currentDecisionId: "decisao-001",
            decisions: [
              {
                decidedAt: "2026-08-07",
                decidedBy: "bancada-editorial",
                id: "decisao-001",
                justification: "Fixture de decisao aceita.",
                reviews: [
                  {
                    conflictOfInterest: true,
                    reviewedAt: "2026-08-07",
                    reviewedBy: "revisor-com-vinculo",
                    role: "membro-da-bancada",
                    summary: "Revisao com conflito declarado.",
                  },
                ],
                status: "aceita",
              },
            ],
            status: "em_revisao",
          },
        }),
      ),
    /reviews\[0\]\.conflictDescription deve ser texto nao vazio/,
  );
});

test("rejects changed decision records with stale hashes", () => {
  const decision = {
    decidedAt: "2026-08-07",
    decidedBy: "bancada-editorial",
    id: "decisao-001",
    justification: "Fixture de decisao vigente.",
    reviews: [
      {
        conflictOfInterest: false,
        reviewedAt: "2026-08-07",
        reviewedBy: "revisor-independente",
        role: "membro-da-bancada",
        summary: "Revisao independente da decisao.",
      },
    ],
    status: "aceita",
  };

  assert.throws(
    () =>
      parseEditorialDossier(
        minimalDossier({
          curation: {
            currentDecisionId: decision.id,
            decisions: [
              {
                ...decision,
                justification: "Texto alterado depois do selo.",
                recordHash: decisionRecordHash(decision),
              },
            ],
            status: "em_revisao",
          },
        }),
      ),
    /recordHash nao confere com o registro da decisao/,
  );
});

test("rejects a current decision id without matching decision", () => {
  assert.throws(
    () =>
      parseEditorialDossier(
        minimalDossier({
          curation: {
            currentDecisionId: "decisao-ausente",
            decisions: [],
            status: "em_revisao",
          },
        }),
      ),
    /curation\.currentDecisionId referencia decisao inexistente/,
  );
});

test("rejects dossiers without schema version", () => {
  const dossier = minimalDossier();
  delete dossier.schemaVersion;

  assert.throws(
    () => parseEditorialDossier(dossier),
    /schemaVersion deve ser 1/,
  );
});

test("requires declared evidence sources to reference declared sources", () => {
  const dossier = minimalDossier({
    evidence: [
      {
        assessedAt: "2026-08-07",
        assessedBy: "pesquisador",
        claim: "A obra aparece em repertorio de roda.",
        criterion: "circulacao",
        direction: "sustenta",
        id: "ev-001",
        justification: "Testemunho usado como fixture.",
        sources: [{ sourceId: "fonte-ausente", locator: "p. 12" }],
        strength: "moderada",
        strengthJustification: "Fonte secundaria, mas util para testar referencia.",
      },
    ],
    sources: [
      {
        id: "fonte-presente",
        title: "Songbook de teste",
        type: "songbook",
      },
    ],
  });

  assert.throws(
    () => parseEditorialDossier(dossier),
    /sourceId referencia fonte inexistente/,
  );
});

test("accepts draft evidence without sources for review reporting", () => {
  const dossier = parseEditorialDossier(
    minimalDossier({
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
    }),
  );

  assert.equal(dossier.evidence[0].id, "evidencia-sem-fonte");
  assert.equal(dossier.evidence[0].sources, undefined);
});

test("accepts many-to-many evidence references with structured locators", () => {
  const dossier = parseEditorialDossier(
    minimalDossier({
      evidence: [
        {
          assessedAt: "2026-08-07",
          assessedBy: "pesquisador",
          claim: "A obra aparece em fonte impressa e fonografica.",
          criterion: "circulacao",
          direction: "sustenta",
          id: "evidencia-circulacao",
          justification: "Fontes independentes apontam para circulacao.",
          sources: [
            {
              sourceId: "fonte-songbook",
              locators: [{ type: "pagina", value: "p. 12" }],
            },
            {
              sourceId: "fonte-gravacao",
              locators: [{ type: "faixa", value: "faixa 3" }],
            },
          ],
          strength: "moderada",
          strengthJustification: "Duas fontes independentes, mas ainda sem revisao externa.",
        },
        {
          assessedAt: "2026-08-07",
          assessedBy: "pesquisador",
          claim: "A mesma fonte impressa registra atribuicao autoral.",
          criterion: "representatividade",
          direction: "contextualiza",
          id: "evidencia-atribuicao",
          justification: "A fonte e util para contexto, sem decidir sozinha.",
          sources: [
            {
              sourceId: "fonte-songbook",
              locators: [
                { type: "pagina", value: "p. 2" },
                { type: "item_acervo", value: "catalogo-123" },
              ],
            },
          ],
          strength: "fraca",
          strengthJustification: "Uma unica fonte contextual nao decide atribuicao.",
        },
      ],
      sources: [
        {
          id: "fonte-songbook",
          title: "Songbook de teste",
          type: "songbook",
        },
        {
          id: "fonte-gravacao",
          title: "Gravacao de teste",
          type: "gravacao",
        },
      ],
    }),
  );

  assert.equal(dossier.evidence[0].sources.length, 2);
  assert.equal(dossier.evidence[1].sources[0].locators[1].type, "item_acervo");
});

test("rejects invalid structured evidence locators", () => {
  assert.throws(
    () =>
      parseEditorialDossier(
        minimalDossier({
          evidence: [
            {
              assessedAt: "2026-08-07",
              assessedBy: "pesquisador",
              claim: "A fonte tem localizacao imprecisa.",
              criterion: "circulacao",
              direction: "sustenta",
              id: "evidencia-localizador",
              justification: "Fixture invalida.",
              sources: [
                {
                  sourceId: "fonte-songbook",
                  locators: [
                    { type: "capitulo", value: "cap. 1" },
                    { type: "pagina", value: "" },
                  ],
                },
              ],
              strength: "moderada",
              strengthJustification: "Localizadores invalidos devem impedir uso da forca.",
            },
          ],
          sources: [
            {
              id: "fonte-songbook",
              title: "Songbook de teste",
              type: "songbook",
            },
          ],
        }),
      ),
    (error) => {
      assert.ok(error instanceof EditorialDossierValidationError);
      assert.match(
        error.message,
        /evidence\[0\]\.sources\[0\]\.locators\[0\]\.type possui valor invalido/,
      );
      assert.match(
        error.message,
        /evidence\[0\]\.sources\[0\]\.locators\[1\]\.value deve ser texto nao vazio/,
      );
      return true;
    },
  );
});

test("accepts source persistent identifiers for deduplication", () => {
  const dossier = parseEditorialDossier(
    minimalDossier({
      sources: [
        {
          id: "fonte-discografia",
          persistentId: "discografia-brasileira:38213",
          title: "Carinhoso",
          type: "fonte_digital",
          url: "https://discografiabrasileira.com.br/fonograma/38213/-",
        },
        {
          id: "fonte-radio",
          persistentId: "ims-radio-batuta:ouve-essa-carinhoso",
          title: "Ouve essa: Carinhoso",
          type: "fonte_digital",
          url: "https://radiobatuta.ims.com.br/programas/ouve-essa/carinhoso",
        },
      ],
    }),
  );

  assert.equal(dossier.sources[0].persistentId, "discografia-brasileira:38213");
});

test("rejects duplicate source persistent identifiers", () => {
  assert.throws(
    () =>
      parseEditorialDossier(
        minimalDossier({
          sources: [
            {
              id: "fonte-discografia-a",
              persistentId: "discografia-brasileira:38213",
              title: "Carinhoso",
              type: "fonte_digital",
            },
            {
              id: "fonte-discografia-b",
              persistentId: "discografia-brasileira:38213",
              title: "Carinhoso duplicado",
              type: "fonte_digital",
            },
          ],
        }),
      ),
    /sources\[1\]\.persistentId duplicado: discografia-brasileira:38213/,
  );
});

test("rejects evidence strength without specific justification", () => {
  assert.throws(
    () =>
      parseEditorialDossier(
        minimalDossier({
          evidence: [
            {
              assessedAt: "2026-08-07",
              assessedBy: "pesquisador",
              claim: "A obra aparece em repertorio de roda.",
              criterion: "circulacao",
              direction: "sustenta",
              id: "evidencia-sem-justificativa-de-forca",
              justification: "A afirmacao geral esta descrita.",
              strength: "forte",
            },
          ],
        }),
      ),
    /evidence\[0\]\.strengthJustification deve ser texto nao vazio/,
  );
});

test("collects validation issues for invalid nested entities", () => {
  assert.throws(
    () =>
      parseEditorialDossier(
        minimalDossier({
          assets: [{ id: "asset-1", status: "valido", type: "midi" }],
          rights: { actions: { baixar_pdf: "talvez" }, status: "liberado" },
        }),
      ),
    (error) => {
      assert.ok(error instanceof EditorialDossierValidationError);
      assert.match(error.message, /assets\[0\]\.type possui valor invalido/);
      assert.match(error.message, /rights\.actions\.baixar_pdf/);
      return true;
    },
  );
});

test("requires valid assets to be versioned and tied to an edition", () => {
  assert.throws(
    () =>
      parseEditorialDossier(
        minimalDossier({
          assets: [
            {
              checksum: "not-a-sha",
              checksumAlgorithm: "md5",
              generatedAt: "hoje",
              id: "asset-1",
              path: "/musicxml/../segredo.musicxml",
              status: "valido",
              type: "musicxml",
            },
          ],
          editions: [{ id: "lead-sheet", status: "valida" }],
        }),
      ),
    (error) => {
      assert.ok(error instanceof EditorialDossierValidationError);
      assert.match(error.message, /assets\[0\]\.checksum deve ser um SHA-256/);
      assert.match(error.message, /assets\[0\]\.checksumAlgorithm possui valor invalido/);
      assert.match(error.message, /assets\[0\]\.generatedAt deve ser uma data ISO 8601 valida/);
      assert.match(error.message, /assets\[0\]\.path deve apontar para caminho seguro/);
      assert.match(error.message, /assets\[0\]\.editionId deve ser texto nao vazio/);
      assert.match(error.message, /assets\[0\]\.generatedBy deve ser texto nao vazio/);
      return true;
    },
  );
});

test("rejects assets pointing to missing editions", () => {
  assert.throws(
    () =>
      parseEditorialDossier(
        minimalDossier({
          assets: [
            {
              checksum: "a".repeat(64),
              checksumAlgorithm: "sha256",
              editionId: "edicao-ausente",
              generatedAt: "2026-08-07",
              generatedBy: "fixture",
              id: "asset-1",
              path: "/musicxml/carinhoso.musicxml",
              status: "valido",
              type: "musicxml",
            },
          ],
          editions: [{ id: "lead-sheet", status: "valida" }],
        }),
      ),
    /assets\[0\]\.editionId referencia edicao inexistente/,
  );
});

test("accepts explicit asset replacement chains", () => {
  const dossier = parseEditorialDossier(
    minimalDossier({
      assets: [
        {
          checksum: "a".repeat(64),
          checksumAlgorithm: "sha256",
          editionId: "lead-sheet",
          id: "asset-antigo",
          path: "/musicxml/carinhoso-v1.musicxml",
          replacedByAssetId: "asset-novo",
          replacementReason: "Correcao de cifra no compasso 8.",
          status: "substituido",
          type: "musicxml",
        },
        {
          checksum: "b".repeat(64),
          checksumAlgorithm: "sha256",
          editionId: "lead-sheet",
          generatedAt: "2026-08-07",
          generatedBy: "fixture",
          id: "asset-novo",
          path: "/musicxml/carinhoso-v2.musicxml",
          replacesAssetId: "asset-antigo",
          status: "valido",
          type: "musicxml",
        },
      ],
      editions: [{ id: "lead-sheet", status: "valida" }],
    }),
  );

  assert.equal(dossier.assets[0].status, "substituido");
  assert.equal(dossier.assets[1].replacesAssetId, "asset-antigo");
});

test("rejects silent or inconsistent asset replacement chains", () => {
  assert.throws(
    () =>
      parseEditorialDossier(
        minimalDossier({
          assets: [
            {
              checksum: "a".repeat(64),
              checksumAlgorithm: "sha256",
              id: "asset-antigo",
              path: "/musicxml/carinhoso-v1.musicxml",
              replacedByAssetId: "asset-ausente",
              status: "substituido",
              type: "musicxml",
            },
            {
              checksum: "b".repeat(64),
              checksumAlgorithm: "sha256",
              editionId: "lead-sheet",
              generatedAt: "2026-08-07",
              generatedBy: "fixture",
              id: "asset-novo",
              path: "/musicxml/carinhoso-v2.musicxml",
              replacesAssetId: "asset-nao-substituido",
              status: "valido",
              type: "musicxml",
            },
            {
              id: "asset-nao-substituido",
              status: "pendente",
              type: "musicxml",
            },
          ],
          editions: [{ id: "lead-sheet", status: "valida" }],
        }),
      ),
    (error) => {
      assert.ok(error instanceof EditorialDossierValidationError);
      assert.match(error.message, /assets\[0\]\.replacementReason deve ser texto nao vazio/);
      assert.match(error.message, /assets\[0\]\.replacedByAssetId referencia asset inexistente/);
      assert.match(error.message, /assets\[1\]\.replacesAssetId deve apontar para asset substituido/);
      return true;
    },
  );
});

test("aceita somente excecao instrumental original documentada para piano ou violao", () => {
  const dossier = parseEditorialDossier(
    minimalDossier({
      editions: [
        {
          id: "edicao-original",
          notationProfile: {
            instrument: "violao",
            justification:
              "A escrita original para violao integra a identidade da obra.",
            kind: "partitura_instrumental_original",
          },
          status: "valida",
        },
      ],
    }),
  );
  assert.equal(dossier.editions[0].notationProfile.instrument, "violao");

  assert.throws(
    () =>
      parseEditorialDossier(
        minimalDossier({
          editions: [
            {
              id: "edicao-arranjo",
              notationProfile: {
                instrument: "orquestra",
                justification: "Arranjo posterior.",
                kind: "partitura_instrumental_original",
              },
              status: "valida",
            },
          ],
        }),
      ),
    /notationProfile\.instrument possui valor invalido/,
  );
});
