"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import {
  defaultEditorialFields,
  metadataFromMusicXml,
  slugify,
} from "../../lib/musicxml-metadata.mjs";

type ImportMetadata = ReturnType<typeof metadataFromMusicXml>;

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

export function ImportTool() {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);
  const [fileName, setFileName] = useState("");
  const [scoreXml, setScoreXml] = useState("");
  const [metadata, setMetadata] = useState<ImportMetadata | null>(null);
  const [editorial, setEditorial] = useState<EditorialFields>(initialEditorial);
  const [message, setMessage] = useState<string | null>(null);
  const [suggestedId, setSuggestedId] = useState("");

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

  async function handleFile(file: File | undefined) {
    if (!file) return;

    setMessage(null);
    setFileName(file.name);

    try {
      const xml = await file.text();
      const nextMetadata = metadataFromMusicXml(xml, file.name);
      setScoreXml(xml);
      setMetadata(nextMetadata);
      setSuggestedId(nextMetadata.id);
      setEditorial(initialEditorial);
    } catch (error) {
      console.error(error);
      setScoreXml("");
      setMetadata(null);
      setMessage("Nao consegui ler este arquivo como MusicXML completo.");
    }
  }

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
              <h2 className="text-lg font-semibold">Destino sugerido</h2>
              <p className="mt-3 rounded border border-[#d8d0c1] bg-[#fdfaf3] p-3 font-mono text-xs">
                {suggestedPath}
              </p>
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
            Esta tela nao salva arquivos automaticamente. Ela prepara o nome do
            MusicXML, a entrada editorial e a previa para voce aplicar no
            repositorio local.
          </div>
        </section>
      )}
    </main>
  );
}
