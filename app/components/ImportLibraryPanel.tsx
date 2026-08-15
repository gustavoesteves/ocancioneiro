"use client";

import { useMemo, useState } from "react";
import {
  buildImportLibraryEntries,
  filterImportLibraryEntries,
  type ImportLibraryDossier,
  type ImportLibraryFilter,
  type ImportLibrarySong,
} from "../import-library-model";

const pageSize = 30;
const filters: { id: ImportLibraryFilter; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "published", label: "Publicadas" },
  { id: "review", label: "Em revisao" },
  { id: "blocked", label: "Bloqueadas" },
  { id: "no_asset", label: "Sem MusicXML" },
];

type ImportLibraryPanelProps<
  Song extends ImportLibrarySong,
  Dossier extends ImportLibraryDossier,
> = {
  destinationMode: boolean;
  dossiers: Dossier[];
  locked: boolean;
  onSelectDossier: (dossier: Dossier) => void;
  onSelectSong?: (song: Song) => void;
  selectedSongId: string | null;
  selectedWorkId: string | null;
  songs: Song[];
};

export function ImportLibraryPanel<
  Song extends ImportLibrarySong,
  Dossier extends ImportLibraryDossier,
>({
  destinationMode,
  dossiers,
  locked,
  onSelectDossier,
  onSelectSong,
  selectedSongId,
  selectedWorkId,
  songs,
}: ImportLibraryPanelProps<Song, Dossier>) {
  const [filter, setFilter] = useState<ImportLibraryFilter>("all");
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const entries = useMemo(
    () => buildImportLibraryEntries(songs, dossiers),
    [dossiers, songs],
  );
  const filtered = useMemo(
    () => filterImportLibraryEntries(entries, { filter, query }),
    [entries, filter, query],
  );
  const visible = filtered.slice(0, visibleCount);

  return (
    <div className="mt-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
        <label className="flex flex-col gap-1 text-sm font-medium text-[#4d473d]">
          Buscar no acervo
          <input
            className="h-10 rounded-md border border-[#cfc6b5] bg-white px-3 outline-none transition focus:border-[#8a4c2f] focus:ring-2 focus:ring-[#e6d4c8]"
            onChange={(event) => {
              setQuery(event.target.value);
              setVisibleCount(pageSize);
            }}
            placeholder="Titulo, compositor ou identificador"
            type="search"
            value={query}
          />
        </label>
        <div className="flex flex-wrap items-end gap-2" role="group" aria-label="Filtrar acervo">
          {filters.map((item) => (
            <button
              aria-pressed={filter === item.id}
              className={`h-10 rounded-md border px-3 text-xs font-semibold transition ${
                filter === item.id
                  ? "border-[#8a4c2f] bg-[#8a4c2f] text-white"
                  : "border-[#cfc6b5] bg-white text-[#5f5a50] hover:border-[#b99f8d]"
              }`}
              key={item.id}
              onClick={() => {
                setFilter(item.id);
                setVisibleCount(pageSize);
              }}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[#70695e]">
        <p>
          {filtered.length} de {entries.length} obra(s)
        </p>
        {destinationMode ? (
          <p>Confirme ou altere o destino sugerido para a captura.</p>
        ) : null}
      </div>

      {visible.length > 0 ? (
        <div className="mt-3 max-h-[560px] space-y-2 overflow-auto pr-1">
          {visible.map((entry) => {
            const selected =
              entry.song?.id === selectedSongId ||
              entry.dossier?.workId === selectedWorkId;
            return (
              <article
                className={`rounded-md border p-3 ${
                  selected
                    ? "border-[#8a4c2f] bg-white"
                    : "border-[#d8d0c1] bg-[#fffdf8]"
                }`}
                key={entry.key}
              >
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold">{entry.title}</h3>
                    <p className="mt-1 truncate text-xs text-[#70695e]">
                      {entry.creator}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1 text-[11px] text-[#5f5a50]">
                      {entry.dossier ? (
                        <>
                          <span className="rounded border border-[#d8d0c1] bg-white px-2 py-1">
                            {entry.dossier.status}
                          </span>
                          <span className="rounded border border-[#d8d0c1] bg-white px-2 py-1">
                            {entry.dossier.editionCount} ed.
                          </span>
                          <span className="rounded border border-[#d8d0c1] bg-white px-2 py-1">
                            {entry.dossier.assetCount} asset(s)
                          </span>
                        </>
                      ) : (
                        <span className="rounded border border-[#d3a36f] bg-[#fff8e9] px-2 py-1 text-[#70431f]">
                          sem dossie
                        </span>
                      )}
                      {entry.blocked ? (
                        <span className="rounded border border-[#c78f8f] bg-[#fff8f6] px-2 py-1 text-[#8a2f2f]">
                          bloqueada
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 truncate font-mono text-[11px] text-[#8a4c2f]">
                      {entry.dossier?.workId ?? entry.song?.id}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {entry.song && !destinationMode && onSelectSong ? (
                      <button
                        className="rounded-md border border-[#b99f8d] bg-white px-3 py-2 text-xs font-semibold text-[#4b3024]"
                        onClick={() => onSelectSong(entry.song!)}
                        type="button"
                      >
                        Abrir asset
                      </button>
                    ) : null}
                    {entry.dossier ? (
                      <button
                        aria-pressed={destinationMode ? selected : undefined}
                        className="rounded-md border border-[#8a4c2f] bg-[#8a4c2f] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={locked}
                        onClick={() => onSelectDossier(entry.dossier!)}
                        type="button"
                      >
                        {destinationMode
                          ? selected
                            ? "Destino selecionado"
                            : "Escolher destino"
                          : "Ver dossie"}
                      </button>
                    ) : null}
                  </div>
                </div>
                {entry.dossier && !entry.dossier.publicable ? (
                  <p className="mt-2 text-xs text-[#70695e]">
                    {entry.dossier.projectionIssues[0] || "Revisao editorial pendente"}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 rounded-md border border-[#d8d0c1] bg-white p-4 text-sm text-[#70695e]">
          Nenhuma obra corresponde a esta busca.
        </p>
      )}

      {visibleCount < filtered.length ? (
        <button
          className="mt-3 w-full rounded-md border border-[#b99f8d] bg-white px-3 py-2 text-sm font-semibold text-[#4b3024]"
          onClick={() => setVisibleCount((current) => current + pageSize)}
          type="button"
        >
          Mostrar mais {Math.min(pageSize, filtered.length - visibleCount)} obra(s)
        </button>
      ) : null}
    </div>
  );
}
