"use client";

import { useEffect, useMemo, useState } from "react";
import { ScoreViewer } from "./ScoreViewer";
import { publicUrl } from "../url";

type Song = {
  id: string;
  title: string;
  composer: string;
  genre: string;
  key: string;
  level: string;
  instrumentation: string;
  source: string;
  musicxml: string;
  notes: string;
  tags: string[];
};

export function CancioneiroApp() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [activeSongId, setActiveSongId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("Todos");
  const [genre, setGenre] = useState("Todos");
  const [catalogState, setCatalogState] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      try {
        const response = await fetch(publicUrl("/catalog.json"));

        if (!response.ok) {
          throw new Error("Catalog not found");
        }

        const data = (await response.json()) as { songs: Song[] };

        if (!cancelled) {
          setSongs(data.songs);
          setActiveSongId(data.songs[0]?.id ?? null);
          setCatalogState("ready");
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setCatalogState("error");
        }
      }
    }

    loadCatalog();

    return () => {
      cancelled = true;
    };
  }, []);

  const levels = useMemo(
    () => ["Todos", ...Array.from(new Set(songs.map((song) => song.level)))],
    [songs],
  );
  const genres = useMemo(
    () => ["Todos", ...Array.from(new Set(songs.map((song) => song.genre)))],
    [songs],
  );

  const filteredSongs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return songs.filter((song) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        [
          song.title,
          song.composer,
          song.genre,
          song.key,
          song.instrumentation,
          song.tags.join(" "),
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      const matchesLevel = level === "Todos" || song.level === level;
      const matchesGenre = genre === "Todos" || song.genre === genre;

      return matchesQuery && matchesLevel && matchesGenre;
    });
  }, [genre, level, query, songs]);

  const activeSong =
    songs.find((song) => song.id === activeSongId) ?? filteredSongs[0] ?? null;

  return (
    <main className="min-h-screen bg-[#f7f5ef] text-[#181714]">
      <section className="border-b border-[#d8d0c1] bg-[#fffdf8]">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-5 py-6 md:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#8a4c2f]">
                Biblioteca viva
              </p>
              <h1 className="mt-2 text-4xl font-semibold tracking-normal text-[#181714] md:text-5xl">
                O Cancioneiro
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-[#5f5a50] md:text-lg">
                Um acervo navegavel de partituras em MusicXML, pronto para
                crescer como biblioteca online e gerar PDFs, estudos e recortes
                editoriais depois.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 rounded-md border border-[#d8d0c1] bg-[#f3efe5] p-3 text-center">
              <div>
                <strong className="block text-2xl">{songs.length}</strong>
                <span className="text-xs uppercase tracking-[0.12em] text-[#70695e]">
                  pecas
                </span>
              </div>
              <div>
                <strong className="block text-2xl">{genres.length - 1}</strong>
                <span className="text-xs uppercase tracking-[0.12em] text-[#70695e]">
                  generos
                </span>
              </div>
              <div>
                <strong className="block text-2xl">XML</strong>
                <span className="text-xs uppercase tracking-[0.12em] text-[#70695e]">
                  fonte
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
            <label className="flex flex-col gap-2 text-sm font-medium text-[#4d473d]">
              Buscar
              <input
                className="h-11 rounded-md border border-[#cfc6b5] bg-white px-3 text-base outline-none transition focus:border-[#8a4c2f] focus:ring-2 focus:ring-[#e6d4c8]"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Titulo, compositor, tom, tag..."
                type="search"
                value={query}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-[#4d473d]">
              Nivel
              <select
                className="h-11 rounded-md border border-[#cfc6b5] bg-white px-3 text-base outline-none transition focus:border-[#8a4c2f] focus:ring-2 focus:ring-[#e6d4c8]"
                onChange={(event) => setLevel(event.target.value)}
                value={level}
              >
                {levels.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-[#4d473d]">
              Genero
              <select
                className="h-11 rounded-md border border-[#cfc6b5] bg-white px-3 text-base outline-none transition focus:border-[#8a4c2f] focus:ring-2 focus:ring-[#e6d4c8]"
                onChange={(event) => setGenre(event.target.value)}
                value={genre}
              >
                {genres.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-5 px-5 py-5 md:grid-cols-[340px_1fr] md:px-8">
        <aside className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Repertorio</h2>
            <span className="text-sm text-[#70695e]">{filteredSongs.length}</span>
          </div>

          <div className="flex flex-col gap-2">
            {catalogState === "loading" ? (
              <div className="rounded-md border border-[#d8d0c1] bg-[#fdfaf3] p-4 text-sm text-[#70695e]">
                Carregando catalogo...
              </div>
            ) : null}
            {catalogState === "error" ? (
              <div className="rounded-md border border-[#c78f8f] bg-[#fff8f6] p-4 text-sm text-[#8a2f2f]">
                Nao consegui carregar o catalogo.
              </div>
            ) : null}
            {filteredSongs.map((song) => (
              <button
                className={`rounded-md border p-4 text-left transition ${
                  song.id === activeSong?.id
                    ? "border-[#8a4c2f] bg-[#fffdf8] shadow-sm"
                    : "border-[#d8d0c1] bg-[#fdfaf3] hover:border-[#b99f8d]"
                }`}
                key={song.id}
                onClick={() => setActiveSongId(song.id)}
                type="button"
              >
                <span className="block text-base font-semibold">{song.title}</span>
                <span className="mt-1 block text-sm text-[#5f5a50]">
                  {song.composer}
                </span>
                <span className="mt-3 flex flex-wrap gap-2 text-xs text-[#6c6257]">
                  <span className="rounded border border-[#d8d0c1] px-2 py-1">
                    {song.genre}
                  </span>
                  <span className="rounded border border-[#d8d0c1] px-2 py-1">
                    {song.key}
                  </span>
                  <span className="rounded border border-[#d8d0c1] px-2 py-1">
                    {song.level}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <article className="min-w-0 rounded-md border border-[#d8d0c1] bg-[#fffdf8]">
          {activeSong ? (
            <>
          <div className="border-b border-[#d8d0c1] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-3xl font-semibold tracking-normal">
                  {activeSong.title}
                </h2>
                <p className="mt-2 text-[#5f5a50]">{activeSong.composer}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  className="rounded-md border border-[#b99f8d] bg-white px-3 py-2 text-sm font-medium text-[#4b3024] transition hover:bg-[#f3efe5]"
                  download
                  href={publicUrl(activeSong.musicxml)}
                >
                  Baixar MusicXML
                </a>
                <button
                  className="rounded-md border border-[#b99f8d] bg-white px-3 py-2 text-sm font-medium text-[#4b3024] transition hover:bg-[#f3efe5]"
                  onClick={() => window.print()}
                  type="button"
                >
                  Imprimir / PDF
                </button>
              </div>
            </div>

            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="font-medium text-[#70695e]">Tom</dt>
                <dd>{activeSong.key}</dd>
              </div>
              <div>
                <dt className="font-medium text-[#70695e]">Genero</dt>
                <dd>{activeSong.genre}</dd>
              </div>
              <div>
                <dt className="font-medium text-[#70695e]">Nivel</dt>
                <dd>{activeSong.level}</dd>
              </div>
              <div>
                <dt className="font-medium text-[#70695e]">Instrumentacao</dt>
                <dd>{activeSong.instrumentation}</dd>
              </div>
            </dl>

            <p className="mt-4 max-w-3xl text-sm leading-6 text-[#5f5a50]">
              {activeSong.notes}
            </p>
          </div>

          <ScoreViewer key={activeSong.id} song={activeSong} />
            </>
          ) : (
            <div className="grid min-h-[520px] place-items-center p-8 text-center text-sm text-[#70695e]">
              Nenhuma peca encontrada no catalogo.
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
