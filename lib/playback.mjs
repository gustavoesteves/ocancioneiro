const DEFAULT_TEMPO = 90;

function elementName(element) {
  return element.localName ?? element.nodeName.split(":").at(-1);
}

function elementChildren(element) {
  return Array.from(element.childNodes).filter((child) => child.nodeType === 1);
}

function descendantsByName(element, name) {
  return Array.from(element.getElementsByTagName("*")).filter(
    (child) => elementName(child) === name,
  );
}

function firstDescendantText(element, name) {
  return descendantsByName(element, name)[0]?.textContent ?? null;
}

function firstChildElement(element, name) {
  return elementChildren(element).find((child) => elementName(child) === name);
}

function pitchToFrequency(note) {
  const pitch = firstChildElement(note, "pitch");
  const step = pitch ? firstDescendantText(pitch, "step") : null;
  const octaveText = pitch ? firstDescendantText(pitch, "octave") : null;

  if (!step || !octaveText) {
    return null;
  }

  const semitonesByStep = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  };
  const alter = Number(firstDescendantText(pitch, "alter") ?? 0);
  const octave = Number(octaveText);
  const stepSemitones = semitonesByStep[step];

  if (
    stepSemitones === undefined ||
    !Number.isFinite(alter) ||
    !Number.isFinite(octave)
  ) {
    throw new Error("Invalid MusicXML pitch");
  }

  const midiNumber = (octave + 1) * 12 + stepSemitones + alter;

  return 440 * 2 ** ((midiNumber - 69) / 12);
}

function tempoFromElement(element) {
  const soundTempo = descendantsByName(element, "sound")
    .map((sound) => sound.getAttribute("tempo"))
    .find((value) => value !== null);
  const value = soundTempo ?? firstDescendantText(element, "per-minute");

  if (value === null || value === undefined) return null;

  const tempo = Number(value);
  if (!Number.isFinite(tempo) || tempo <= 0) {
    throw new Error("Invalid MusicXML tempo");
  }
  return tempo;
}

function quarterToSeconds(quarter, tempoChanges) {
  let currentQuarter = 0;
  let currentTempo = DEFAULT_TEMPO;
  let seconds = 0;

  for (const change of tempoChanges) {
    if (change.quarter > quarter) break;
    seconds += ((change.quarter - currentQuarter) * 60) / currentTempo;
    currentQuarter = change.quarter;
    currentTempo = change.tempo;
  }

  return seconds + ((quarter - currentQuarter) * 60) / currentTempo;
}

export function parseMusicXmlPlayback(xml, options = {}) {
  const Parser = options.DOMParser ?? globalThis.DOMParser;

  if (!Parser) {
    throw new Error("DOMParser is not available");
  }

  const documentXml = new Parser().parseFromString(xml, "application/xml");
  const parseErrors = Array.from(documentXml.getElementsByTagName("*")).filter(
    (element) => elementName(element) === "parsererror",
  );

  if (parseErrors.length > 0) {
    throw new Error("Invalid MusicXML");
  }

  const quarterEvents = [];
  const tempoChanges = [];

  descendantsByName(documentXml, "part").forEach((part) => {
    let divisions = 1;
    let cursorQuarters = 0;
    let lastStartQuarters = 0;

    descendantsByName(part, "measure").forEach((measure) => {
      elementChildren(measure).forEach((element) => {
        if (elementName(element) === "attributes") {
          const divisionsText = firstDescendantText(element, "divisions");
          if (divisionsText) {
            const nextDivisions = Number(divisionsText);
            if (!Number.isFinite(nextDivisions) || nextDivisions <= 0) {
              throw new Error("Invalid MusicXML divisions");
            }
            divisions = nextDivisions;
          }
          return;
        }

        if (elementName(element) === "direction") {
          const tempo = tempoFromElement(element);
          if (tempo !== null) {
            tempoChanges.push({ quarter: cursorQuarters, tempo });
          }
          return;
        }

        if (elementName(element) === "backup" || elementName(element) === "forward") {
          const duration = Number(firstDescendantText(element, "duration") ?? 0);
          const durationQuarters = duration / divisions;
          if (!Number.isFinite(durationQuarters) || durationQuarters < 0) {
            throw new Error("Invalid MusicXML cursor duration");
          }
          cursorQuarters +=
            elementName(element) === "backup"
              ? -durationQuarters
              : durationQuarters;
          cursorQuarters = Math.max(cursorQuarters, 0);
          return;
        }

        if (elementName(element) !== "note") return;

        const duration = Number(firstDescendantText(element, "duration") ?? 0);
        const durationQuarters = duration / divisions;
        if (!Number.isFinite(durationQuarters) || durationQuarters < 0) {
          throw new Error("Invalid MusicXML note duration");
        }

        const isChord = firstChildElement(element, "chord") !== undefined;
        const isRest = firstChildElement(element, "rest") !== undefined;
        const startQuarters = isChord ? lastStartQuarters : cursorQuarters;

        if (!isRest) {
          const frequency = pitchToFrequency(element);
          if (frequency) {
            quarterEvents.push({
              durationQuarters,
              frequency,
              startQuarters,
            });
          }
        }

        if (!isChord) {
          lastStartQuarters = cursorQuarters;
          cursorQuarters += durationQuarters;
        }
      });
    });
  });

  const normalizedTempoChanges = [...tempoChanges]
    .sort((first, second) => first.quarter - second.quarter)
    .filter(
      (change, index, changes) =>
        changes[index + 1]?.quarter !== change.quarter,
    );

  return quarterEvents.map((event) => {
    const startSeconds = quarterToSeconds(
      event.startQuarters,
      normalizedTempoChanges,
    );
    const endSeconds = quarterToSeconds(
      event.startQuarters + event.durationQuarters,
      normalizedTempoChanges,
    );
    return {
      durationSeconds: Math.max(endSeconds - startSeconds, 0.08),
      frequency: event.frequency,
      startSeconds,
    };
  });
}
