"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  EditableEdition,
  EditionEditorResponse,
} from "../import-types";

type FormFields = {
  genre: string;
  level: string;
  notes: string;
  source: string;
  tags: string;
};

const emptyFields: FormFields = {
  genre: "",
  level: "",
  notes: "",
  source: "",
  tags: "",
};

function fieldsFromEdition(edition: EditableEdition): FormFields {
  return {
    genre: edition.genre,
    level: edition.level,
    notes: edition.notes,
    source: edition.source,
    tags: edition.tags.join(", "),
  };
}

function splitTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function EditionMetadataEditor({ workId }: { workId: string }) {
  const [data, setData] = useState<EditionEditorResponse | null>(null);
  const [selectedEditionId, setSelectedEditionId] = useState("");
  const [fields, setFields] = useState<FormFields>(emptyFields);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedEdition = useMemo(
    () => data?.editions?.find((edition) => edition.id === selectedEditionId) ?? null,
    [data?.editions, selectedEditionId],
  );

  function selectEdition(editionId: string, result = data) {
    const edition = result?.editions?.find((item) => item.id === editionId);
    setSelectedEditionId(editionId);
    setFields(edition ? fieldsFromEdition(edition) : emptyFields);
    setNotice(null);
    setError(null);
  }

  async function save() {
    if (!data?.fingerprint || !selectedEditionId) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(
        `/api/import/dossiers/${encodeURIComponent(workId)}`,
        {
          body: JSON.stringify({
            editionId: selectedEditionId,
            expectedFingerprint: data.fingerprint,
            genre: fields.genre,
            level: fields.level,
            notes: fields.notes,
            source: fields.source,
            tags: splitTags(fields.tags),
          }),
          headers: { "Content-Type": "application/json" },
          method: "PUT",
        },
      );
      const result = (await response.json()) as EditionEditorResponse;
      if (!response.ok || !result.editions || !result.fingerprint) {
        throw new Error(result.error || "Nao consegui salvar os metadados.");
      }
      setData(result);
      selectEdition(selectedEditionId, result);
      setNotice(
        result.updated
          ? "Metadados salvos no dossie e catalogo regenerado. O MusicXML nao foi alterado."
          : "Nenhuma alteracao de metadados foi detectada.",
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Falha ao salvar os metadados.",
      );
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    let disposed = false;
    void fetch(`/api/import/dossiers/${encodeURIComponent(workId)}`)
      .then(async (response) => {
        const result = (await response.json()) as EditionEditorResponse;
        if (!response.ok || !result.editions || !result.fingerprint || !result.work) {
          throw new Error(result.error || "Nao consegui carregar as edicoes.");
        }
        if (disposed) return;
        setData(result);
        const requestedEdition = new URLSearchParams(window.location.search).get(
          "edition",
        );
        const initialEditionId =
          result.editions.find((edition) => edition.id === requestedEdition)?.id ??
          result.preferredEditionId ??
          result.editions[0]?.id ??
          "";
        const edition = result.editions.find((item) => item.id === initialEditionId);
        setSelectedEditionId(initialEditionId);
        setFields(edition ? fieldsFromEdition(edition) : emptyFields);
      })
      .catch((loadError) => {
        if (!disposed) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Falha ao carregar as edicoes.",
          );
        }
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [workId]);

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8 md:px-8">
      <a
        className="text-sm font-semibold text-[#8a4c2f] underline"
        href={`/import/obras/${encodeURIComponent(workId)}`}
      >
        Voltar ao dossie
      </a>
      <div className="mt-5">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#8a4c2f]">
          Metadados da edicao
        </p>
        <h1 className="mt-2 text-4xl font-semibold">
          {data?.work?.title ?? "Editar edicao"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#70695e]">
          Ajuste a classificacao catalografica da edicao. Esta operacao nao
          substitui, move ou regrava a partitura MusicXML.
        </p>
      </div>

      {error ? (
        <p className="mt-6 rounded-md border border-[#c78f8f] bg-[#fff8f6] p-4 text-sm text-[#8a2f2f]">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="mt-6 rounded-md border border-[#8da27f] bg-[#edf5e9] p-4 text-sm text-[#3f5d35]">
          {notice}
        </p>
      ) : null}

      <section className="mt-7 rounded-md border border-[#d8d0c1] bg-[#fffdf8] p-5">
        {loading ? (
          <p className="text-sm text-[#70695e]">Carregando edicoes...</p>
        ) : data?.editions?.length ? (
          <div className="grid gap-5 md:grid-cols-[240px_minmax(0,1fr)]">
            <div>
              <label className="flex flex-col gap-2 text-sm font-semibold text-[#4d473d]">
                Edicao
                <select
                  className="h-10 rounded-md border border-[#cfc6b5] bg-white px-3"
                  disabled={saving}
                  onChange={(event) => selectEdition(event.target.value)}
                  value={selectedEditionId}
                >
                  {data.editions.map((edition) => (
                    <option key={edition.id} value={edition.id}>
                      {edition.title} — {edition.status}
                    </option>
                  ))}
                </select>
              </label>
              {selectedEdition ? (
                <div className="mt-4 rounded-md border border-[#e1dbcf] bg-[#fdfaf3] p-3 text-xs text-[#5f5a50]">
                  <p className="font-mono break-all">{selectedEdition.id}</p>
                  <p className="mt-2">Estado musical: {selectedEdition.status}</p>
                </div>
              ) : null}
            </div>

            <div className="grid gap-4">
              {([
                ["genre", "Genero"],
                ["level", "Nivel"],
                ["source", "Fonte editorial"],
                ["tags", "Tags separadas por virgula"],
              ] as [keyof FormFields, string][]).map(([field, label]) => (
                <label className="flex flex-col gap-2 text-sm font-semibold text-[#4d473d]" key={field}>
                  {label}
                  <input
                    className="h-10 rounded-md border border-[#cfc6b5] bg-white px-3 outline-none transition focus:border-[#8a4c2f] focus:ring-2 focus:ring-[#e6d4c8]"
                    disabled={saving}
                    maxLength={field === "source" ? 512 : undefined}
                    onChange={(event) =>
                      setFields((current) => ({ ...current, [field]: event.target.value }))
                    }
                    required={field !== "tags"}
                    value={fields[field]}
                  />
                </label>
              ))}
              <label className="flex flex-col gap-2 text-sm font-semibold text-[#4d473d]">
                Notas editoriais
                <textarea
                  className="min-h-28 rounded-md border border-[#cfc6b5] bg-white px-3 py-2 outline-none transition focus:border-[#8a4c2f] focus:ring-2 focus:ring-[#e6d4c8]"
                  disabled={saving}
                  maxLength={5000}
                  onChange={(event) =>
                    setFields((current) => ({ ...current, notes: event.target.value }))
                  }
                  value={fields.notes}
                />
              </label>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e1dbcf] pt-4">
                <p className="text-xs text-[#70695e]">
                  Salvar atualiza o dossie e a projecao do catalogo local.
                </p>
                <button
                  className="rounded-md border border-[#8a4c2f] bg-[#8a4c2f] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={
                    saving ||
                    !selectedEdition ||
                    !fields.genre.trim() ||
                    !fields.level.trim() ||
                    !fields.source.trim()
                  }
                  onClick={() => void save()}
                  type="button"
                >
                  {saving ? "Salvando..." : "Salvar metadados"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[#70695e]">
            Este dossie ainda nao possui edicao para classificar.
          </p>
        )}
      </section>
    </main>
  );
}
