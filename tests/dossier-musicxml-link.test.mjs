import assert from "node:assert/strict";
import test from "node:test";
import { linkMusicXmlToDossier } from "../lib/dossier-musicxml-link.mjs";

function dossier() {
  return {
    schemaVersion: 1,
    work: {
      creators: [{ name: "Pixinguinha", role: "composer" }],
      id: "obra-carinhoso",
      preferredTitle: "Carinhoso",
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

function musicXml({ title = "Carinhoso" } = {}) {
  return `<?xml version="1.0"?>
<score-partwise version="4.0">
  <work><work-title>${title}</work-title></work>
  <part-list><score-part id="P1"><part-name>Melodia</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions><key><fifths>-1</fifths></key></attributes>
      <harmony><root><root-step>F</root-step></root><kind text="F">major</kind></harmony>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
  </part>
</score-partwise>`;
}

test("links MusicXML to an existing editorial dossier without changing work identity", () => {
  const linked = linkMusicXmlToDossier(dossier(), {
    generatedAt: "2026-08-07",
    publicId: "carinhoso",
    publicPath: "/musicxml/carinhoso.musicxml",
    xml: musicXml(),
  });

  assert.equal(linked.work.id, "obra-carinhoso");
  assert.equal(linked.publicCatalogId, "carinhoso");
  assert.equal(linked.editions[0].id, "edicao-importada-carinhoso");
  assert.equal(linked.editions[0].encodedKey, "F maior");
  assert.deepEqual(linked.editions[0].chords, ["F"]);
  assert.equal(linked.assets[0].editionId, "edicao-importada-carinhoso");
  assert.equal(linked.assets[0].path, "/musicxml/carinhoso.musicxml");
  assert.equal(linked.assets[0].status, "valido");
});

test("updates the imported edition and asset deterministically", () => {
  const first = linkMusicXmlToDossier(dossier(), {
    generatedAt: "2026-08-07",
    publicId: "carinhoso",
    publicPath: "/musicxml/carinhoso.musicxml",
    xml: musicXml(),
  });
  const second = linkMusicXmlToDossier(first, {
    generatedAt: "2026-08-07",
    publicId: "carinhoso",
    publicPath: "/musicxml/carinhoso.musicxml",
    xml: musicXml({ title: "Carinhoso revisado" }),
  });

  assert.equal(second.editions.length, 1);
  assert.equal(second.assets.length, 1);
  assert.equal(second.editions[0].title, "Carinhoso revisado");
});
