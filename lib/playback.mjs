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

function midiToFrequency(midiNumber) {
  return 440 * 2 ** ((midiNumber - 69) / 12);
}

function pitchClassToMidi(pitchClassValue, minimumMidi) {
  let midiNumber = minimumMidi + ((pitchClassValue - (minimumMidi % 12) + 12) % 12);

  while (midiNumber < minimumMidi) {
    midiNumber += 12;
  }

  return midiNumber;
}

function pitchClass(step, alter = 0) {
  const semitonesByStep = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  };
  const stepSemitones = semitonesByStep[step];

  if (stepSemitones === undefined || !Number.isFinite(alter)) {
    throw new Error("Invalid MusicXML harmony");
  }

  return (stepSemitones + alter + 120) % 12;
}

function intervalsFromHarmonyKind(kindValue, kindText) {
  const descriptor = `${kindValue ?? ""} ${kindText ?? ""}`.toLowerCase();

  if (/half-diminished/.test(descriptor)) return [0, 3, 6, 10];
  if (/diminished-seventh|dim7|o7/.test(descriptor)) return [0, 3, 6, 9];
  if (/diminished|dim|^o$/.test(descriptor)) return [0, 3, 6];
  if (/augmented|aug|\+/.test(descriptor)) return [0, 4, 8];
  if (/suspended-fourth|sus4|suspended/.test(descriptor)) return [0, 5, 7];
  if (/suspended-second|sus2/.test(descriptor)) return [0, 2, 7];
  if (/major-seventh|maj7|major-7/.test(descriptor)) return [0, 4, 7, 11];
  if (/minor-major|mmaj|minor major/.test(descriptor)) return [0, 3, 7, 11];
  if (/minor-seventh|m7|min7|-7/.test(descriptor)) return [0, 3, 7, 10];
  if (/dominant|seventh|\b7\b/.test(descriptor)) return [0, 4, 7, 10];
  if (/major-sixth|6/.test(descriptor) && !/minor|m6|min6|-6/.test(descriptor)) {
    return [0, 4, 7, 9];
  }
  if (/minor-sixth|m6|min6|-6/.test(descriptor)) return [0, 3, 7, 9];
  if (/minor|^m$|min|-/.test(descriptor)) return [0, 3, 7];

  return [0, 4, 7];
}

function harmonyToFrequencies(harmony) {
  const root = firstChildElement(harmony, "root");
  const rootStep = root ? firstDescendantText(root, "root-step") : null;

  if (!rootStep) return [];

  const rootAlter = Number(firstDescendantText(root, "root-alter") ?? 0);
  const kind = firstChildElement(harmony, "kind");
  const kindValue = kind?.textContent?.trim() ?? "";
  const kindText = kind?.getAttribute("text") ?? "";
  const rootClass = pitchClass(rootStep, rootAlter);
  const intervals = intervalsFromHarmonyKind(kindValue, kindText);
  const bass = firstChildElement(harmony, "bass");
  const bassStep = bass ? firstDescendantText(bass, "bass-step") : null;
  const bassAlter = Number(
    bass ? (firstDescendantText(bass, "bass-alter") ?? 0) : 0,
  );
  const bassClass = bassStep ? pitchClass(bassStep, bassAlter) : null;
  const rootMidi = pitchClassToMidi(rootClass, 60);
  const chordMidi = intervals.map((interval) => rootMidi + interval);
  const bassMidi =
    bassClass === null ? [] : [pitchClassToMidi(bassClass, 43)];
  const uniqueMidi = [...new Set([...bassMidi, ...chordMidi])].sort(
    (first, second) => first - second,
  );

  return uniqueMidi.map(midiToFrequency);
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
  const harmonyQuarterEvents = [];
  const tempoChanges = [];
  let totalQuarters = 0;

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

        if (elementName(element) === "harmony") {
          const frequencies = harmonyToFrequencies(element);
          const offset = Number(firstDescendantText(element, "offset") ?? 0);
          const offsetQuarters = offset / divisions;
          if (!Number.isFinite(offsetQuarters)) {
            throw new Error("Invalid MusicXML harmony offset");
          }
          if (frequencies.length > 0) {
            harmonyQuarterEvents.push({
              frequencies,
              startQuarters: Math.max(cursorQuarters + offsetQuarters, 0),
              type: "harmony",
            });
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
          totalQuarters = Math.max(totalQuarters, cursorQuarters);
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
              type: "melody",
            });
          }
        }

        if (!isChord) {
          lastStartQuarters = cursorQuarters;
          cursorQuarters += durationQuarters;
          totalQuarters = Math.max(totalQuarters, cursorQuarters);
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

  const timedMelodyEvents = quarterEvents.map((event) => {
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
      type: event.type,
    };
  });

  const timedHarmonyEvents = harmonyQuarterEvents
    .sort((first, second) => first.startQuarters - second.startQuarters)
    .filter(
      (event, index, events) =>
        events.findIndex(
          (candidate) => candidate.startQuarters === event.startQuarters,
        ) === index,
    )
    .map((event, index, events) => {
      const nextStart = events[index + 1]?.startQuarters ?? totalQuarters;
      const endQuarters = Math.max(nextStart, event.startQuarters + 1);
      const startSeconds = quarterToSeconds(
        event.startQuarters,
        normalizedTempoChanges,
      );
      const endSeconds = quarterToSeconds(endQuarters, normalizedTempoChanges);
      return {
        durationSeconds: Math.max(endSeconds - startSeconds, 0.12),
        frequencies: event.frequencies,
        startSeconds,
        type: event.type,
      };
    });

  return [...timedMelodyEvents, ...timedHarmonyEvents].sort(
    (first, second) => first.startSeconds - second.startSeconds,
  );
}
