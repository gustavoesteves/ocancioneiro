import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  buildCatalog,
  buildSongEntry,
  chordsFromMusicXml,
  decodeXml,
  editorialTodoReport,
  fallbackIdFromFile,
  matchExistingEntries,
  sourceHash,
  validateEditorialManifest,
} from "../scripts/generate-catalog.mjs";
import { decisionRecordHash } from "../lib/editorial-dossier.mjs";

const permittedActions = {
  exibir_metadados: "permitida",
  exibir_partitura: "permitida",
  reproduzir_playback: "permitida",
  imprimir: "permitida",
  distribuir_musicxml: "permitida",
};

function musicXml({ composer = "Novo compositor", fifths = 2 } = {}) {
  return `<?xml version="1.0"?>
<score-partwise version="4.0">
  <work><work-title>Novo titulo</work-title></work>
  <identification><creator type="composer">${composer}</creator></identification>
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1"><measure number="1"><attributes><divisions>1</divisions><key><fifths>${fifths}</fifths></key></attributes><harmony><root><root-step>D</root-step></root><kind text="Dm7">minor-seventh</kind></harmony></measure></part>
</score-partwise>`;
}

test("refreshes source metadata while applying editorial fields", () => {
  const xml = musicXml();
  const filePath = path.join(
    process.cwd(),
    "public",
    "musicxml",
    "estudo.musicxml",
  );
  const existing = {
    id: "id-estavel",
    title: "Titulo antigo",
    composer: "Compositor antigo",
    genre: "Choro",
    key: "C maior",
    level: "Intermediario",
    instrumentation: "Violao",
    source: "Fonte editorial",
    musicxml: "/musicxml/estudo.musicxml",
    notes: "Nota editorial",
    tags: ["brasileiro"],
  };
  const editorialManifest = {
    "id-estavel": {
      genre: "Samba",
      level: "Avancado",
      notes: "Nota do manifesto",
      source: "Manifesto editorial",
      tags: ["manifesto"],
    },
  };

  const generated = buildSongEntry(
    filePath,
    xml,
    existing,
    sourceHash(xml),
    editorialManifest,
  );

  assert.equal(generated.id, "id-estavel");
  assert.equal(generated.title, "Novo titulo");
  assert.equal(generated.composer, "Novo compositor");
  assert.equal(generated.key, "D maior");
  assert.equal(generated.instrumentation, "Piano");
  assert.deepEqual(generated.chords, ["Dm7"]);
  assert.equal(generated.genre, "Samba");
  assert.equal(generated.level, "Avancado");
  assert.equal(generated.notes, "Nota do manifesto");
  assert.equal(generated.source, "Manifesto editorial");
  assert.deepEqual(generated.tags, ["manifesto"]);
});

test("uses MusicXML credits for catalog title and composer placeholders", () => {
  const xml = `<?xml version="1.0"?>
<score-partwise version="4.0">
  <work><work-title>Untitled score</work-title></work>
  <identification><creator type="composer">Composer / arranger</creator></identification>
  <credit page="1">
    <credit-type>title</credit-type>
    <credit-words>Ain&apos;t it the truth</credit-words>
  </credit>
  <credit page="1">
    <credit-type>composer</credit-type>
    <credit-words>Gerry Mulligan</credit-words>
  </credit>
  <part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list>
  <part id="P1"><measure number="1"><attributes><divisions>1</divisions></attributes></measure></part>
</score-partwise>`;
  const filePath = path.join(
    process.cwd(),
    "public",
    "musicxml",
    "aint-it-the-truth.musicxml",
  );

  const generated = buildSongEntry(filePath, xml, undefined, sourceHash(xml));

  assert.equal(generated.title, "Ain't it the truth");
  assert.equal(generated.composer, "Gerry Mulligan");
  assert.equal(generated.id, "aint-it-the-truth");
});

test("falls back to existing editorial fields during migration", () => {
  const xml = musicXml();
  const filePath = path.join(
    process.cwd(),
    "public",
    "musicxml",
    "estudo.musicxml",
  );
  const existing = {
    id: "id-estavel",
    genre: "Choro",
    level: "Intermediario",
    musicxml: "/musicxml/estudo.musicxml",
    notes: "Nota editorial",
    source: "Fonte editorial",
    tags: ["brasileiro"],
  };

  const generated = buildSongEntry(filePath, xml, existing, sourceHash(xml));

  assert.equal(generated.genre, "Choro");
  assert.equal(generated.level, "Intermediario");
  assert.equal(generated.notes, "Nota editorial");
  assert.equal(generated.source, "Fonte editorial");
  assert.deepEqual(generated.tags, ["brasileiro"]);
});

test("extracts unique chord symbols from MusicXML harmony elements", () => {
  const xml = `<?xml version="1.0"?>
<score-partwise version="4.0">
  <part id="P1">
    <measure number="1">
      <harmony>
        <root><root-step>C</root-step></root>
        <kind text="">major</kind>
      </harmony>
      <harmony>
        <root><root-step>F</root-step><root-alter>1</root-alter></root>
        <kind text="F#m7">minor-seventh</kind>
        <bass><bass-step>A</bass-step></bass>
      </harmony>
      <harmony>
        <root><root-step>E</root-step><root-alter>-1</root-alter></root>
        <kind text="m7">minor-seventh</kind>
      </harmony>
      <harmony>
        <root><root-step>F</root-step><root-alter>1</root-alter></root>
        <kind text="F#m7">minor-seventh</kind>
        <bass><bass-step>A</bass-step></bass>
      </harmony>
    </measure>
  </part>
</score-partwise>`;

  assert.deepEqual(chordsFromMusicXml(xml), ["C", "F#m7/A", "Ebm7"]);
});

test("derives ids from relative paths and decodes XML entities once", () => {
  const rootFile = path.join(
    process.cwd(),
    "public",
    "musicxml",
    "peca.musicxml",
  );
  const nestedFile = path.join(
    process.cwd(),
    "public",
    "musicxml",
    "subdir",
    "peca.musicxml",
  );

  assert.equal(fallbackIdFromFile(rootFile, "a".repeat(64)), "peca");
  assert.equal(
    fallbackIdFromFile(nestedFile, "b".repeat(64)),
    "subdir-peca",
  );
  assert.equal(decodeXml("Jo&#227;o &amp; Maria"), "João & Maria");
  assert.equal(decodeXml("&amp;lt;"), "&lt;");
});

test("keeps stable identity and editorial data when a file moves", () => {
  const existing = {
    id: "id-estavel",
    title: "Estudo",
    composer: "Compositor",
    genre: "Choro",
    key: "C maior",
    level: "Inicial",
    instrumentation: "Piano",
    source: "Acervo",
    musicxml: "/musicxml/pasta-antiga/estudo.musicxml",
    notes: "Nota editorial",
    tags: ["brasileiro"],
    sourceHash: "a".repeat(64),
  };
  const movedInput = {
    publicPath: "/musicxml/pasta-nova/estudo.musicxml",
    hash: "a".repeat(64),
  };

  const matches = matchExistingEntries([movedInput], [existing]);
  assert.equal(matches.get(movedInput.publicPath), existing);
});

test("validates editorial manifest fields", () => {
  const manifest = {
    songs: {
      estudo: {
        genre: "Estudo",
        level: "Inicial",
        notes: "",
        source: "Acervo",
        tags: ["piano"],
      },
    },
  };

  assert.deepEqual(validateEditorialManifest(manifest), manifest.songs);

  assert.throws(
    () =>
      validateEditorialManifest({
        songs: {
          estudo: {
            genre: "",
            level: "Inicial",
            typo: "valor",
          },
        },
      }),
    /Manifesto editorial invalido/,
  );

  assert.throws(
    () =>
      validateEditorialManifest({
        songs: {
          estudo: {
            tags: ["ok", ""],
          },
        },
      }),
    /tags deve ser um array/,
  );
});

test("reports editorial metadata still using defaults", () => {
  const songs = [
    {
      id: "nova-peca",
      title: "Nova peca",
      composer: "Compositor",
      genre: "Nao classificado",
      key: "C maior",
      level: "Nao classificado",
      instrumentation: "Melodia",
      source: "Acervo",
      musicxml: "/musicxml/nova-peca.musicxml",
      notes: "",
      chords: ["C"],
      tags: [],
    },
    {
      id: "peca-parcial",
      title: "Peca parcial",
      composer: "Compositor",
      genre: "Choro",
      key: "D maior",
      level: "Nao classificado",
      instrumentation: "Melodia",
      source: "Acervo",
      musicxml: "/musicxml/peca-parcial.musicxml",
      notes: "",
      chords: ["D"],
      tags: ["brasileiro"],
    },
    {
      id: "peca-completa",
      title: "Peca completa",
      composer: "Compositor",
      genre: "Samba",
      key: "F maior",
      level: "Intermediario",
      instrumentation: "Melodia",
      source: "Fonte",
      musicxml: "/musicxml/peca-completa.musicxml",
      notes: "Revisada.",
      chords: ["F"],
      tags: ["samba"],
    },
  ];
  const manifest = {
    "peca-parcial": {
      genre: "Choro",
      tags: ["brasileiro"],
    },
    "peca-completa": {
      genre: "Samba",
      level: "Intermediario",
      notes: "Revisada.",
      source: "Fonte",
      tags: ["samba"],
    },
  };

  assert.deepEqual(editorialTodoReport(songs, manifest), [
    {
      defaultFields: ["genre", "level", "source", "notes", "tags"],
      hasEditorialEntry: false,
      id: "nova-peca",
      title: "Nova peca",
    },
    {
      defaultFields: ["level", "source", "notes"],
      hasEditorialEntry: true,
      id: "peca-parcial",
      title: "Peca parcial",
    },
  ]);
});

test("omits ungoverned legacy files from the public catalog", () => {
  const generatedSongs = [
    {
      id: "asa-branca",
      title: "Asa branca",
      composer: "Luiz Gonzaga",
      genre: "Baiao",
      key: "C maior",
      level: "Inicial",
      instrumentation: "Melodia",
      source: "Acervo",
      musicxml: "/musicxml/asa-branca.musicxml",
      notes: "",
      chords: ["C"],
      tags: ["baiao"],
    },
  ];
  const catalog = buildCatalog(generatedSongs, [
    {
      schemaVersion: 1,
      work: {
        id: "obra-carinhoso",
        preferredTitle: "Carinhoso",
        creators: [{ name: "Pixinguinha", role: "composer" }],
      },
      curation: { status: "candidata" },
      rights: {
        status: "nao_verificado",
        actions: { exibir_metadados: "permitida" },
      },
    },
  ]);

  assert.deepEqual(catalog.songs, []);
});

test("prefers publicable dossier projections over matching generated entries", () => {
  const decision = {
    id: "decisao-aceita",
    status: "aceita",
    justification: "Obra aceita para publicacao.",
    decidedBy: "bancada-editorial",
    decidedAt: "2026-08-07",
    reviews: [
      {
        conflictOfInterest: false,
        reviewedAt: "2026-08-07",
        reviewedBy: "revisor-fixture",
        role: "membro-da-bancada",
        summary: "Revisao independente da decisao aceita.",
      },
    ],
  };
  const generatedSongs = [
    {
      id: "carinhoso",
      title: "Titulo vindo do XML",
      composer: "Composer / arranger",
      genre: "Nao classificado",
      key: "C maior",
      level: "Nao classificado",
      instrumentation: "Piano",
      source: "Acervo",
      musicxml: "/musicxml/carinhoso.musicxml",
      notes: "",
      chords: ["C"],
      tags: [],
    },
  ];
  const catalog = buildCatalog(generatedSongs, [
    {
      schemaVersion: 1,
      publicCatalogId: "carinhoso",
      work: {
        id: "obra-carinhoso",
        preferredTitle: "Carinhoso",
        creators: [{ name: "Pixinguinha", role: "composer" }],
      },
      curation: {
        status: "em_revisao",
        currentDecisionId: "decisao-aceita",
        decisions: [
          {
            ...decision,
            recordHash: decisionRecordHash(decision),
          },
        ],
      },
      editions: [
        {
          id: "lead-sheet",
          status: "valida",
          title: "Carinhoso",
          encodedKey: "F maior",
          genre: "Choro",
          level: "Intermediario",
          instrumentation: "Melodia e cifras",
          source: "Dossie editorial revisado",
          notes: "Versao editorial.",
          chords: ["F", "C7"],
          tags: ["choro"],
        },
      ],
      assets: [
        {
          id: "asset-carinhoso",
          editionId: "lead-sheet",
          type: "musicxml",
          status: "valido",
          path: "/musicxml/carinhoso.musicxml",
          checksum: "a".repeat(64),
          checksumAlgorithm: "sha256",
          generatedAt: "2026-08-07",
          generatedBy: "fixture",
        },
      ],
      rights: {
        status: "liberado",
        actions: permittedActions,
      },
    },
  ]);

  assert.equal(catalog.songs.length, 1);
  assert.equal(catalog.songs[0].title, "Carinhoso");
  assert.equal(catalog.songs[0].composer, "Pixinguinha");
  assert.equal(catalog.songs[0].source, "Dossie editorial revisado");
});
