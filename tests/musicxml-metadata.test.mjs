import assert from "node:assert/strict";
import test from "node:test";
import {
  metadataFromMusicXml,
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

test("slugifies ids for generated import paths", () => {
  assert.equal(slugify("Ação & Reação λ"), "acao-reacao");
});
