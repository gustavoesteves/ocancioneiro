"use client";

import { useEffect, useMemo, useState } from "react";

type PublicationChange = {
  blockReason: string | null;
  category: string;
  code: string;
  eligible: boolean;
  path: string;
  staged: boolean;
  unstaged: boolean;
};

type LocalPublicationStatus = {
  branch: string;
  changes: PublicationChange[];
  clean: boolean;
  fingerprint: string;
  head: string;
  release: {
    branch: string;
    commit: string;
    createdAt: string;
    message: string;
    prNumber: number | null;
    prUrl: string | null;
    responsible: string;
  } | null;
  verification: {
    checkedAt: string;
    current: boolean;
    passed: boolean;
    summary: string;
  } | null;
};

type RemotePublicationStatus = {
  available: boolean;
  deployment: {
    conclusion: string | null;
    createdAt: string;
    displayTitle: string;
    status: string;
    url: string;
  } | null;
  message?: string;
  pr: {
    checksReady: boolean;
    headRefOid: string;
    mergeStateStatus: string;
    number: number;
    state: string;
    statusCheckRollup: unknown[];
    title: string;
    url: string;
  } | null;
};

type PublicationResponse = {
  error?: string;
  local?: LocalPublicationStatus;
  remote?: RemotePublicationStatus | null;
};

type PublicationAction = "merge" | "prepare" | "submit" | "verify";

function shortHash(value: string | undefined) {
  return value ? value.slice(0, 12) : "—";
}

function stepClass(active: boolean, complete: boolean) {
  if (complete) return "border-[#8da27f] bg-[#edf5e9] text-[#3f5d35]";
  if (active) return "border-[#d3a36f] bg-[#fff8e9] text-[#70431f]";
  return "border-[#d8d0c1] bg-white text-[#70695e]";
}

export function PublicationPanel({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [local, setLocal] = useState<LocalPublicationStatus | null>(null);
  const [remote, setRemote] = useState<RemotePublicationStatus | null>(null);
  const [responsible, setResponsible] = useState("");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [operation, setOperation] = useState<PublicationAction | "refresh" | null>(
    null,
  );

  async function loadStatus(includeRemote = false) {
    setOperation("refresh");
    setNotice(null);
    try {
      const response = await fetch(
        `/api/import/publication${includeRemote ? "?remote=1" : ""}`,
      );
      const result = (await response.json()) as PublicationResponse;
      if (!response.ok || !result.local) {
        throw new Error(result.error || "Nao consegui carregar a publicacao local.");
      }
      setLocal(result.local);
      if (includeRemote) setRemote(result.remote ?? null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Falha ao atualizar o estado.");
    } finally {
      setOperation(null);
    }
  }

  async function runAction(action: PublicationAction) {
    const confirmations: Partial<Record<PublicationAction, string>> = {
      prepare:
        "Criar uma branch e um commit com todo o conjunto de mudancas revisado?",
      submit: "Enviar a branch ao GitHub e abrir um pull request para revisao?",
      merge:
        "Mesclar o pull request aprovado na main? Isso iniciara o deploy do GitHub Pages.",
    };
    const confirmation = confirmations[action];
    if (confirmation && !window.confirm(confirmation)) return;

    setOperation(action);
    setNotice(null);
    try {
      const response = await fetch("/api/import/publication", {
        body: JSON.stringify({
          action,
          expectedFingerprint: local?.fingerprint,
          message: message.trim(),
          responsible: responsible.trim(),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as PublicationResponse;
      if (!response.ok) {
        throw new Error(result.error || "A operacao de publicacao falhou.");
      }
      if (result.local) setLocal(result.local);
      if (result.remote) setRemote(result.remote);
      setNotice(
        action === "verify"
          ? "Verificacao completa aprovada para estas mudancas."
          : action === "prepare"
            ? "Versao local preparada em uma branch com commit proprio."
            : action === "submit"
              ? "Pull request criado e enviado para verificacao no GitHub."
              : "Pull request mesclado; o deploy do GitHub Pages foi iniciado.",
      );
      if (action === "prepare" && result.local?.release) {
        setMessage(result.local.release.message);
        setResponsible(result.local.release.responsible);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Falha na publicacao.");
    } finally {
      setOperation(null);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadStatus(false), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const categories = useMemo(() => {
    const grouped = new Map<string, PublicationChange[]>();
    for (const change of local?.changes ?? []) {
      const group = grouped.get(change.category) ?? [];
      group.push(change);
      grouped.set(change.category, group);
    }
    return [...grouped.entries()];
  }, [local?.changes]);

  const prepared = Boolean(
    local?.clean && local.release && local.release.commit === local.head,
  );
  const verified = prepared || Boolean(
    local?.verification?.current && local.verification.passed,
  );
  const submitted = Boolean(remote?.pr);
  const checksReady = Boolean(remote?.pr?.checksReady);
  const merged = remote?.pr?.state === "MERGED";
  const busy = operation !== null;
  const blockedChanges = local?.changes.filter((change) => !change.eligible) ?? [];

  return (
    <details
      className="rounded-md border border-[#b99f8d] bg-[#fdfaf3]"
      open={defaultOpen}
    >
      <summary className="cursor-pointer list-none px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-[#4d473d]">Revisao e publicacao</h2>
            <p className="mt-1 text-xs text-[#70695e]">
              {local
                ? `${local.changes.length} mudanca(s) · branch ${local.branch || "sem branch"}`
                : "Carregando estado local..."}
            </p>
          </div>
          <span className="rounded-full border border-[#cfc6b5] bg-white px-3 py-1 text-xs font-semibold text-[#5f5a50]">
            {merged
              ? "deploy iniciado"
              : checksReady
                ? "pr aprovado"
                : submitted
                  ? "em revisao"
                  : prepared
                    ? "versao preparada"
                    : verified
                      ? "verificada"
                      : "mudancas locais"}
          </span>
        </div>
      </summary>

      <div className="border-t border-[#d8d0c1] p-4">
        <div className="grid gap-2 sm:grid-cols-4">
          {[
            ["1", "Verificar", verified, !verified],
            ["2", "Preparar versao", prepared, verified && !prepared],
            ["3", "Enviar para revisao", submitted, prepared && !submitted],
            ["4", "Publicar", merged, checksReady && !merged],
          ].map(([number, label, complete, active]) => (
            <div
              className={`rounded-md border p-3 text-xs ${stepClass(Boolean(active), Boolean(complete))}`}
              key={String(number)}
            >
              <span className="font-mono">{number}</span>
              <p className="mt-1 font-semibold">{label}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Mudancas do lote</h3>
              <button
                className="rounded-md border border-[#b99f8d] bg-white px-3 py-2 text-xs font-semibold text-[#4b3024] disabled:opacity-50"
                disabled={busy}
                onClick={() => void loadStatus(false)}
                type="button"
              >
                Atualizar local
              </button>
            </div>
            {categories.length > 0 ? (
              <div className="mt-3 max-h-72 space-y-3 overflow-auto rounded-md border border-[#d8d0c1] bg-white p-3">
                {categories.map(([category, changes]) => (
                  <section key={category}>
                    <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8a4c2f]">
                      {category} · {changes.length}
                    </h4>
                    <ul className="mt-2 space-y-1">
                      {changes.map((change) => (
                        <li className="flex gap-2 text-xs" key={change.path}>
                          <span className="w-6 shrink-0 font-mono text-[#8a4c2f]">
                            {change.code.trim() || "M"}
                          </span>
                          <span className="min-w-0 break-all font-mono text-[#5f5a50]">
                            {change.path}
                            {change.blockReason ? ` — ${change.blockReason}` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-md border border-[#d8d0c1] bg-white p-3 text-sm text-[#70695e]">
                Nenhuma mudanca local pendente.
              </p>
            )}
            {local?.verification ? (
              <details className="mt-3 rounded-md border border-[#d8d0c1] bg-white p-3 text-xs">
                <summary className="cursor-pointer font-semibold">
                  Resultado da ultima verificacao
                </summary>
                <p className="mt-2 text-[#70695e]">
                  {local.verification.current
                    ? "Valida para o conjunto atual"
                    : "Desatualizada porque os arquivos mudaram"}
                </p>
                {local.verification.summary ? (
                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-[#f7f5ef] p-2 font-mono text-[11px]">
                    {local.verification.summary}
                  </pre>
                ) : null}
              </details>
            ) : null}
          </div>

          <div className="space-y-3">
            <label className="flex flex-col gap-2 text-sm font-medium text-[#4d473d]">
              Responsavel pela publicacao
              <input
                className="h-10 rounded-md border border-[#cfc6b5] bg-white px-3"
                onChange={(event) => setResponsible(event.target.value)}
                placeholder="Nome editorial explicito"
                value={responsible}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-[#4d473d]">
              Titulo da versao
              <input
                className="h-10 rounded-md border border-[#cfc6b5] bg-white px-3"
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Ex.: Concluir captura pelo MuseScore"
                value={message}
              />
            </label>
            <button
              className="w-full rounded-md border border-[#8a4c2f] bg-[#8a4c2f] px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={busy || local?.clean || blockedChanges.length > 0}
              onClick={() => void runAction("verify")}
              type="button"
            >
              {operation === "verify" ? "Verificando..." : "Verificar mudancas"}
            </button>
            <button
              className="w-full rounded-md border border-[#8a4c2f] bg-white px-3 py-2 text-sm font-semibold text-[#8a4c2f] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={
                busy ||
                !verified ||
                prepared ||
                !responsible.trim() ||
                !message.trim() ||
                blockedChanges.length > 0
              }
              onClick={() => void runAction("prepare")}
              type="button"
            >
              {operation === "prepare" ? "Preparando..." : "Preparar versao"}
            </button>
            <button
              className="w-full rounded-md border border-[#8a4c2f] bg-white px-3 py-2 text-sm font-semibold text-[#8a4c2f] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={busy || !prepared || submitted}
              onClick={() => void runAction("submit")}
              type="button"
            >
              {operation === "submit" ? "Enviando..." : "Enviar para revisao"}
            </button>
            <button
              className="w-full rounded-md border border-[#b99f8d] bg-white px-3 py-2 text-sm font-semibold text-[#4b3024] disabled:opacity-50"
              disabled={busy || !prepared}
              onClick={() => void loadStatus(true)}
              type="button"
            >
              {operation === "refresh" ? "Atualizando..." : "Atualizar GitHub"}
            </button>
            <button
              className="w-full rounded-md border border-[#3f5d35] bg-[#3f5d35] px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={busy || !checksReady || merged || !responsible.trim()}
              onClick={() => void runAction("merge")}
              type="button"
            >
              {operation === "merge" ? "Publicando..." : "Aprovar e publicar"}
            </button>

            {local?.release ? (
              <div className="rounded-md border border-[#d8d0c1] bg-white p-3 text-xs text-[#5f5a50]">
                <p className="font-semibold text-[#1f1e1b]">Versao preparada</p>
                <p className="mt-1 font-mono">{local.release.branch}</p>
                <p className="mt-1 font-mono">{shortHash(local.release.commit)}</p>
              </div>
            ) : null}
            {remote?.pr ? (
              <a
                className="block rounded-md border border-[#d8d0c1] bg-white p-3 text-xs text-[#8a4c2f] underline"
                href={remote.pr.url}
                rel="noreferrer"
                target="_blank"
              >
                PR #{remote.pr.number}: {remote.pr.title}
              </a>
            ) : null}
            {remote?.deployment ? (
              <a
                className="block rounded-md border border-[#d8d0c1] bg-white p-3 text-xs text-[#8a4c2f] underline"
                href={remote.deployment.url}
                rel="noreferrer"
                target="_blank"
              >
                Deploy: {remote.deployment.status}
                {remote.deployment.conclusion
                  ? ` · ${remote.deployment.conclusion}`
                  : ""}
              </a>
            ) : null}
            {notice ? (
              <p className="rounded-md border border-[#d3a36f] bg-[#fff8e9] p-3 text-xs leading-relaxed text-[#70431f]">
                {notice}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </details>
  );
}
