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
import { decisionRecordHash } from "../lib/editorial-dossier.mjs";

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
  const decision = {
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
  };

  return {
    ...dossier(),
    curation: {
      currentDecisionId: "decisao-aceita",
      decisions: [
        {
          ...decision,
          recordHash: decisionRecordHash(decision),
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
  assert.equal(linked.editions[0].status, "em_revisao");
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
  const third = linkMusicXmlToDossier(second, {
    generatedAt: "2026-08-07",
    publicId: "carinhoso",
    publicPath: "/musicxml/carinhoso.musicxml",
    xml: musicXml({ title: "Carinhoso revisado" }),
  });

  assert.equal(second.editions.length, 1);
  assert.equal(second.assets.length, 2);
  assert.equal(second.editions[0].title, "Carinhoso revisado");
  assert.equal(second.assets[0].status, "substituido");
  assert.equal(second.assets[0].replacedByAssetId, second.assets[1].id);
  assert.equal(second.assets[1].status, "valido");
  assert.equal(second.assets[1].replacesAssetId, second.assets[0].id);
  assert.equal(third.assets.length, 2);
  assert.deepEqual(third.assets, second.assets);
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

test("keeps a local import private until its edition is explicitly reviewed", () => {
  const linked = linkMusicXmlToDossier(publicableDossier(), {
    generatedAt: "2026-08-07",
    publicId: "carinhoso",
    publicPath: "/musicxml/carinhoso.musicxml",
    xml: musicXml(),
  });

  assert.equal(linked.work.id, "obra-carinhoso");
  assert.equal(legacyCatalogEntryFromDossier(linked), null);

  const reviewed = {
    ...linked,
    editions: linked.editions.map((edition) => ({
      ...edition,
      status: "valida",
    })),
  };
  const projected = legacyCatalogEntryFromDossier(reviewed);
  assert.equal(projected.id, "carinhoso");
  assert.equal(projected.title, "Carinhoso");
  assert.equal(projected.musicxml, "/musicxml/carinhoso.musicxml");
  assert.deepEqual(projected.chords, ["F"]);

  const updated = linkMusicXmlToDossier(reviewed, {
    generatedAt: "2026-08-07",
    publicId: "carinhoso",
    publicPath: "/musicxml/carinhoso.musicxml",
    xml: musicXml({ title: "Carinhoso revisado" }),
  });
  assert.equal(updated.work.id, "obra-carinhoso");
  assert.equal(updated.editions.length, 1);
  assert.equal(updated.editions[0].status, "em_revisao");
  assert.equal(updated.assets.length, 2);
  assert.equal(legacyCatalogEntryFromDossier(updated), null);

  const reviewedUpdate = {
    ...updated,
    editions: updated.editions.map((edition) => ({
      ...edition,
      status: "valida",
    })),
  };
  assert.equal(
    legacyCatalogEntryFromDossier(reviewedUpdate).title,
    "Carinhoso revisado",
  );

  const archived = archiveImportedMusicXmlAsset(reviewedUpdate, {
    archivedAt: "2026-08-08",
    publicId: "carinhoso",
  });
  assert.equal(legacyCatalogEntryFromDossier(archived), null);
  assert.deepEqual(legacyProjectionIssues(archived), [
    "sem asset MusicXML publico valido",
  ]);
});
