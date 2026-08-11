import assert from "node:assert/strict";
import test from "node:test";
import {
  archiveImportedMusicXmlAsset,
  linkMusicXmlToDossier,
} from "../lib/dossier-musicxml-link.mjs";
import {
  legacyCatalogEntryFromDossier,
  legacyProjectionIssues,
} from "../lib/dossier-catalog-projection.mjs";

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

function publicableDossier() {
  return {
    ...dossier(),
    curation: {
      currentDecisionId: "decisao-aceita",
      decisions: [
        {
          decidedAt: "2026-08-07",
          decidedBy: "bancada-editorial",
          id: "decisao-aceita",
          justification: "Fixture aceita para round-trip local.",
          reviews: [
            {
              conflictOfInterest: false,
              reviewedAt: "2026-08-07",
              reviewedBy: "revisor-fixture",
              role: "membro-da-bancada",
              summary: "Revisao independente da decisao aceita.",
            },
          ],
          status: "aceita",
        },
      ],
      status: "em_revisao",
    },
    rights: {
      actions: {
        exibir_metadados: "permitida",
        exibir_partitura: "permitida",
        reproduzir_playback: "permitida",
        imprimir: "permitida",
        distribuir_musicxml: "permitida",
      },
      status: "liberado",
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

test("archives imported assets without removing file references", () => {
  const linked = linkMusicXmlToDossier(dossier(), {
    generatedAt: "2026-08-07",
    publicId: "carinhoso",
    publicPath: "/musicxml/carinhoso.musicxml",
    xml: musicXml(),
  });
  const archived = archiveImportedMusicXmlAsset(linked, {
    archivedAt: "2026-08-08",
    publicId: "carinhoso",
    reason: "Teste de arquivamento.",
  });

  assert.equal(archived.assets[0].status, "bloqueado");
  assert.equal(archived.assets[0].path, "/musicxml/carinhoso.musicxml");
  assert.equal(archived.assets[0].checksum, linked.assets[0].checksum);
  assert.equal(archived.assets[0].archivedAt, "2026-08-08");
  assert.equal(archived.assets[0].archiveReason, "Teste de arquivamento.");
});

test("rejects archiving when the imported asset is missing", () => {
  assert.throws(
    () => archiveImportedMusicXmlAsset(dossier(), { publicId: "carinhoso" }),
    /Asset importado nao encontrado/,
  );
});

test("round-trips the local dossier import flow through public catalog projection", () => {
  const linked = linkMusicXmlToDossier(publicableDossier(), {
    generatedAt: "2026-08-07",
    publicId: "carinhoso",
    publicPath: "/musicxml/carinhoso.musicxml",
    xml: musicXml(),
  });
  const projected = legacyCatalogEntryFromDossier(linked);

  assert.equal(linked.work.id, "obra-carinhoso");
  assert.equal(projected.id, "carinhoso");
  assert.equal(projected.title, "Carinhoso");
  assert.equal(projected.musicxml, "/musicxml/carinhoso.musicxml");
  assert.deepEqual(projected.chords, ["F"]);

  const updated = linkMusicXmlToDossier(linked, {
    generatedAt: "2026-08-07",
    publicId: "carinhoso",
    publicPath: "/musicxml/carinhoso.musicxml",
    xml: musicXml({ title: "Carinhoso revisado" }),
  });
  assert.equal(updated.work.id, "obra-carinhoso");
  assert.equal(updated.editions.length, 1);
  assert.equal(legacyCatalogEntryFromDossier(updated).title, "Carinhoso revisado");

  const archived = archiveImportedMusicXmlAsset(updated, {
    archivedAt: "2026-08-08",
    publicId: "carinhoso",
  });
  assert.equal(legacyCatalogEntryFromDossier(archived), null);
  assert.deepEqual(legacyProjectionIssues(archived), [
    "sem asset MusicXML publico valido",
  ]);
});
