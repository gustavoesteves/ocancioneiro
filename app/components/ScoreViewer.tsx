"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import type { Song } from "../catalog";
import { publicUrl } from "../url";

type ViewerState = "loading" | "ready" | "error";

type NoteEvent = {
  durationSeconds: number;
  frequency: number;
  startSeconds: number;
};

type QuarterNoteEvent = {
  durationQuarters: number;
  frequency: number;
  startQuarters: number;
};

type TempoChange = {
  quarter: number;
  tempo: number;
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

function tempoFromElement(element: Element) {
  const value =
    element.querySelector("sound[tempo]")?.getAttribute("tempo") ??
    element.querySelector("metronome per-minute")?.textContent;

  if (value === null || value === undefined) return null;

  const tempo = Number(value);
  if (!Number.isFinite(tempo) || tempo <= 0) {
    throw new Error("Invalid MusicXML tempo");
  }
  return tempo;
}

function quarterToSeconds(quarter: number, tempoChanges: TempoChange[]) {
  let currentQuarter = 0;
  let currentTempo = 90;
  let seconds = 0;

  for (const change of tempoChanges) {
    if (change.quarter > quarter) break;
    seconds += ((change.quarter - currentQuarter) * 60) / currentTempo;
    currentQuarter = change.quarter;
    currentTempo = change.tempo;
  }

  return seconds + ((quarter - currentQuarter) * 60) / currentTempo;
}

export function parseMusicXmlPlayback(xml: string) {
  const documentXml = new DOMParser().parseFromString(xml, "application/xml");
  const parseError = documentXml.querySelector("parsererror");

  if (parseError) {
    throw new Error("Invalid MusicXML");
  }

  const quarterEvents: QuarterNoteEvent[] = [];
  const tempoChanges: TempoChange[] = [];

  documentXml.querySelectorAll("part").forEach((part) => {
    let divisions = 1;
    let cursorQuarters = 0;
    let lastStartQuarters = 0;

    part.querySelectorAll("measure").forEach((measure) => {
      Array.from(measure.children).forEach((element) => {
        if (element.localName === "attributes") {
          const divisionsText = element.querySelector("divisions")?.textContent;
          if (divisionsText) {
            const nextDivisions = Number(divisionsText);
            if (!Number.isFinite(nextDivisions) || nextDivisions <= 0) {
              throw new Error("Invalid MusicXML divisions");
            }
            divisions = nextDivisions;
          }
          return;
        }

        if (element.localName === "direction") {
          const tempo = tempoFromElement(element);
          if (tempo !== null) {
            tempoChanges.push({ quarter: cursorQuarters, tempo });
          }
          return;
        }

        if (
          element.localName === "backup" ||
          element.localName === "forward"
        ) {
          const duration = Number(
            element.querySelector("duration")?.textContent ?? 0,
          );
          const durationQuarters = duration / divisions;
          if (!Number.isFinite(durationQuarters) || durationQuarters < 0) {
            throw new Error("Invalid MusicXML cursor duration");
          }
          cursorQuarters +=
            element.localName === "backup"
              ? -durationQuarters
              : durationQuarters;
          cursorQuarters = Math.max(cursorQuarters, 0);
          return;
        }

        if (element.localName !== "note") return;

        const duration = Number(
          element.querySelector("duration")?.textContent ?? 0,
        );
        const durationQuarters = duration / divisions;
        if (!Number.isFinite(durationQuarters) || durationQuarters < 0) {
          throw new Error("Invalid MusicXML note duration");
        }

        const isChord = element.querySelector("chord") !== null;
        const isRest = element.querySelector("rest") !== null;
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

  return quarterEvents.map((event): NoteEvent => {
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

export function ScoreViewer({ song }: { song: Song }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const stopTimerRef = useRef<number | null>(null);
  const playingNodesRef = useRef<Array<AudioScheduledSourceNode>>([]);
  const zoomRef = useRef(0.82);
  const [state, setState] = useState<ViewerState>("loading");
  const [scoreXml, setScoreXml] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackMessage, setPlaybackMessage] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.82);

  const stopPlayback = useCallback((updateState = true) => {
    playingNodesRef.current.forEach((node) => {
      try {
        node.stop();
      } catch {
        // A node may already have finished naturally.
      }
    });
    playingNodesRef.current = [];
    masterGainRef.current?.disconnect();
    masterGainRef.current = null;

    if (stopTimerRef.current) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }

    if (updateState) setIsPlaying(false);
  }, []);

  async function playScore() {
    if (!scoreXml || isPlaying) {
      return;
    }

    setPlaybackMessage(null);

    try {
      const events = parseMusicXmlPlayback(scoreXml);
      if (events.length === 0) {
        setPlaybackMessage(
          "Esta partitura nao possui notas compativeis com o playback simples.",
        );
        return;
      }

      const audioContext =
        audioContextRef.current ??
        new window.AudioContext({ latencyHint: "playback" });
      audioContextRef.current = audioContext;

      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      stopPlayback();

      const startAt = audioContext.currentTime + 0.08;
      const masterGain = audioContext.createGain();
      masterGain.gain.value = 0.24;
      masterGain.connect(audioContext.destination);
      masterGainRef.current = masterGain;

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
    } catch (error) {
      console.error(error);
      stopPlayback();
      setPlaybackMessage("Nao consegui iniciar o playback desta partitura.");
    }
  }

  useEffect(() => {
    let cancelled = false;
    const abortController = new AbortController();
    let currentOsmd: OpenSheetMusicDisplay | null = null;

    async function renderScore() {
      if (!containerRef.current) {
        return;
      }

      setState("loading");
      setScoreXml(null);
      setPlaybackMessage(null);
      containerRef.current.replaceChildren();

      try {
        const [{ OpenSheetMusicDisplay }, response] = await Promise.all([
          import("opensheetmusicdisplay"),
          fetch(publicUrl(song.musicxml), { signal: abortController.signal }),
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
        currentOsmd = osmd;

        osmd.zoom = zoomRef.current;
        await osmd.load(xml);
        await new Promise((resolve) => requestAnimationFrame(resolve));

        if (cancelled) {
          osmd.setOptions({ autoResize: false });
          osmd.clear();
          return;
        }

        osmdRef.current = osmd;
        osmd.zoom = zoomRef.current;
        osmd.render();

        if (!cancelled) {
          setState("ready");
        }
      } catch (error) {
        if (abortController.signal.aborted) return;
        console.error(error);
        if (!cancelled) {
          setState("error");
        }
      }
    }

    renderScore();

    return () => {
      cancelled = true;
      abortController.abort();
      if (currentOsmd) {
        currentOsmd.setOptions({ autoResize: false });
        currentOsmd.clear();
      }
      if (osmdRef.current === currentOsmd) osmdRef.current = null;
    };
  }, [song.musicxml]);

  useEffect(() => {
    zoomRef.current = zoom;
    const osmd = osmdRef.current;
    if (!osmd) return;
    let errorFrame: number | null = null;

    try {
      osmd.zoom = zoom;
      osmd.render();
    } catch (error) {
      console.error(error);
      errorFrame = requestAnimationFrame(() => setState("error"));
    }

    return () => {
      if (errorFrame !== null) cancelAnimationFrame(errorFrame);
    };
  }, [zoom]);

  useEffect(
    () => () => {
      stopPlayback(false);
      const audioContext = audioContextRef.current;
      audioContextRef.current = null;
      if (audioContext && audioContext.state !== "closed") {
        void audioContext.close();
      }
    },
    [stopPlayback],
  );

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
            onClick={isPlaying ? () => stopPlayback() : playScore}
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

      {playbackMessage ? (
        <p className="mb-4 text-sm text-[#8a2f2f]" role="status">
          {playbackMessage}
        </p>
      ) : null}

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
