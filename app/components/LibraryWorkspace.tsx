"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  ImportLibraryResponse,
  ManagedDossier,
  ManagedSong,
} from "../import-types";
import { ImportLibraryPanel } from "./ImportLibraryPanel";

export function LibraryWorkspace() {
  const [songs, setSongs] = useState<ManagedSong[]>([]);
  const [dossiers, setDossiers] = useState<ManagedDossier[]>([]);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadLibrary() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/import");
      const result = (await response.json()) as ImportLibraryResponse;
      if (!response.ok) throw new Error(result.error || "Nao consegui carregar o acervo.");
      setSongs(result.songs ?? []);
      setDossiers(result.dossiers ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Nao consegui carregar o acervo.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadLibrary(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const selectedDossier = useMemo(
    () => dossiers.find((dossier) => dossier.workId === selectedWorkId) ?? null,
    [dossiers, selectedWorkId],
  );
  const selectedSong = useMemo(
    () => songs.find((song) => song.id === selectedSongId) ?? null,
    [selectedSongId, songs],
  );

  function selectDossier(dossier: ManagedDossier) {
    setSelectedWorkId(dossier.workId);
    setSelectedSongId(dossier.publicCatalogId);
  }

  function selectSong(song: ManagedSong) {
    setSelectedSongId(song.id);
    setSelectedWorkId(
      dossiers.find((dossier) => dossier.publicCatalogId === song.id)?.workId ?? null,
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-8 md:px-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#8a4c2f]">
            Consulta editorial
          </p>
          <h1 className="mt-2 text-4xl font-semibold">Acervo</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#70695e]">
            Busque obras e dossies sem carregar o fluxo de captura. A lista cresce
            em blocos e continua utilizavel com centenas de registros.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="rounded-md border border-[#b99f8d] bg-white px-3 py-2 text-sm font-semibold text-[#4b3024]"
            disabled={loading}
            onClick={() => void loadLibrary()}
            type="button"
          >
            {loading ? "Carregando..." : "Atualizar"}
          </button>
          <a
            className="rounded-md border border-[#8a4c2f] bg-[#8a4c2f] px-3 py-2 text-sm font-semibold text-white"
            href="/import/capturar"
          >
            Nova captura
          </a>
        </div>
      </div>

      {error ? (
        <p className="mt-6 rounded-md border border-[#c78f8f] bg-[#fff8f6] p-4 text-sm text-[#8a2f2f]">
          {error}
        </p>
      ) : null}

      <section className="mt-7 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="rounded-md border border-[#d8d0c1] bg-[#fdfaf3] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Biblioteca editorial</h2>
            <p className="text-xs text-[#70695e]">
              {songs.length} musica(s) · {dossiers.length} dossie(s)
            </p>
          </div>
          <ImportLibraryPanel
            destinationMode={false}
            dossiers={dossiers}
            locked={false}
            onSelectDossier={selectDossier}
            onSelectSong={selectSong}
            selectedSongId={selectedSongId}
            selectedWorkId={selectedWorkId}
            songs={songs}
          />
        </div>

        <aside className="rounded-md border border-[#d8d0c1] bg-[#fffdf8] p-5 xl:sticky xl:top-5 xl:self-start">
          {selectedDossier || selectedSong ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">
                    {selectedDossier?.title ?? selectedSong?.title}
                  </h2>
                  <p className="mt-1 text-sm text-[#70695e]">
                    {selectedDossier?.creators.map((creator) => creator.name).join(", ") ||
                      selectedSong?.composer}
                  </p>
                </div>
                <span className="rounded border border-[#d8d0c1] bg-[#fdfaf3] px-2 py-1 text-xs">
                  {selectedDossier?.status ?? "sem dossie"}
                </span>
              </div>
              <dl className="mt-5 grid gap-3 text-sm">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8a4c2f]">Obra</dt>
                  <dd className="mt-1 break-all font-mono text-xs">
                    {selectedDossier?.workId ?? "nao vinculada"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8a4c2f]">Catalogo publico</dt>
                  <dd className="mt-1 font-mono text-xs">
                    {selectedDossier?.publicCatalogId ?? selectedSong?.id ?? "nao publicado"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8a4c2f]">Conteudo</dt>
                  <dd className="mt-1 text-[#5f5a50]">
                    {selectedDossier
                      ? `${selectedDossier.editionCount} edicao(oes), ${selectedDossier.assetCount} asset(s)`
                      : "Registro legado sem dossie editorial."}
                  </dd>
                </div>
              </dl>
              {selectedDossier?.projectionIssues.length ? (
                <div className="mt-5 rounded-md border border-[#d3a36f] bg-[#fff8e9] p-3">
                  <h3 className="text-sm font-semibold text-[#70431f]">Pendencias</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[#70431f]">
                    {selectedDossier.projectionIssues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {selectedDossier ? (
                <a
                  className="mt-5 inline-block text-sm font-semibold text-[#8a4c2f] underline"
                  href={`/import/obras/${encodeURIComponent(selectedDossier.workId)}`}
                >
                  Abrir dossie completo
                </a>
              ) : null}
            </>
          ) : (
            <p className="text-sm leading-relaxed text-[#70695e]">
              Selecione uma obra para consultar o resumo editorial sem entrar no
              fluxo de importacao.
            </p>
          )}
        </aside>
      </section>
    </main>
  );
}
