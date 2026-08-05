import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  buildSongEntry,
  decodeXml,
  fallbackIdFromFile,
  matchExistingEntries,
  sourceHash,
} from "../scripts/generate-catalog.mjs";

function musicXml({ composer = "Novo compositor", fifths = 2 } = {}) {
  return `<?xml version="1.0"?>
<score-partwise version="4.0">
  <work><work-title>Novo titulo</work-title></work>
  <identification><creator type="composer">${composer}</creator></identification>
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1"><measure number="1"><attributes><divisions>1</divisions><key><fifths>${fifths}</fifths></key></attributes></measure></part>
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
  assert.equal(generated.genre, "Samba");
  assert.equal(generated.level, "Avancado");
  assert.equal(generated.notes, "Nota do manifesto");
  assert.equal(generated.source, "Manifesto editorial");
  assert.deepEqual(generated.tags, ["manifesto"]);
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
