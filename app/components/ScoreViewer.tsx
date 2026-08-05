"use client";

import { useEffect, useRef, useState } from "react";

type Song = {
  title: string;
  musicxml: string;
};

type ViewerState = "loading" | "ready" | "error";

export function ScoreViewer({ song }: { song: Song }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const osmdRef = useRef<{ zoom: number; render: () => Promise<void> } | null>(
    null,
  );
  const [state, setState] = useState<ViewerState>("loading");
  const [zoom, setZoom] = useState(0.82);

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

        const osmd = new OpenSheetMusicDisplay(containerRef.current, {
          autoResize: true,
          backend: "svg",
          drawTitle: true,
        });

        osmd.zoom = zoom;
        await osmd.load(xml);
        await osmd.render();

        if (!cancelled) {
          osmdRef.current = osmd;
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

  return (
    <div className="p-4 md:p-5">
      <div className="mb-4 flex flex-col gap-3 rounded-md border border-[#d8d0c1] bg-[#f7f5ef] p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[#4d473d]">Partitura online</p>
          <p className="text-xs leading-5 text-[#70695e]">
            Audio/MIDI fica como proxima camada do sistema; esta primeira versao
            valida exibicao, catalogo e impressao.
          </p>
        </div>
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

      <div className="min-h-[520px] overflow-auto rounded-md border border-[#d8d0c1] bg-white p-4">
        {state === "loading" ? (
          <div className="grid min-h-[460px] place-items-center text-sm text-[#70695e]">
            Carregando partitura...
          </div>
        ) : null}
        {state === "error" ? (
          <div className="grid min-h-[460px] place-items-center text-center text-sm text-[#8a2f2f]">
            Nao consegui carregar esta partitura MusicXML.
          </div>
        ) : null}
        <div
          aria-label={`Partitura de ${song.title}`}
          className={state === "ready" ? "block" : "hidden"}
          ref={containerRef}
        />
      </div>
    </div>
  );
}
