"use client";

import { useEffect, useMemo, useState } from "react";
import type { ImportReviewResponse, ReviewCapture } from "../import-types";

type CaptureFilter = "all" | "pending" | "promoted";

function formatInstant(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ReviewQueue() {
  const [result, setResult] = useState<ImportReviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<CaptureFilter>("pending");

  async function loadReview() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/import/review");
      const body = (await response.json()) as ImportReviewResponse;
      if (!response.ok) throw new Error(body.error || "Nao consegui carregar a revisao.");
      setResult(body);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Falha ao carregar.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadReview(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const captures = useMemo(() => {
    const all = result?.captures ?? [];
    if (filter === "pending") return all.filter((capture) => !capture.promoted);
    if (filter === "promoted") return all.filter((capture) => capture.promoted);
    return all;
  }, [filter, result?.captures]);

  const pendingCount = result?.captures?.filter((capture) => !capture.promoted).length ?? 0;
  const coverageRows = result?.coverage?.rows ?? [];
  const emptyCriteria = coverageRows.filter((row) => row.evidenceCount === 0);
  const contradictoryCriteria = coverageRows.filter(
    (row) => row.sustenta > 0 && row.contradiz > 0,
  );
  const pendingReviewItems = result?.reviewReport ?? [];

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-8 md:px-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#8a4c2f]">
            Antes de publicar
          </p>
          <h1 className="mt-2 text-4xl font-semibold">Fila de revisao</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#70695e]">
            Capturas privadas e pendencias dos dossies ficam reunidas aqui. Nenhum
            MusicXML bruto, caminho local ou nome do responsavel e exposto pela API.
          </p>
        </div>
        <button
          className="rounded-md border border-[#b99f8d] bg-white px-3 py-2 text-sm font-semibold text-[#4b3024]"
          disabled={loading}
          onClick={() => void loadReview()}
          type="button"
        >
          {loading ? "Carregando..." : "Atualizar"}
        </button>
      </div>

      {error ? (
        <p className="mt-6 rounded-md border border-[#c78f8f] bg-[#fff8f6] p-4 text-sm text-[#8a2f2f]">{error}</p>
      ) : null}

      <section className="mt-7 grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Capturas privadas</h2>
            <div className="flex gap-2" role="group" aria-label="Filtrar capturas">
              {([
                ["pending", `Pendentes (${pendingCount})`],
                ["promoted", "Promovidas"],
                ["all", "Todas"],
              ] as [CaptureFilter, string][]).map(([id, label]) => (
                <button
                  aria-pressed={filter === id}
                  className={`rounded-md border px-3 py-2 text-xs font-semibold ${
                    filter === id
                      ? "border-[#8a4c2f] bg-[#8a4c2f] text-white"
                      : "border-[#cfc6b5] bg-white text-[#5f5a50]"
                  }`}
                  key={id}
                  onClick={() => setFilter(id)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {captures.length ? captures.map((capture: ReviewCapture) => (
              <article className="rounded-md border border-[#d8d0c1] bg-[#fffdf8] p-4" key={capture.captureId}>
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <h3 className="font-semibold">{capture.metadata.title}</h3>
                    <p className="mt-1 text-sm text-[#70695e]">{capture.metadata.composer}</p>
                    <p className="mt-2 font-mono text-[11px] text-[#8a4c2f]">{capture.captureId}</p>
                  </div>
                  <span className={`rounded border px-2 py-1 text-xs font-semibold ${
                    capture.promoted
                      ? "border-[#8da27f] bg-[#edf5e9] text-[#3f5d35]"
                      : "border-[#d3a36f] bg-[#fff8e9] text-[#70431f]"
                  }`}>
                    {capture.promoted ? "promovida" : "em revisao"}
                  </span>
                </div>
                <dl className="mt-4 grid gap-2 text-xs text-[#5f5a50] sm:grid-cols-2">
                  <div><dt className="font-semibold">Obra</dt><dd className="mt-1 font-mono">{capture.workId}</dd></div>
                  <div><dt className="font-semibold">Edicao</dt><dd className="mt-1 font-mono">{capture.editionId}</dd></div>
                  <div><dt className="font-semibold">Origem</dt><dd className="mt-1">{capture.technicalOrigin}</dd></div>
                  <div><dt className="font-semibold">Confirmada</dt><dd className="mt-1">{formatInstant(capture.confirmedAt)}</dd></div>
                </dl>
                <div className="mt-4 flex flex-wrap gap-4">
                  <a className="text-xs font-semibold text-[#8a4c2f] underline" href={`/import/obras/${encodeURIComponent(capture.workId)}`}>
                    Consultar dossie
                  </a>
                  {!capture.promoted ? (
                    <a className="text-xs font-semibold text-[#8a4c2f] underline" href={`/import/obras/${encodeURIComponent(capture.workId)}/revisar?edition=${encodeURIComponent(capture.editionId)}`}>
                      Revisar gates editoriais
                    </a>
                  ) : null}
                </div>
              </article>
            )) : (
              <p className="rounded-md border border-[#d8d0c1] bg-white p-5 text-sm text-[#70695e]">
                Nenhuma captura corresponde a este filtro.
              </p>
            )}
          </div>
          {result?.captureIssues?.length ? (
            <div className="mt-4 rounded-md border border-[#c78f8f] bg-[#fff8f6] p-4 text-sm text-[#8a2f2f]">
              {result.captureIssues.length} captura(s) com falha de integridade foram omitidas.
            </div>
          ) : null}
        </div>

        <aside className="space-y-5 xl:sticky xl:top-5 xl:self-start">
          <section className="rounded-md border border-[#d8d0c1] bg-[#fffdf8] p-5">
            <h2 className="text-lg font-semibold">Cobertura documental</h2>
            <p className="mt-1 text-xs text-[#70695e]">
              {result?.coverage?.method.counting ?? "Cada evidencia conta uma vez no criterio declarado."}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded border border-[#e1dbcf] bg-white p-3">
                <p className="text-2xl font-semibold">{emptyCriteria.length}</p>
                <p className="mt-1 text-xs text-[#70695e]">criterio(s) sem evidencia</p>
              </div>
              <div className="rounded border border-[#e1dbcf] bg-white p-3">
                <p className="text-2xl font-semibold">{contradictoryCriteria.length}</p>
                <p className="mt-1 text-xs text-[#70695e]">criterio(s) contraditorio(s)</p>
              </div>
            </div>
            <div className="mt-4 max-h-72 overflow-auto rounded border border-[#e1dbcf] bg-white">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-[#f6f1e8] text-[#4b3024]">
                  <tr>
                    <th className="p-2 font-semibold">Criterio</th>
                    <th className="p-2 font-semibold">Ev.</th>
                    <th className="p-2 font-semibold">Obras</th>
                    <th className="p-2 font-semibold">S/C</th>
                  </tr>
                </thead>
                <tbody>
                  {coverageRows.map((row) => (
                    <tr className="border-t border-[#e1dbcf]" key={row.criterion}>
                      <td className="p-2">{row.criterion.replaceAll("_", " ")}</td>
                      <td className="p-2">{row.evidenceCount}</td>
                      <td className="p-2">{row.workCount}</td>
                      <td className="p-2">{row.sustenta}/{row.contradiz}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-md border border-[#d8d0c1] bg-[#fffdf8] p-5">
            <h2 className="text-lg font-semibold">Dossies com pendencias</h2>
            <p className="mt-1 text-xs text-[#70695e]">{result?.dossiers?.length ?? 0} obra(s)</p>
            <div className="mt-4 max-h-[420px] space-y-3 overflow-auto">
              {result?.dossiers?.map((dossier) => {
                const review = pendingReviewItems.find((item) =>
                  item.label.startsWith(`${dossier.workId} (`),
                );
                const contradictions = review?.pending.filter((item) =>
                  item.startsWith("evidencias contraditorias:"),
                ) ?? [];
                return (
                  <article className="rounded border border-[#e1dbcf] p-3" key={dossier.workId}>
                    <h3 className="text-sm font-semibold">{dossier.title}</h3>
                    <p className="mt-1 text-xs text-[#70695e]">{dossier.status}</p>
                    {contradictions.length ? (
                      <p className="mt-2 rounded border border-[#d3a36f] bg-[#fff8e9] p-2 text-xs font-semibold text-[#70431f]">
                        {contradictions.join("; ")}
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs leading-relaxed text-[#70431f]">
                      {review?.pending[0] || dossier.projectionIssues[0] || "Revisao editorial pendente."}
                    </p>
                    <a className="mt-3 inline-block text-xs font-semibold text-[#8a4c2f] underline" href={`/import/obras/${encodeURIComponent(dossier.workId)}`}>
                      Abrir dossie
                    </a>
                    {dossier.editions.length ? (
                      <a className="ml-4 mt-3 inline-block text-xs font-semibold text-[#8a4c2f] underline" href={`/import/obras/${encodeURIComponent(dossier.workId)}/revisar`}>
                        Revisar gates
                      </a>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
