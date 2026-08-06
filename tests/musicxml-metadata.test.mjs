import assert from "node:assert/strict";
import test from "node:test";
import {
  metadataFromMusicXml,
  musicXmlWithDisplayMetadata,
  slugify,
} from "../lib/musicxml-metadata.mjs";

test("extracts import metadata from a MusicXML document", () => {
  const xml = `<?xml version="1.0"?>
<score-partwise version="4.0">
  <work><work-title>Canção de Teste</work-title></work>
  <identification><creator type="composer">João &amp; Maria</creator></identification>
  <part-list><score-part id="P1"><part-name>Melodia</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>-2</fifths><mode>major</mode></key>
      </attributes>
      <harmony>
        <root><root-step>G</root-step></root>
        <kind text="m7">minor-seventh</kind>
      </harmony>
    </measure>
  </part>
</score-partwise>`;

  assert.deepEqual(metadataFromMusicXml(xml, "arquivo.musicxml"), {
    chords: ["Gm7"],
    composer: "João & Maria",
    fileName: "cancao-de-teste.musicxml",
    id: "cancao-de-teste",
    instrumentation: "Melodia",
    key: "Bb maior",
    musicxml: "/musicxml/cancao-de-teste.musicxml",
    title: "Canção de Teste",
  });
});

test("uses credit title and composer when exported fields are placeholders", () => {
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
  <part-list><score-part id="P1"><part-name>Electric Guitar</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>-5</fifths></key>
      </attributes>
    </measure>
  </part>
</score-partwise>`;

  const metadata = metadataFromMusicXml(xml, "aint-it-the-truth.musicxml");

  assert.equal(metadata.title, "Ain't it the truth");
  assert.equal(metadata.composer, "Gerry Mulligan");
  assert.equal(metadata.id, "ain-t-it-the-truth");
  assert.equal(metadata.fileName, "ain-t-it-the-truth.musicxml");
});

test("rewrites display metadata for score renderers", () => {
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
  <part-list><score-part id="P1"><part-name>Electric Guitar</part-name></score-part></part-list>
  <part id="P1"><measure number="1"><attributes><divisions>1</divisions></attributes></measure></part>
</score-partwise>`;

  const displayXml = musicXmlWithDisplayMetadata(xml, "aint-it-the-truth.musicxml");

  assert.match(displayXml, /<work-title>Ain't it the truth<\/work-title>/);
  assert.match(
    displayXml,
    /<creator type="composer">Gerry Mulligan<\/creator>/,
  );
  assert.doesNotMatch(displayXml, /Untitled score|Composer \/ arranger/);
});

test("slugifies ids for generated import paths", () => {
  assert.equal(slugify("Ação & Reação λ"), "acao-reacao");
});
