"use client";

import { useEffect, useRef, useState } from "react";

type Song = {
  title: string;
  musicxml: string;
};

type ViewerState = "loading" | "ready" | "error";

type NoteEvent = {
  durationSeconds: number;
  frequency: number;
  startSeconds: number;
};

function pitchToFrequency(note: Element) {
  const step = note.querySelector("pitch > step")?.textContent;
  const octaveText = note.querySelector("pitch > octave")?.textContent;

  if (!step || !octaveText) {
    return null;
  }

  const semitonesByStep: Record<string, number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  };
  const alter = Number(note.querySelector("pitch > alter")?.textContent ?? 0);
  const octave = Number(octaveText);
  const midiNumber = (octave + 1) * 12 + semitonesByStep[step] + alter;

  return 440 * 2 ** ((midiNumber - 69) / 12);
}

function parseMusicXmlPlayback(xml: string) {
  const documentXml = new DOMParser().parseFromString(xml, "application/xml");
  const parseError = documentXml.querySelector("parsererror");

  if (parseError) {
    throw new Error("Invalid MusicXML");
  }

  const tempo = Number(
    documentXml.querySelector("sound[tempo]")?.getAttribute("tempo") ??
      documentXml.querySelector("metronome per-minute")?.textContent ??
      90,
  );
  const secondsPerQuarter = 60 / tempo;
  const events: NoteEvent[] = [];
  let divisions = 1;
  let cursorQuarters = 0;
  let lastStartQuarters = 0;
  let lastDurationQuarters = 0;

  documentXml.querySelectorAll("part").forEach((part) => {
    cursorQuarters = 0;

    part.querySelectorAll("measure").forEach((measure) => {
      const divisionsText = measure.querySelector("attributes > divisions")
        ?.textContent;

      if (divisionsText) {
        divisions = Number(divisionsText);
      }

      measure.querySelectorAll("note").forEach((note) => {
        const duration = Number(note.querySelector("duration")?.textContent ?? 0);
        const durationQuarters = duration / divisions;
        const isChord = note.querySelector("chord") !== null;
        const isRest = note.querySelector("rest") !== null;
        const startQuarters = isChord ? lastStartQuarters : cursorQuarters;
        const eventDurationQuarters = durationQuarters || lastDurationQuarters;

        if (!isRest) {
          const frequency = pitchToFrequency(note);

          if (frequency) {
            events.push({
              durationSeconds: Math.max(
                eventDurationQuarters * secondsPerQuarter,
                0.08,
              ),
              frequency,
              startSeconds: startQuarters * secondsPerQuarter,
            });
          }
        }

        if (!isChord) {
          lastStartQuarters = cursorQuarters;
          lastDurationQuarters = durationQuarters;
          cursorQuarters += durationQuarters;
        }
      });
    });
  });

  return events;
}

export function ScoreViewer({ song }: { song: Song }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const stopTimerRef = useRef<number | null>(null);
  const playingNodesRef = useRef<Array<AudioScheduledSourceNode>>([]);
  const [state, setState] = useState<ViewerState>("loading");
  const [scoreXml, setScoreXml] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [zoom, setZoom] = useState(0.82);

  function stopPlayback() {
    playingNodesRef.current.forEach((node) => {
      try {
        node.stop();
      } catch {
        // A node may already have finished naturally.
      }
    });
    playingNodesRef.current = [];

    if (stopTimerRef.current) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }

    setIsPlaying(false);
  }

  async function playScore() {
    if (!scoreXml || isPlaying) {
      return;
    }

    const events = parseMusicXmlPlayback(scoreXml);

    if (events.length === 0) {
      return;
    }

    const audioContext =
      audioContextRef.current ?? new window.AudioContext({ latencyHint: "playback" });
    audioContextRef.current = audioContext;

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    stopPlayback();

    const startAt = audioContext.currentTime + 0.08;
    const masterGain = audioContext.createGain();
    masterGain.gain.value = 0.24;
    masterGain.connect(audioContext.destination);

    events.forEach((event) => {
      const oscillator = audioContext.createOscillator();
      const noteGain = audioContext.createGain();
      const noteStart = startAt + event.startSeconds;
      const noteEnd = noteStart + event.durationSeconds * 0.92;

      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(event.frequency, noteStart);
      noteGain.gain.setValueAtTime(0.0001, noteStart);
      noteGain.gain.exponentialRampToValueAtTime(0.7, noteStart + 0.015);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

      oscillator.connect(noteGain);
      noteGain.connect(masterGain);
      oscillator.start(noteStart);
      oscillator.stop(noteEnd + 0.02);
      playingNodesRef.current.push(oscillator);
    });

    const totalDuration = Math.max(
      ...events.map((event) => event.startSeconds + event.durationSeconds),
    );

    setIsPlaying(true);
    stopTimerRef.current = window.setTimeout(
      () => stopPlayback(),
      (totalDuration + 0.2) * 1000,
    );
  }

  useEffect(() => {
    let cancelled = false;

    async function renderScore() {
      if (!containerRef.current) {
        return;
      }

      setState("loading");
      containerRef.current.innerHTML = "";

      try {
        const [{ OpenSheetMusicDisplay }, response] = await Promise.all([
          import("opensheetmusicdisplay"),
          fetch(song.musicxml),
        ]);

        if (!response.ok) {
          throw new Error(`Could not load ${song.musicxml}`);
        }

        const xml = await response.text();

        if (cancelled || !containerRef.current) {
          return;
        }

        setScoreXml(xml);

        const osmd = new OpenSheetMusicDisplay(containerRef.current, {
          autoResize: true,
          backend: "svg",
          drawTitle: true,
        });

        osmd.zoom = zoom;
        await osmd.load(xml);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        await osmd.render();

        if (!cancelled) {
          setState("ready");
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setState("error");
        }
      }
    }

    renderScore();

    return () => {
      cancelled = true;
    };
  }, [song.musicxml, zoom]);

  useEffect(() => stopPlayback, [song.musicxml]);

  return (
    <div className="p-4 md:p-5">
      <div className="mb-4 flex flex-col gap-3 rounded-md border border-[#d8d0c1] bg-[#f7f5ef] p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[#4d473d]">Partitura online</p>
          <p className="text-xs leading-5 text-[#70695e]">
            Playback simples gerado no navegador a partir do MusicXML.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            className="rounded-md border border-[#b99f8d] bg-white px-3 py-2 text-sm font-medium text-[#4b3024] transition hover:bg-[#f3efe5] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={state !== "ready" || !scoreXml}
            onClick={isPlaying ? stopPlayback : playScore}
            type="button"
          >
            {isPlaying ? "Parar" : "Tocar"}
          </button>
          <label className="flex items-center gap-3 text-sm font-medium text-[#4d473d]">
            Zoom
            <input
              className="w-40 accent-[#8a4c2f]"
              max="1.25"
              min="0.55"
              onChange={(event) => setZoom(Number(event.target.value))}
              step="0.05"
              type="range"
              value={zoom}
            />
          </label>
        </div>
      </div>

      <div className="relative min-h-[520px] overflow-auto rounded-md border border-[#d8d0c1] bg-white p-4">
        {state === "loading" ? (
          <div className="absolute inset-0 z-10 grid min-h-[460px] place-items-center bg-white text-sm text-[#70695e]">
            Carregando partitura...
          </div>
        ) : null}
        {state === "error" ? (
          <div className="absolute inset-0 z-10 grid min-h-[460px] place-items-center bg-white text-center text-sm text-[#8a2f2f]">
            Nao consegui carregar esta partitura MusicXML.
          </div>
        ) : null}
        <div
          aria-label={`Partitura de ${song.title}`}
          className="min-h-[460px] min-w-[720px]"
          ref={containerRef}
        />
      </div>
    </div>
  );
}
