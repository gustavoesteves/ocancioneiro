import assert from "node:assert/strict";
import test from "node:test";
import { DOMParser } from "@xmldom/xmldom";
import { parseMusicXmlPlayback } from "../lib/playback.mjs";

function parse(xml) {
  return parseMusicXmlPlayback(xml, { DOMParser });
}

function closeTo(actual, expected, delta = 0.001) {
  assert.ok(
    Math.abs(actual - expected) <= delta,
    `expected ${actual} to be close to ${expected}`,
  );
}

function closeFrequency(actual, expected) {
  closeTo(actual, expected, 0.5);
}

function score(measures) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1">
      <part-name>Melodia</part-name>
    </score-part>
  </part-list>
  <part id="P1">
    ${measures}
  </part>
</score-partwise>`;
}

function note(step, octave, duration, extra = "") {
  return `<note>
    ${extra}
    <pitch>
      <step>${step}</step>
      <octave>${octave}</octave>
    </pitch>
    <duration>${duration}</duration>
  </note>`;
}

test("maps simple quarter notes using the default tempo", () => {
  const events = parse(
    score(`<measure number="1">
      <attributes><divisions>1</divisions></attributes>
      ${note("C", 4, 1)}
      ${note("D", 4, 1)}
      ${note("E", 4, 1)}
    </measure>`),
  );

  assert.equal(events.length, 3);
  closeTo(events[0].startSeconds, 0);
  closeTo(events[0].durationSeconds, 60 / 90);
  closeTo(events[1].startSeconds, 60 / 90);
  closeTo(events[2].startSeconds, (60 / 90) * 2);
});

test("keeps chord notes on the same beat", () => {
  const events = parse(
    score(`<measure number="1">
      <attributes><divisions>1</divisions></attributes>
      ${note("C", 4, 1)}
      ${note("E", 4, 1, "<chord/>")}
      ${note("G", 4, 1)}
    </measure>`),
  );

  assert.equal(events.length, 3);
  closeTo(events[0].startSeconds, 0);
  closeTo(events[1].startSeconds, 0);
  closeTo(events[2].startSeconds, 60 / 90);
});

test("adds harmony playback events from MusicXML chord symbols", () => {
  const events = parse(
    score(`<measure number="1">
      <attributes><divisions>1</divisions></attributes>
      <harmony>
        <root><root-step>C</root-step></root>
        <kind>dominant</kind>
      </harmony>
      ${note("C", 4, 2)}
      <harmony>
        <root><root-step>F</root-step></root>
        <kind text="m7">minor-seventh</kind>
      </harmony>
      ${note("D", 4, 2)}
    </measure>`),
  );
  const harmonyEvents = events.filter((event) => event.type === "harmony");

  assert.equal(harmonyEvents.length, 2);
  assert.equal(harmonyEvents[0].frequencies.length, 4);
  closeTo(harmonyEvents[0].startSeconds, 0);
  closeTo(harmonyEvents[0].durationSeconds, (60 / 90) * 2);
  closeFrequency(harmonyEvents[0].frequencies[0], 130.81);
  closeFrequency(harmonyEvents[0].frequencies[3], 233.08);
  closeTo(harmonyEvents[1].startSeconds, (60 / 90) * 2);
  closeFrequency(harmonyEvents[1].frequencies[0], 174.61);
  closeFrequency(harmonyEvents[1].frequencies[1], 207.65);
});

test("uses slash-chord bass notes below the chord voicing", () => {
  const events = parse(
    score(`<measure number="1">
      <attributes><divisions>1</divisions></attributes>
      <harmony>
        <root><root-step>D</root-step></root>
        <kind text="m7">minor-seventh</kind>
        <bass><bass-step>A</bass-step></bass>
      </harmony>
      ${note("D", 4, 1)}
    </measure>`),
  );
  const harmony = events.find((event) => event.type === "harmony");

  assert.ok(harmony);
  closeFrequency(harmony.frequencies[0], 110);
  closeFrequency(harmony.frequencies[1], 146.83);
});

test("rests advance the playback cursor without producing events", () => {
  const events = parse(
    score(`<measure number="1">
      <attributes><divisions>2</divisions></attributes>
      ${note("C", 4, 2)}
      <note><rest/><duration>2</duration></note>
      ${note("D", 4, 2)}
    </measure>`),
  );

  assert.equal(events.length, 2);
  closeTo(events[0].startSeconds, 0);
  closeTo(events[1].startSeconds, (60 / 90) * 2);
});

test("supports backup and forward cursor movement for multiple voices", () => {
  const events = parse(
    score(`<measure number="1">
      <attributes><divisions>1</divisions></attributes>
      ${note("C", 4, 4)}
      <backup><duration>4</duration></backup>
      ${note("E", 3, 2)}
      <forward><duration>1</duration></forward>
      ${note("G", 3, 1)}
    </measure>`),
  );

  assert.equal(events.length, 3);
  closeTo(events[0].startSeconds, 0);
  closeTo(events[1].startSeconds, 0);
  closeTo(events[2].startSeconds, (60 / 90) * 3);
});

test("applies tempo changes at the current cursor position", () => {
  const events = parse(
    score(`<measure number="1">
      <attributes><divisions>1</divisions></attributes>
      <direction><sound tempo="60"/></direction>
      ${note("C", 4, 1)}
      <direction>
        <direction-type>
          <metronome>
            <beat-unit>quarter</beat-unit>
            <per-minute>120</per-minute>
          </metronome>
        </direction-type>
      </direction>
      ${note("D", 4, 1)}
    </measure>`),
  );

  assert.equal(events.length, 2);
  closeTo(events[0].startSeconds, 0);
  closeTo(events[0].durationSeconds, 1);
  closeTo(events[1].startSeconds, 1);
  closeTo(events[1].durationSeconds, 0.5);
});

test("rejects invalid divisions", () => {
  assert.throws(
    () =>
      parse(
        score(`<measure number="1">
          <attributes><divisions>0</divisions></attributes>
          ${note("C", 4, 1)}
        </measure>`),
      ),
    /Invalid MusicXML divisions/,
  );
});
