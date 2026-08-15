"use client";

import { useEffect, useMemo, useState } from "react";
import { ScoreViewer } from "./ScoreViewer";
import { publicUrl } from "../url";
import {
  filterSongs,
  parseCatalog,
  resolveActiveSong,
  type Song,
} from "../catalog";

export function CancioneiroApp() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [activeSongId, setActiveSongId] = useState<string | null>(null);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
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
        const response = await fetch(publicUrl("/catalog.json"), {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Catalog not found");
        }

        const data = parseCatalog(await response.json());

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
    return filterSongs(songs, query, level, genre);
  }, [genre, level, query, songs]);

  const activeSong = resolveActiveSong(filteredSongs, activeSongId);
  const activeActions = activeSong?.availability.actions;
  const hasScore = Boolean(
    activeSong?.musicxml && activeActions?.exibir_partitura,
  );

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
                Um songbook vivo de melodias e cifras do repertorio brasileiro:
                feito para estudar, tocar, revisar e preservar a identidade das
                obras em formato lead sheet.
              </p>
              <button
                className="mt-4 inline-flex h-10 items-center rounded-md border border-[#b99f8d] bg-white px-4 text-sm font-medium text-[#4b3024] transition hover:bg-[#f3efe5] focus:outline-none focus:ring-2 focus:ring-[#e6d4c8]"
                onClick={() => setIsAboutOpen(true)}
                type="button"
              >
                Sobre o projeto
              </button>
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
            {catalogState === "ready" && filteredSongs.length === 0 ? (
              <div className="rounded-md border border-[#d8d0c1] bg-[#fdfaf3] p-4 text-sm text-[#70695e]">
                Nenhuma peca corresponde aos filtros atuais.
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
                  <span
                    className={`rounded border px-2 py-1 ${
                      song.availability.status === "disponivel"
                        ? "border-[#b7c7ad] bg-[#f3f8ef] text-[#3f5a37]"
                        : "border-[#d8d0c1] bg-[#f5f1e8] text-[#6c6257]"
                    }`}
                  >
                    {song.availability.actions.exibir_partitura
                      ? "Partitura disponivel"
                      : song.availability.actions.distribuir_musicxml
                        ? "MusicXML disponivel"
                        : "Somente metadados"}
                  </span>
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
                {activeActions?.distribuir_musicxml && activeSong.musicxml ? (
                  <a
                    className="rounded-md border border-[#b99f8d] bg-white px-3 py-2 text-sm font-medium text-[#4b3024] transition hover:bg-[#f3efe5]"
                    download
                    href={publicUrl(activeSong.musicxml)}
                  >
                    Baixar MusicXML
                  </a>
                ) : null}
                {activeActions?.imprimir ? (
                  <button
                    className="rounded-md border border-[#b99f8d] bg-white px-3 py-2 text-sm font-medium text-[#4b3024] transition hover:bg-[#f3efe5]"
                    onClick={() => window.print()}
                    type="button"
                  >
                    Imprimir / PDF
                  </button>
                ) : null}
              </div>
            </div>

            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
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
              <div>
                <dt className="font-medium text-[#70695e]">Cifras</dt>
                <dd>
                  {activeSong.chords.length > 0
                    ? activeSong.chords.join(" / ")
                    : "Nao informado"}
                </dd>
              </div>
            </dl>

            <p className="mt-4 max-w-3xl text-sm leading-6 text-[#5f5a50]">
              {activeSong.notes}
            </p>
          </div>

          {hasScore ? (
            <ScoreViewer key={activeSong.id} song={activeSong} />
          ) : (
            <div className="p-5">
              <div className="grid min-h-[420px] place-items-center rounded-md border border-[#d8d0c1] bg-[#f7f5ef] p-8 text-center">
                <div className="max-w-xl">
                  <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#8a4c2f]">
                    Partitura indisponivel
                  </p>
                  <h3 className="mt-3 text-2xl font-semibold text-[#181714]">
                    O registro da obra continua acessivel
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-[#5f5a50]">
                    {activeSong.availability.reason}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-[#70695e]">
                    O Cancioneiro publica metadados, partitura e arquivos como
                    permissoes independentes. A ausencia da partitura nao remove
                    a obra do repertorio.
                  </p>
                </div>
              </div>
            </div>
          )}
            </>
          ) : (
            <div className="grid min-h-[520px] place-items-center p-8 text-center text-sm text-[#70695e]">
              Nenhuma peca encontrada no catalogo.
            </div>
          )}
        </article>
      </section>

      {isAboutOpen ? (
        <div
          aria-labelledby="about-title"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-[#181714]/45 px-4 py-6"
          role="dialog"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-md border border-[#d8d0c1] bg-[#fffdf8] p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#8a4c2f]">
                  Linha editorial
                </p>
                <h2
                  className="mt-2 text-2xl font-semibold tracking-normal text-[#181714]"
                  id="about-title"
                >
                  O Cancioneiro
                </h2>
              </div>
              <button
                aria-label="Fechar sobre o projeto"
                className="h-9 rounded-md border border-[#b99f8d] bg-white px-3 text-sm font-medium text-[#4b3024] transition hover:bg-[#f3efe5] focus:outline-none focus:ring-2 focus:ring-[#e6d4c8]"
                onClick={() => setIsAboutOpen(false)}
                type="button"
              >
                Fechar
              </button>
            </div>

            <div className="mt-5 space-y-4 text-sm leading-6 text-[#4d473d]">
              <p>
                O Cancioneiro e uma biblioteca editorial de lead sheets:
                melodias, cifras e forma essencial para estudo, acompanhamento,
                improvisacao e revisao musical.
              </p>
              <p>
                A proposta nao e publicar arranjos completos nem reproduzir
                performances especificas. Cada partitura deve preservar a
                identidade executavel da obra e deixar espaco para quem toca
                construir sua propria realizacao.
              </p>
              <p>
                O Cancioneiro nao documenta hits. Documenta repertorio. Fama,
                sucesso comercial ou memoria afetiva ajudam a formular
                perguntas, mas nao bastam como criterio editorial.
              </p>
              <p>
                A entrada de uma obra considera permanencia, circulacao entre
                musicos, importancia para uma linguagem brasileira, influencia,
                regravacoes relevantes, valor instrumental, valor historico e
                representatividade dentro de uma tradicao.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
