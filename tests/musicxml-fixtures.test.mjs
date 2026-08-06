import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import test from "node:test";
import { DOMParser } from "@xmldom/xmldom";
import { parseCatalog } from "../lib/catalog.mjs";
import { parseMusicXmlPlayback } from "../lib/playback.mjs";
import {
  buildSongEntry,
  sourceHash,
} from "../scripts/generate-catalog.mjs";

const fixtures = [
  {
    file: "lead-sheet-com-cifras.musicxml",
    expected: {
      composer: "O Cancioneiro",
      eventCount: 3,
      instrumentation: "Melodia",
      key: "C maior",
      title: "Lead sheet com cifras",
    },
  },
  {
    file: "andamento-e-alteracoes.musicxml",
    expected: {
      composer: "Arquivo de teste",
      eventCount: 2,
      instrumentation: "Violao",
      key: "F menor",
      title: "Andamento e alteracoes",
    },
  },
  {
    file: path.join("subdiretorio", "Canção-λ.musicxml"),
    expected: {
      composer: "João Δ",
      eventCount: 3,
      instrumentation: "Voz, Piano",
      key: "D maior",
      title: "Canção λ",
    },
  },
];

test("representative MusicXML fixtures produce catalog entries and playback events", async () => {
  const songs = [];

  for (const fixture of fixtures) {
    const fixturePath = path.join(
      process.cwd(),
      "tests",
      "fixtures",
      "musicxml",
      fixture.file,
    );
    const publicFilePath = path.join(
      process.cwd(),
      "public",
      "musicxml",
      fixture.file,
    );
    const xml = await fs.readFile(fixturePath, "utf8");
    const song = buildSongEntry(
      publicFilePath,
      xml,
      null,
      sourceHash(xml),
      {},
    );
    const events = parseMusicXmlPlayback(xml, { DOMParser });

    assert.equal(song.title, fixture.expected.title);
    assert.equal(song.composer, fixture.expected.composer);
    assert.equal(song.key, fixture.expected.key);
    assert.equal(song.instrumentation, fixture.expected.instrumentation);
    assert.match(xml, /<harmony>/);
    assert.equal(events.length, fixture.expected.eventCount);
    assert.ok(events.every((event) => event.durationSeconds > 0));

    songs.push(song);
  }

  assert.equal(parseCatalog({ songs }).songs.length, fixtures.length);
  assert.ok(
    songs.some(
      (song) => song.musicxml === "/musicxml/subdiretorio/Canção-λ.musicxml",
    ),
  );
});
