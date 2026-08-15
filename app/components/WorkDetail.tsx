"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  ImportLibraryResponse,
  ManagedDossier,
  ManagedSong,
} from "../import-types";

export function WorkDetail({ workId }: { workId: string }) {
  const [dossier, setDossier] = useState<ManagedDossier | null>(null);
  const [song, setSong] = useState<ManagedSong | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let disposed = false;
    void fetch("/api/import")
      .then(async (response) => {
        const result = (await response.json()) as ImportLibraryResponse;
        if (!response.ok) throw new Error(result.error || "Nao consegui carregar o dossie.");
        const found = result.dossiers?.find((item) => item.workId === workId) ?? null;
        if (!found) throw new Error(`Dossie nao encontrado: ${workId}`);
        if (!disposed) {
          setDossier(found);
          setSong(
            result.songs?.find((item) => item.id === found.publicCatalogId) ?? null,
          );
        }
      })
      .catch((loadError) => {
        if (!disposed) {
          setError(loadError instanceof Error ? loadError.message : "Falha ao carregar.");
        }
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [workId]);

  const creatorLabel = useMemo(
    () => dossier?.creators.map((creator) => `${creator.name} (${creator.role})`).join(", "),
    [dossier],
  );

  if (loading) {
    return <main className="mx-auto max-w-5xl px-5 py-8 text-sm text-[#70695e]">Carregando dossie...</main>;
  }
  if (error || !dossier) {
    return (
      <main className="mx-auto max-w-5xl px-5 py-8">
        <p className="rounded-md border border-[#c78f8f] bg-[#fff8f6] p-4 text-sm text-[#8a2f2f]">
          {error || "Dossie nao encontrado."}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 md:px-8">
      <a className="text-sm font-semibold text-[#8a4c2f] underline" href="/import/acervo">
        Voltar ao acervo
      </a>
      <div className="mt-5 flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <p className="font-mono text-xs text-[#8a4c2f]">{dossier.workId}</p>
          <h1 className="mt-2 text-4xl font-semibold">{dossier.title}</h1>
          <p className="mt-2 text-sm text-[#70695e]">{creatorLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dossier.editions.length > 0 ? (
            <>
              <a
                className="rounded-md border border-[#8a4c2f] bg-white px-3 py-2 text-sm font-semibold text-[#8a4c2f]"
                href={`/import/obras/${encodeURIComponent(dossier.workId)}/editar`}
              >
                Editar metadados
              </a>
              <a
                className="rounded-md border border-[#8a4c2f] bg-[#8a4c2f] px-3 py-2 text-sm font-semibold text-white"
                href={`/import/obras/${encodeURIComponent(dossier.workId)}/revisar`}
              >
                Revisar para promocao
              </a>
            </>
          ) : null}
          <span className="rounded border border-[#d8d0c1] bg-[#fffdf8] px-3 py-2 text-sm font-semibold">
            {dossier.status}
          </span>
        </div>
      </div>

      <section className="mt-7 grid gap-5 md:grid-cols-2">
        <article className="rounded-md border border-[#d8d0c1] bg-[#fffdf8] p-5">
          <h2 className="text-lg font-semibold">Edicoes</h2>
          <ul className="mt-4 space-y-3">
            {dossier.editions.map((edition) => (
              <li className="rounded border border-[#e1dbcf] p-3" key={edition.id}>
                <p className="text-sm font-semibold">{edition.title}</p>
                <p className="mt-1 font-mono text-[11px] text-[#70695e]">{edition.id}</p>
                <p className="mt-1 text-xs text-[#8a4c2f]">{edition.status}</p>
                <a
                  className="mt-3 inline-block text-xs font-semibold text-[#8a4c2f] underline"
                  href={`/import/obras/${encodeURIComponent(dossier.workId)}/editar?edition=${encodeURIComponent(edition.id)}`}
                >
                  Editar esta edicao
                </a>
              </li>
            ))}
          </ul>
        </article>
        <article className="rounded-md border border-[#d8d0c1] bg-[#fffdf8] p-5">
          <h2 className="text-lg font-semibold">Fontes</h2>
          {dossier.sources.length ? (
            <ul className="mt-4 space-y-3">
              {dossier.sources.map((source) => (
                <li key={source.id}>
                  <p className="text-sm font-semibold">{source.title}</p>
                  <p className="mt-1 text-xs text-[#70695e]">
                    {source.type}{source.reference ? ` · ${source.reference}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-[#70695e]">Nenhuma fonte estruturada.</p>
          )}
        </article>
        <article className="rounded-md border border-[#d8d0c1] bg-[#fffdf8] p-5 md:col-span-2">
          <h2 className="text-lg font-semibold">Decisao e projecao publica</h2>
          {dossier.currentDecision ? (
            <div className="mt-4 text-sm text-[#5f5a50]">
              <p className="font-semibold text-[#1f1e1b]">{dossier.currentDecision.status}</p>
              <p className="mt-1 text-xs">
                {dossier.currentDecision.decidedAt} · {dossier.currentDecision.decidedBy}
              </p>
              <p className="mt-3 leading-relaxed">{dossier.currentDecision.justification}</p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-[#70695e]">Nenhuma decisao vigente.</p>
          )}
          {dossier.projectionIssues.length ? (
            <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-[#70431f]">
              {dossier.projectionIssues.map((issue) => <li key={issue}>{issue}</li>)}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-[#3f5d35]">Projecao publica sem pendencias.</p>
          )}
          <div className="mt-4 rounded border border-[#e1dbcf] bg-white p-3 text-sm">
            <p>
              Direitos: <strong>{dossier.rightsStatus}</strong>
            </p>
            {dossier.blockedPromotionRights.length ? (
              <p className="mt-1 text-xs text-[#70431f]">
                {dossier.blockedPromotionRights.length} permissao(oes) ainda bloqueiam a promocao.
              </p>
            ) : (
              <p className="mt-1 text-xs text-[#3f5d35]">Permissoes de promocao liberadas.</p>
            )}
          </div>
          {song ? (
            <p className="mt-4 text-xs text-[#70695e]">
              Asset publico: <span className="font-mono">{song.path}</span>
            </p>
          ) : null}
        </article>
      </section>
    </main>
  );
}
