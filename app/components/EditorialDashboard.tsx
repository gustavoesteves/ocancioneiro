"use client";

import { useEffect, useState } from "react";
import type {
  ImportLibraryResponse,
  ImportReviewResponse,
} from "../import-types";

type PublicationSummary = {
  error?: string;
  local?: {
    branch: string;
    changes: unknown[];
    clean: boolean;
    verification: { current: boolean; passed: boolean } | null;
  };
};

type DashboardState = {
  error: string | null;
  library: ImportLibraryResponse | null;
  publication: PublicationSummary | null;
  review: ImportReviewResponse | null;
};

const initialState: DashboardState = {
  error: null,
  library: null,
  publication: null,
  review: null,
};

async function json<T>(url: string) {
  const response = await fetch(url);
  const result = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(result.error || `Falha ao carregar ${url}.`);
  return result;
}

export function EditorialDashboard() {
  const [state, setState] = useState<DashboardState>(initialState);

  useEffect(() => {
    let disposed = false;
    void Promise.all([
      json<ImportLibraryResponse>("/api/import"),
      json<ImportReviewResponse>("/api/import/review"),
      json<PublicationSummary>("/api/import/publication"),
    ])
      .then(([library, review, publication]) => {
        if (!disposed) setState({ error: null, library, publication, review });
      })
      .catch((error) => {
        if (!disposed) {
          setState((current) => ({
            ...current,
            error: error instanceof Error ? error.message : "Falha ao carregar o painel.",
          }));
        }
      });
    return () => {
      disposed = true;
    };
  }, []);

  const pendingCaptures =
    state.review?.captures?.filter((capture) => !capture.promoted).length ?? 0;
  const pendingDossiers =
    state.library?.dossiers?.filter((dossier) => !dossier.publicable).length ?? 0;
  const changes = state.publication?.local?.changes.length ?? 0;

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-8 md:px-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#8a4c2f]">
            Visao geral
          </p>
          <h1 className="mt-2 text-4xl font-semibold">Painel editorial</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#70695e]">
            Cada etapa tem agora sua propria area. Capturas privadas continuam fora
            do site ate serem revisadas e promovidas explicitamente.
          </p>
        </div>
        <a
          className="rounded-md border border-[#8a4c2f] bg-[#8a4c2f] px-4 py-2 text-sm font-semibold text-white"
          href="/import/capturar"
        >
          Nova captura
        </a>
      </div>

      {state.error ? (
        <p className="mt-6 rounded-md border border-[#c78f8f] bg-[#fff8f6] p-4 text-sm text-[#8a2f2f]">
          {state.error}
        </p>
      ) : null}

      <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Acervo publico", state.library?.songs?.length, "musica(s)", "/import/acervo"],
          ["Dossies", state.library?.dossiers?.length, `${pendingDossiers} pendente(s)`, "/import/acervo"],
          ["Capturas privadas", pendingCaptures, "aguardando promocao", "/import/revisao"],
          ["Lote local", changes, "mudanca(s)", "/import/publicacao"],
        ].map(([label, value, detail, href]) => (
          <a
            className="rounded-md border border-[#d8d0c1] bg-[#fffdf8] p-5 transition hover:border-[#b99f8d]"
            href={String(href)}
            key={String(label)}
          >
            <p className="text-sm font-semibold text-[#4d473d]">{label}</p>
            <p className="mt-3 text-3xl font-semibold">{value ?? "—"}</p>
            <p className="mt-1 text-xs text-[#70695e]">{detail}</p>
          </a>
        ))}
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="rounded-md border border-[#d8d0c1] bg-[#fffdf8] p-5">
          <h2 className="text-lg font-semibold">Fluxo recomendado</h2>
          <ol className="mt-4 space-y-3 text-sm text-[#5f5a50]">
            {[
              ["1", "Capturar", "Receber e conferir o MusicXML."],
              ["2", "Revisar", "Validar identidade, edicao e pendencias."],
              ["3", "Promover", "Gerar o asset publico de forma explicita."],
              ["4", "Publicar", "Verificar, abrir PR e acompanhar o deploy."],
            ].map(([number, title, description]) => (
              <li className="flex gap-3" key={number}>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f0e4da] font-mono text-xs text-[#8a4c2f]">
                  {number}
                </span>
                <span>
                  <strong className="block text-[#1f1e1b]">{title}</strong>
                  {description}
                </span>
              </li>
            ))}
          </ol>
        </div>
        <div className="rounded-md border border-[#d8d0c1] bg-[#fffdf8] p-5">
          <h2 className="text-lg font-semibold">Estado do lote</h2>
          <p className="mt-3 text-sm text-[#5f5a50]">
            Branch: <span className="font-mono">{state.publication?.local?.branch || "—"}</span>
          </p>
          <p className="mt-2 text-sm text-[#5f5a50]">
            Verificacao: {state.publication?.local?.verification?.current &&
            state.publication.local.verification.passed
              ? "valida para o conjunto atual"
              : "pendente ou desatualizada"}
          </p>
          <a
            className="mt-5 inline-block text-sm font-semibold text-[#8a4c2f] underline"
            href="/import/publicacao"
          >
            Abrir fluxo de publicacao
          </a>
        </div>
      </section>
    </main>
  );
}
