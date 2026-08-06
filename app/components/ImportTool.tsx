"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import type { Song } from "../catalog";
import { publicUrl } from "../url";
import {
  defaultEditorialFields,
  metadataFromMusicXml,
  musicXmlWithDisplayMetadata,
  slugify,
} from "../../lib/musicxml-metadata.mjs";

type ImportMetadata = ReturnType<typeof metadataFromMusicXml>;
type SaveState = "idle" | "saving" | "saved" | "error";

type ManagedSong = Song & {
  editorial?: {
    genre?: string;
    level?: string;
    notes?: string;
    source?: string;
    tags?: string[];
  };
  path: string;
};

function splitTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function editorialSnippet(id: string, editorial: EditorialFields) {
  return JSON.stringify(
    {
      [id]: {
        genre: editorial.genre || defaultEditorialFields.genre,
        level: editorial.level || defaultEditorialFields.level,
        notes: editorial.notes,
        source: editorial.source || defaultEditorialFields.source,
        tags: splitTags(editorial.tags),
      },
    },
    null,
    2,
  );
}

type EditorialFields = {
  genre: string;
  level: string;
  notes: string;
  source: string;
  tags: string;
};

const initialEditorial: EditorialFields = {
  genre: defaultEditorialFields.genre,
  level: defaultEditorialFields.level,
  notes: "",
  source: defaultEditorialFields.source,
  tags: "",
};

function fieldsFromSong(song: ManagedSong): EditorialFields {
  return {
    genre: song.editorial?.genre || song.genre || defaultEditorialFields.genre,
    level: song.editorial?.level || song.level || defaultEditorialFields.level,
    notes: song.editorial?.notes ?? song.notes ?? "",
    source: song.editorial?.source || song.source || defaultEditorialFields.source,
    tags: (song.editorial?.tags || song.tags || []).join(", "),
  };
}

export function ImportTool() {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);
  const [fileName, setFileName] = useState("");
  const [scoreXml, setScoreXml] = useState("");
  const [metadata, setMetadata] = useState<ImportMetadata | null>(null);
  const [editorial, setEditorial] = useState<EditorialFields>(initialEditorial);
  const [message, setMessage] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [overwrite, setOverwrite] = useState(false);
  const [suggestedId, setSuggestedId] = useState("");
  const [managedSongs, setManagedSongs] = useState<ManagedSong[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [libraryState, setLibraryState] = useState<SaveState>("idle");
  const [deleteState, setDeleteState] = useState<SaveState>("idle");

  const effectiveId = suggestedId.trim() || metadata?.id || "nova-peca";
  const suggestedFileName = `${effectiveId}.musicxml`;
  const suggestedPath = `public/musicxml/${suggestedFileName}`;

  const catalogPreview = useMemo(() => {
    if (!metadata) return "";

    return JSON.stringify(
      {
        id: effectiveId,
        title: metadata.title,
        composer: metadata.composer,
        genre: editorial.genre || defaultEditorialFields.genre,
        key: metadata.key,
        level: editorial.level || defaultEditorialFields.level,
        instrumentation: metadata.instrumentation,
        source: editorial.source || defaultEditorialFields.source,
        musicxml: `/musicxml/${suggestedFileName}`,
        notes: editorial.notes,
        chords: metadata.chords,
        tags: splitTags(editorial.tags),
      },
      null,
      2,
    );
  }, [editorial, effectiveId, metadata, suggestedFileName]);

  async function refreshLibrary() {
    setLibraryState("saving");

    try {
      const response = await fetch("/api/import");
      const result = (await response.json()) as {
        error?: string;
        songs?: ManagedSong[];
      };

      if (!response.ok) {
        throw new Error(result.error || "Nao consegui carregar o acervo.");
      }

      setManagedSongs(result.songs || []);
      setLibraryState("idle");
    } catch (error) {
      console.error(error);
      setLibraryState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Nao consegui carregar o acervo local.",
      );
    }
  }

  function resetForm() {
    setFileName("");
    setScoreXml("");
    setMetadata(null);
    setEditorial(initialEditorial);
    setMessage(null);
    setSaveState("idle");
    setOverwrite(false);
    setSuggestedId("");
    setSelectedId(null);
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;

    setMessage(null);
    setFileName(file.name);

    try {
      const xml = await file.text();
      const nextMetadata = metadataFromMusicXml(xml, file.name);
      setScoreXml(musicXmlWithDisplayMetadata(xml, file.name));
      setMetadata(nextMetadata);
      setSuggestedId(nextMetadata.id);
      setEditorial(initialEditorial);
      setSelectedId(null);
      setOverwrite(false);
      setSaveState("idle");
    } catch (error) {
      console.error(error);
      setScoreXml("");
      setMetadata(null);
      setMessage("Nao consegui ler este arquivo como MusicXML completo.");
    }
  }

  async function loadManagedSong(song: ManagedSong) {
    setMessage(null);
    setSaveState("idle");
    setDeleteState("idle");

    try {
      const response = await fetch(publicUrl(song.musicxml));
      if (!response.ok) {
        throw new Error(`Nao consegui carregar ${song.musicxml}.`);
      }

      const xml = await response.text();
      const filename = song.musicxml.split("/").pop() || `${song.id}.musicxml`;
      const nextMetadata = metadataFromMusicXml(xml, filename);
      setFileName(song.path);
      setScoreXml(musicXmlWithDisplayMetadata(xml, filename));
      setMetadata(nextMetadata);
      setSuggestedId(song.id);
      setEditorial(fieldsFromSong(song));
      setOverwrite(true);
      setSelectedId(song.id);
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Nao consegui carregar esta musica para edicao.",
      );
    }
  }

  async function saveImport() {
    if (!metadata || !scoreXml) return;

    setMessage(null);
    setSaveState("saving");

    try {
      const response = await fetch("/api/import", {
        body: JSON.stringify({
          currentId: selectedId,
          editorial: {
            genre: editorial.genre,
            level: editorial.level,
            notes: editorial.notes,
            source: editorial.source,
            tags: splitTags(editorial.tags),
          },
          id: effectiveId,
          overwrite,
          xml: scoreXml,
        }),
        headers: { "Content-Type": "application/json" },
        method: selectedId ? "PUT" : "POST",
      });
      const result = (await response.json()) as {
        error?: string;
        id?: string;
        path?: string;
      };

      if (!response.ok) {
        throw new Error(result.error || "Nao consegui salvar a importacao.");
      }

      setSaveState("saved");
      setSelectedId(result.id || effectiveId);
      setOverwrite(true);
      setMessage(
        `${selectedId ? "Edicao" : "Importacao"} gravada em ${result.path}. Catalogo atualizado com sucesso.`,
      );
      await refreshLibrary();
    } catch (error) {
      console.error(error);
      setSaveState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Nao consegui salvar a importacao local.",
      );
    }
  }

  async function deleteImport() {
    if (!selectedId) return;
    const title = metadata?.title || selectedId;

    if (!window.confirm(`Excluir "${title}" do acervo local?`)) {
      return;
    }

    setMessage(null);
    setDeleteState("saving");

    try {
      const response = await fetch("/api/import", {
        body: JSON.stringify({ id: selectedId }),
        headers: { "Content-Type": "application/json" },
        method: "DELETE",
      });
      const result = (await response.json()) as {
        deleted?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error || "Nao consegui excluir a musica.");
      }

      setDeleteState("saved");
      resetForm();
      setMessage(`Musica ${result.deleted || selectedId} excluida do acervo local.`);
      await refreshLibrary();
    } catch (error) {
      console.error(error);
      setDeleteState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Nao consegui excluir esta musica.",
      );
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshLibrary(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let currentOsmd: OpenSheetMusicDisplay | null = null;

    async function renderPreview() {
      if (!scoreXml || !previewRef.current) return;

      previewRef.current.replaceChildren();

      try {
        const { OpenSheetMusicDisplay } = await import("opensheetmusicdisplay");

        if (cancelled || !previewRef.current) return;

        const osmd = new OpenSheetMusicDisplay(previewRef.current, {
          autoResize: true,
          backend: "svg",
          drawTitle: true,
        });
        currentOsmd = osmd;
        osmd.zoom = 0.75;
        await osmd.load(scoreXml);

        if (cancelled) {
          osmd.setOptions({ autoResize: false });
          osmd.clear();
          return;
        }

        osmd.render();
        osmdRef.current = osmd;
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setMessage("Metadados extraidos, mas nao consegui renderizar a partitura.");
        }
      }
    }

    renderPreview();

    return () => {
      cancelled = true;
      if (currentOsmd) {
        currentOsmd.setOptions({ autoResize: false });
        currentOsmd.clear();
      }
      if (osmdRef.current === currentOsmd) osmdRef.current = null;
    };
  }, [scoreXml]);

  return (
    <main className="min-h-screen bg-[#f7f5ef] text-[#181714]">
      <section className="border-b border-[#d8d0c1] bg-[#fffdf8]">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-5 py-6 md:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#8a4c2f]">
              Ferramenta local
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-normal">
              Importar MusicXML
            </h1>
          </div>

          <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-[#b99f8d] bg-[#fdfaf3] p-6 text-center transition hover:bg-[#f3efe5]">
            <span className="text-base font-medium text-[#4d473d]">
              Selecionar arquivo MusicXML
            </span>
            <span className="mt-1 text-sm text-[#70695e]">
              {fileName || "Arraste mentalmente ate aqui: .musicxml ou .xml"}
            </span>
            <input
              accept=".musicxml,.xml,application/xml,text/xml"
              className="sr-only"
              onChange={(event) => void handleFile(event.target.files?.[0])}
              type="file"
            />
          </label>

          <div className="rounded-md border border-[#d8d0c1] bg-[#fdfaf3] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Acervo local</h2>
                <p className="mt-1 text-sm text-[#70695e]">
                  {libraryState === "saving"
                    ? "Carregando musicas..."
                    : `${managedSongs.length} musica(s) no catalogo`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-md border border-[#b99f8d] bg-white px-3 py-2 text-sm font-medium text-[#4b3024] transition hover:bg-[#f3efe5]"
                  onClick={() => void refreshLibrary()}
                  type="button"
                >
                  Atualizar
                </button>
                <button
                  className="rounded-md border border-[#8a4c2f] bg-[#8a4c2f] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#713b23]"
                  onClick={resetForm}
                  type="button"
                >
                  Nova importacao
                </button>
              </div>
            </div>

            {managedSongs.length > 0 ? (
              <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {managedSongs.map((song) => (
                  <button
                    className={`rounded-md border p-3 text-left transition ${
                      selectedId === song.id
                        ? "border-[#8a4c2f] bg-white"
                        : "border-[#d8d0c1] bg-[#fffdf8] hover:border-[#b99f8d]"
                    }`}
                    key={song.id}
                    onClick={() => void loadManagedSong(song)}
                    type="button"
                  >
                    <span className="block truncate text-sm font-semibold">
                      {song.title}
                    </span>
                    <span className="mt-1 block truncate text-xs text-[#70695e]">
                      {song.composer}
                    </span>
                    <span className="mt-2 block truncate font-mono text-[11px] text-[#8a4c2f]">
                      {song.id}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-md border border-[#d8d0c1] bg-[#fffdf8] p-3 text-sm text-[#70695e]">
                Nenhuma musica carregada pelo catalogo local.
              </p>
            )}
          </div>

          {message ? (
            <p className="rounded-md border border-[#c78f8f] bg-[#fff8f6] p-3 text-sm text-[#8a2f2f]">
              {message}
            </p>
          ) : null}
        </div>
      </section>

      {metadata ? (
        <section className="mx-auto grid w-full max-w-7xl gap-5 px-5 py-5 md:grid-cols-[360px_1fr] md:px-8">
          <aside className="flex flex-col gap-4">
            <div className="rounded-md border border-[#d8d0c1] bg-[#fffdf8] p-4">
              <h2 className="text-lg font-semibold">Metadados extraidos</h2>
              <dl className="mt-4 grid gap-3 text-sm">
                {[
                  ["Titulo", metadata.title],
                  ["Compositor", metadata.composer],
                  ["Tom", metadata.key],
                  ["Instrumentacao", metadata.instrumentation],
                  ["Cifras", metadata.chords.join(" / ") || "Nao informado"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="font-medium text-[#70695e]">{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="rounded-md border border-[#d8d0c1] bg-[#fffdf8] p-4">
              <h2 className="text-lg font-semibold">Campos editoriais</h2>
              <div className="mt-4 grid gap-3">
                <label className="flex flex-col gap-2 text-sm font-medium text-[#4d473d]">
                  ID
                  <input
                    className="h-10 rounded-md border border-[#cfc6b5] bg-white px-3 outline-none transition focus:border-[#8a4c2f] focus:ring-2 focus:ring-[#e6d4c8]"
                    onChange={(event) => setSuggestedId(slugify(event.target.value))}
                    value={effectiveId}
                  />
                </label>
                {(["genre", "level", "source", "tags"] as const).map((field) => (
                  <label
                    className="flex flex-col gap-2 text-sm font-medium text-[#4d473d]"
                    key={field}
                  >
                    {field}
                    <input
                      className="h-10 rounded-md border border-[#cfc6b5] bg-white px-3 outline-none transition focus:border-[#8a4c2f] focus:ring-2 focus:ring-[#e6d4c8]"
                      onChange={(event) =>
                        setEditorial((current) => ({
                          ...current,
                          [field]: event.target.value,
                        }))
                      }
                      value={editorial[field]}
                    />
                  </label>
                ))}
                <label className="flex flex-col gap-2 text-sm font-medium text-[#4d473d]">
                  notes
                  <textarea
                    className="min-h-24 rounded-md border border-[#cfc6b5] bg-white px-3 py-2 outline-none transition focus:border-[#8a4c2f] focus:ring-2 focus:ring-[#e6d4c8]"
                    onChange={(event) =>
                      setEditorial((current) => ({
                        ...current,
                        notes: event.target.value,
                      }))
                    }
                    value={editorial.notes}
                  />
                </label>
              </div>
            </div>

            <div className="rounded-md border border-[#d8d0c1] bg-[#fffdf8] p-4">
              <h2 className="text-lg font-semibold">
                {selectedId ? "Editar registro" : "Destino sugerido"}
              </h2>
              {selectedId ? (
                <p className="mt-2 rounded border border-[#d8d0c1] bg-[#fdfaf3] p-3 font-mono text-xs">
                  {selectedId}
                </p>
              ) : null}
              <p className="mt-3 rounded border border-[#d8d0c1] bg-[#fdfaf3] p-3 font-mono text-xs">
                {suggestedPath}
              </p>
              {!selectedId ? (
                <label className="mt-4 flex items-center gap-2 text-sm font-medium text-[#4d473d]">
                  <input
                    checked={overwrite}
                    className="accent-[#8a4c2f]"
                    onChange={(event) => setOverwrite(event.target.checked)}
                    type="checkbox"
                  />
                  Sobrescrever MusicXML existente
                </label>
              ) : null}
              <button
                className="mt-4 w-full rounded-md border border-[#8a4c2f] bg-[#8a4c2f] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#713b23] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={saveState === "saving"}
                onClick={() => void saveImport()}
                type="button"
              >
                {saveState === "saving"
                  ? "Gravando..."
                  : selectedId
                    ? "Salvar edicao"
                    : "Gravar no repositorio local"}
              </button>
              {selectedId ? (
                <button
                  className="mt-3 w-full rounded-md border border-[#a04a3c] bg-white px-3 py-2 text-sm font-semibold text-[#8a2f2f] transition hover:bg-[#fff8f6] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={deleteState === "saving"}
                  onClick={() => void deleteImport()}
                  type="button"
                >
                  {deleteState === "saving" ? "Excluindo..." : "Excluir musica"}
                </button>
              ) : null}
            </div>
          </aside>

          <article className="min-w-0 rounded-md border border-[#d8d0c1] bg-[#fffdf8]">
            <div className="border-b border-[#d8d0c1] p-4">
              <h2 className="text-lg font-semibold">Saida para o acervo</h2>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm font-medium text-[#70695e]">
                    Entrada para data/editorial.json
                  </p>
                  <pre className="max-h-80 overflow-auto rounded-md border border-[#d8d0c1] bg-[#fdfaf3] p-3 text-xs">
                    {editorialSnippet(effectiveId, editorial)}
                  </pre>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium text-[#70695e]">
                    Previa do catalogo gerado
                  </p>
                  <pre className="max-h-80 overflow-auto rounded-md border border-[#d8d0c1] bg-[#fdfaf3] p-3 text-xs">
                    {catalogPreview}
                  </pre>
                </div>
              </div>
            </div>

            <div className="p-4">
              <h2 className="mb-3 text-lg font-semibold">Previa da partitura</h2>
              <div className="min-h-[520px] overflow-auto rounded-md border border-[#d8d0c1] bg-white p-4">
                <div className="min-h-[460px] min-w-[720px]" ref={previewRef} />
              </div>
            </div>
          </article>
        </section>
      ) : (
        <section className="mx-auto w-full max-w-7xl px-5 py-8 md:px-8">
          <div className="rounded-md border border-[#d8d0c1] bg-[#fffdf8] p-6 text-sm leading-6 text-[#5f5a50]">
            Selecione um MusicXML novo ou escolha uma musica do acervo local
            para editar os metadados editoriais, substituir o arquivo ou excluir
            o registro.
          </div>
        </section>
      )}
    </main>
  );
}
