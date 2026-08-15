"use client";

import { useEffect, useState } from "react";

type ResearchResponse = {
  canonicalClaims?: {
    centrality: string;
    context: string;
    evidenceIds: string[];
    justification: string;
    reach: string;
  }[];
  code?: string;
  error?: string;
  evidence?: {
    claim: string;
    criterion: string;
    direction: string;
    id: string;
    strength: string;
  }[];
  fingerprint?: string;
  sources?: {
    id: string;
    reference?: string;
    title: string;
    type: string;
    url?: string;
  }[];
  updated?: boolean;
  vocabularies?: {
    canonicalReach: string[];
    centrality: string[];
    evidenceCriteria: string[];
    evidenceDirections: string[];
    evidenceStrengths: string[];
    sourceTypes: string[];
  };
  work?: { id: string; title: string };
};

const today = () => new Date().toISOString().slice(0, 10);

const initialSource = () => ({
  accessedAt: today(),
  persistentId: "",
  reference: "",
  responsible: "",
  title: "",
  type: "catalogo_ou_acervo",
  url: "",
});

const initialEvidence = {
  assessedBy: "",
  claim: "",
  criterion: "permanencia",
  direction: "sustenta",
  justification: "",
  locator: "",
  strength: "moderada",
  strengthJustification: "",
};

const initialCanonicalClaim = {
  centrality: "contextual",
  context: "",
  justification: "",
  reach: "nacional",
};

function label(value: string) {
  return value.replaceAll("_", " ");
}

export function EditorialResearchEditor({ workId }: { workId: string }) {
  const [data, setData] = useState<ResearchResponse | null>(null);
  const [source, setSource] = useState(initialSource);
  const [existingSourceId, setExistingSourceId] = useState("");
  const [evidence, setEvidence] = useState(initialEvidence);
  const [canonicalClaim, setCanonicalClaim] = useState(initialCanonicalClaim);
  const [state, setState] = useState<"loading" | "idle" | "saving" | "error">(
    "loading",
  );
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setState("loading");
    setMessage(null);
    try {
      const response = await fetch(
        `/api/import/dossiers/${encodeURIComponent(workId)}/research`,
      );
      const result = (await response.json()) as ResearchResponse;
      if (!response.ok) throw new Error(result.error || "Nao consegui carregar a pesquisa.");
      setData(result);
      setState("idle");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Falha ao carregar a pesquisa.");
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
    // A obra identifica de forma estavel a ficha carregada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workId]);

  const complete = Boolean(
    data?.fingerprint &&
      (existingSourceId || (source.title.trim() && source.accessedAt)) &&
      evidence.assessedBy.trim() &&
      evidence.claim.trim() &&
      evidence.justification.trim() &&
      evidence.strengthJustification.trim() &&
      canonicalClaim.context.trim() &&
      canonicalClaim.justification.trim(),
  );

  async function save() {
    if (!complete || !data?.fingerprint) return;
    setState("saving");
    setMessage(null);
    try {
      const response = await fetch(
        `/api/import/dossiers/${encodeURIComponent(workId)}/research`,
        {
          body: JSON.stringify({
            canonicalClaim,
            evidence,
            existingSourceId: existingSourceId || undefined,
            expectedFingerprint: data.fingerprint,
            source: existingSourceId ? undefined : source,
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      );
      const result = (await response.json()) as ResearchResponse;
      if (!response.ok) throw new Error(result.error || "Nao consegui registrar a pesquisa.");
      setData(result);
      setSource(initialSource());
      setExistingSourceId("");
      setEvidence((current) => ({ ...initialEvidence, assessedBy: current.assessedBy }));
      setCanonicalClaim(initialCanonicalClaim);
      setState("idle");
      setMessage("Fonte, evidencia e afirmacao canonica registradas no dossie.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Falha ao registrar a pesquisa.");
    }
  }

  if (state === "loading" && !data) {
    return <main className="mx-auto max-w-6xl px-5 py-8 text-sm text-[#70695e]">Carregando pesquisa...</main>;
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 md:px-8">
      <a className="text-sm font-semibold text-[#8a4c2f] underline" href={`/import/obras/${encodeURIComponent(workId)}`}>
        Voltar ao dossie
      </a>
      <p className="mt-6 text-sm font-semibold uppercase tracking-[0.16em] text-[#8a4c2f]">
        Pesquisa editorial
      </p>
      <h1 className="mt-2 text-4xl font-semibold">{data?.work?.title ?? workId}</h1>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#70695e]">
        Registre uma fonte reencontravel, a evidencia extraida dela e a afirmacao
        canonica sustentada. O registro e aditivo e nao altera MusicXML, direitos
        ou decisao editorial existente.
      </p>

      {message ? (
        <p className={`mt-5 rounded-md border p-4 text-sm ${state === "error" ? "border-[#c78f8f] bg-[#fff8f6] text-[#8a2f2f]" : "border-[#8da27f] bg-[#edf5e9] text-[#3f5d35]"}`}>
          {message}
        </p>
      ) : null}

      <section className="mt-7 grid gap-5 lg:grid-cols-3">
        <article className="rounded-md border border-[#d8d0c1] bg-white p-5">
          <h2 className="text-lg font-semibold">1. Fonte</h2>
          <div className="mt-4 grid gap-3">
            <label className="grid gap-2 text-sm font-semibold">Fonte existente<select className="h-10 rounded border border-[#cfc6b5] bg-white px-3 font-normal" onChange={(event) => setExistingSourceId(event.target.value)} value={existingSourceId}><option value="">Cadastrar nova fonte</option>{data?.sources?.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
            {existingSourceId ? (
              <p className="rounded border border-[#e1dbcf] bg-[#fffdf8] p-3 text-sm text-[#70695e]">
                A evidencia sera ligada a fonte selecionada, sem criar outro registro.
              </p>
            ) : (
              <>
                <label className="grid gap-2 text-sm font-semibold">Titulo<input className="h-10 rounded border border-[#cfc6b5] px-3 font-normal" onChange={(event) => setSource((current) => ({ ...current, title: event.target.value }))} value={source.title} /></label>
                <label className="grid gap-2 text-sm font-semibold">Tipo<select className="h-10 rounded border border-[#cfc6b5] bg-white px-3 font-normal" onChange={(event) => setSource((current) => ({ ...current, type: event.target.value }))} value={source.type}>{data?.vocabularies?.sourceTypes.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label>
                <label className="grid gap-2 text-sm font-semibold">Responsavel ou instituicao<input className="h-10 rounded border border-[#cfc6b5] px-3 font-normal" onChange={(event) => setSource((current) => ({ ...current, responsible: event.target.value }))} value={source.responsible} /></label>
                <label className="grid gap-2 text-sm font-semibold">Referencia<input className="h-10 rounded border border-[#cfc6b5] px-3 font-normal" onChange={(event) => setSource((current) => ({ ...current, reference: event.target.value }))} value={source.reference} /></label>
                <label className="grid gap-2 text-sm font-semibold">URL<input className="h-10 rounded border border-[#cfc6b5] px-3 font-normal" onChange={(event) => setSource((current) => ({ ...current, url: event.target.value }))} type="url" value={source.url} /></label>
                <label className="grid gap-2 text-sm font-semibold">Identificador persistente<input className="h-10 rounded border border-[#cfc6b5] px-3 font-normal" onChange={(event) => setSource((current) => ({ ...current, persistentId: event.target.value }))} value={source.persistentId} /></label>
                <label className="grid gap-2 text-sm font-semibold">Consultada em<input className="h-10 rounded border border-[#cfc6b5] px-3 font-normal" onChange={(event) => setSource((current) => ({ ...current, accessedAt: event.target.value }))} type="date" value={source.accessedAt} /></label>
              </>
            )}
          </div>
        </article>

        <article className="rounded-md border border-[#d8d0c1] bg-white p-5">
          <h2 className="text-lg font-semibold">2. Evidencia</h2>
          <div className="mt-4 grid gap-3">
            <label className="grid gap-2 text-sm font-semibold">Afirmacao sustentada<textarea className="min-h-20 rounded border border-[#cfc6b5] p-3 font-normal" onChange={(event) => setEvidence((current) => ({ ...current, claim: event.target.value }))} value={evidence.claim} /></label>
            <label className="grid gap-2 text-sm font-semibold">Criterio<select className="h-10 rounded border border-[#cfc6b5] bg-white px-3 font-normal" onChange={(event) => setEvidence((current) => ({ ...current, criterion: event.target.value }))} value={evidence.criterion}>{data?.vocabularies?.evidenceCriteria.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label>
            <label className="grid gap-2 text-sm font-semibold">Direcao<select className="h-10 rounded border border-[#cfc6b5] bg-white px-3 font-normal" onChange={(event) => setEvidence((current) => ({ ...current, direction: event.target.value }))} value={evidence.direction}>{data?.vocabularies?.evidenceDirections.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label>
            <label className="grid gap-2 text-sm font-semibold">Forca<select className="h-10 rounded border border-[#cfc6b5] bg-white px-3 font-normal" onChange={(event) => setEvidence((current) => ({ ...current, strength: event.target.value }))} value={evidence.strength}>{data?.vocabularies?.evidenceStrengths.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label>
            <label className="grid gap-2 text-sm font-semibold">Localizador na fonte<input className="h-10 rounded border border-[#cfc6b5] px-3 font-normal" onChange={(event) => setEvidence((current) => ({ ...current, locator: event.target.value }))} placeholder="Pagina, faixa, verbete ou item" value={evidence.locator} /></label>
            <label className="grid gap-2 text-sm font-semibold">Justificativa<textarea className="min-h-20 rounded border border-[#cfc6b5] p-3 font-normal" onChange={(event) => setEvidence((current) => ({ ...current, justification: event.target.value }))} value={evidence.justification} /></label>
            <label className="grid gap-2 text-sm font-semibold">Por que esta forca?<textarea className="min-h-20 rounded border border-[#cfc6b5] p-3 font-normal" onChange={(event) => setEvidence((current) => ({ ...current, strengthJustification: event.target.value }))} value={evidence.strengthJustification} /></label>
            <label className="grid gap-2 text-sm font-semibold">Avaliada por<input className="h-10 rounded border border-[#cfc6b5] px-3 font-normal" onChange={(event) => setEvidence((current) => ({ ...current, assessedBy: event.target.value }))} value={evidence.assessedBy} /></label>
          </div>
        </article>

        <article className="rounded-md border border-[#d8d0c1] bg-white p-5">
          <h2 className="text-lg font-semibold">3. Afirmacao canonica</h2>
          <div className="mt-4 grid gap-3">
            <label className="grid gap-2 text-sm font-semibold">Contexto<input className="h-10 rounded border border-[#cfc6b5] px-3 font-normal" onChange={(event) => setCanonicalClaim((current) => ({ ...current, context: event.target.value }))} placeholder="Ex.: repertorio brasileiro para piano" value={canonicalClaim.context} /></label>
            <label className="grid gap-2 text-sm font-semibold">Centralidade<select className="h-10 rounded border border-[#cfc6b5] bg-white px-3 font-normal" onChange={(event) => setCanonicalClaim((current) => ({ ...current, centrality: event.target.value }))} value={canonicalClaim.centrality}>{data?.vocabularies?.centrality.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label>
            <label className="grid gap-2 text-sm font-semibold">Alcance<select className="h-10 rounded border border-[#cfc6b5] bg-white px-3 font-normal" onChange={(event) => setCanonicalClaim((current) => ({ ...current, reach: event.target.value }))} value={canonicalClaim.reach}>{data?.vocabularies?.canonicalReach.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label>
            <label className="grid gap-2 text-sm font-semibold">Justificativa<textarea className="min-h-28 rounded border border-[#cfc6b5] p-3 font-normal" onChange={(event) => setCanonicalClaim((current) => ({ ...current, justification: event.target.value }))} value={canonicalClaim.justification} /></label>
          </div>
          <button className="mt-5 w-full rounded-md bg-[#70431f] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={!complete || state === "saving"} onClick={() => void save()} type="button">
            {state === "saving" ? "Registrando..." : "Registrar pesquisa ligada"}
          </button>
        </article>
      </section>

      <section className="mt-7 rounded-md border border-[#d8d0c1] bg-[#fffdf8] p-5">
        <h2 className="text-lg font-semibold">Registros existentes</h2>
        <div className="mt-4 grid gap-5 md:grid-cols-3">
          <div><h3 className="text-sm font-semibold">Fontes ({data?.sources?.length ?? 0})</h3><ul className="mt-2 space-y-2 text-sm">{data?.sources?.map((item) => <li className="rounded border border-[#e1dbcf] bg-white p-3" key={item.id}><strong>{item.title}</strong><p className="mt-1 text-xs text-[#70695e]">{label(item.type)}</p></li>)}</ul></div>
          <div><h3 className="text-sm font-semibold">Evidencias ({data?.evidence?.length ?? 0})</h3><ul className="mt-2 space-y-2 text-sm">{data?.evidence?.map((item) => <li className="rounded border border-[#e1dbcf] bg-white p-3" key={item.id}><strong>{item.claim}</strong><p className="mt-1 text-xs text-[#70695e]">{label(item.criterion)} · {item.strength}</p></li>)}</ul></div>
          <div><h3 className="text-sm font-semibold">Afirmacoes ({data?.canonicalClaims?.length ?? 0})</h3><ul className="mt-2 space-y-2 text-sm">{data?.canonicalClaims?.map((item, index) => <li className="rounded border border-[#e1dbcf] bg-white p-3" key={`${item.context}-${index}`}><strong>{item.context}</strong><p className="mt-1 text-xs text-[#70695e]">{item.centrality} · {item.reach}</p></li>)}</ul></div>
        </div>
      </section>
    </main>
  );
}
