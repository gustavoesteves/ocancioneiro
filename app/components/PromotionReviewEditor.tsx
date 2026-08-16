"use client";

import { useEffect, useMemo, useState } from "react";
import type { PromotionReviewResponse } from "../import-types";

type SaveState = "idle" | "saving" | "saved" | "error";

const actionLabels: Record<string, string> = {
  distribuir_musicxml: "distribuir o MusicXML",
  exibir_metadados: "exibir metadados",
  exibir_partitura: "exibir a partitura",
  imprimir: "imprimir",
  reproduzir_playback: "reproduzir playback",
};

export function PromotionReviewEditor({
  initialEditionId,
  workId,
}: {
  initialEditionId?: string;
  workId: string;
}) {
  const [data, setData] = useState<PromotionReviewResponse | null>(null);
  const [selectedEditionId, setSelectedEditionId] = useState(initialEditionId ?? "");
  const [state, setState] = useState<SaveState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [editionReviewed, setEditionReviewed] = useState(false);
  const [editionReviewedBy, setEditionReviewedBy] = useState("");
  const [notationKind, setNotationKind] = useState<
    "lead_sheet" | "partitura_instrumental_original"
  >("lead_sheet");
  const [notationInstrument, setNotationInstrument] = useState<"piano" | "violao">("piano");
  const [notationJustification, setNotationJustification] = useState("");
  const [curationAccepted, setCurationAccepted] = useState(false);
  const [curationDecidedBy, setCurationDecidedBy] = useState("");
  const [curationReviewedBy, setCurationReviewedBy] = useState("");
  const [curationJustification, setCurationJustification] = useState("");
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [rightsConfirmedBy, setRightsConfirmedBy] = useState("");
  const [rightsBasis, setRightsBasis] = useState("");

  async function loadReview(editionId = selectedEditionId) {
    setState("idle");
    setMessage(null);
    try {
      const query = editionId ? `?edition=${encodeURIComponent(editionId)}` : "";
      const response = await fetch(
        `/api/import/dossiers/${encodeURIComponent(workId)}/review${query}`,
      );
      const result = (await response.json()) as PromotionReviewResponse;
      if (!response.ok) throw new Error(result.error || "Nao consegui carregar a revisao.");
      setData(result);
      setSelectedEditionId(result.preferredEditionId ?? "");
      const preferredEdition = result.editions?.find(
        (edition) => edition.id === result.preferredEditionId,
      );
      setNotationKind(preferredEdition?.notationProfile.kind ?? "lead_sheet");
      setNotationInstrument(preferredEdition?.notationProfile.instrument ?? "piano");
      setNotationJustification(preferredEdition?.notationProfile.justification ?? "");
      setRightsBasis(result.rights?.basis ?? "");
      setRightsConfirmedBy(result.rights?.confirmedBy ?? "");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Falha ao carregar a revisao.");
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadReview(initialEditionId), 0);
    return () => window.clearTimeout(timer);
    // A carga inicial deve acontecer uma vez por obra.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEditionId, workId]);

  const selectedEdition = useMemo(
    () => data?.editions?.find((edition) => edition.id === selectedEditionId) ?? null,
    [data?.editions, selectedEditionId],
  );

  const formComplete = Boolean(
    data?.gates?.researchComplete !== false &&
      editionReviewed &&
      editionReviewedBy.trim() &&
      (notationKind === "lead_sheet" ||
        (notationInstrument && notationJustification.trim())) &&
      curationAccepted &&
      curationDecidedBy.trim() &&
      curationReviewedBy.trim() &&
      curationJustification.trim() &&
      rightsConfirmed &&
      rightsConfirmedBy.trim() &&
      rightsBasis.trim(),
  );

  async function saveReview() {
    if (!data?.fingerprint || !selectedEditionId || !formComplete) return;
    setState("saving");
    setMessage(null);
    try {
      const response = await fetch(
        `/api/import/dossiers/${encodeURIComponent(workId)}/review`,
        {
          body: JSON.stringify({
            curationAccepted,
            curationDecidedBy,
            curationJustification,
            curationReviewedBy,
            editionId: selectedEditionId,
            editionReviewed,
            editionReviewedBy,
            expectedFingerprint: data.fingerprint,
            notationInstrument:
              notationKind === "partitura_instrumental_original"
                ? notationInstrument
                : undefined,
            notationJustification:
              notationKind === "partitura_instrumental_original"
                ? notationJustification
                : undefined,
            notationKind,
            rightsBasis,
            rightsConfirmed,
            rightsConfirmedBy,
          }),
          headers: { "Content-Type": "application/json" },
          method: "PUT",
        },
      );
      const result = (await response.json()) as PromotionReviewResponse;
      if (!response.ok) throw new Error(result.error || "Nao consegui concluir a revisao.");
      setData(result);
      setState("saved");
      setMessage(
        result.gates?.ready
          ? "Revisao concluida. Os gates editoriais desta edicao estao liberados para promocao."
          : "A revisao foi gravada, mas ainda existem gates pendentes.",
      );
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Falha ao salvar a revisao.");
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 md:px-8">
      <a className="text-sm font-semibold text-[#8a4c2f] underline" href={`/import/obras/${encodeURIComponent(workId)}`}>
        Voltar ao dossie
      </a>
      <p className="mt-6 text-sm font-semibold uppercase tracking-[0.16em] text-[#8a4c2f]">
        Gates editoriais
      </p>
      <h1 className="mt-2 text-4xl font-semibold">Revisar para promocao</h1>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#70695e]">
        Esta etapa valida a edicao, registra uma decisao curatorial revisada e
        documenta a verificacao dos direitos. Ela nao publica o MusicXML; a promocao
        continua sendo uma acao separada na tela de captura.
      </p>

      {message ? (
        <p className={`mt-5 rounded-md border p-4 text-sm ${state === "error" ? "border-[#c78f8f] bg-[#fff8f6] text-[#8a2f2f]" : "border-[#8da27f] bg-[#edf5e9] text-[#3f5d35]"}`}>
          {message}
        </p>
      ) : null}

      {data?.work ? (
        <div className="mt-6 rounded-md border border-[#d8d0c1] bg-[#fffdf8] p-5">
          <p className="font-mono text-xs text-[#8a4c2f]">{data.work.id}</p>
          <h2 className="mt-1 text-2xl font-semibold">{data.work.title}</h2>
          <label className="mt-4 flex max-w-xl flex-col gap-2 text-sm font-semibold">
            Edicao vinculada a captura
            <select
              className="h-11 rounded-md border border-[#cfc6b5] bg-white px-3 font-normal"
              disabled={state === "saving"}
              onChange={(event) => {
                const editionId = event.target.value;
                setSelectedEditionId(editionId);
                void loadReview(editionId);
              }}
              value={selectedEditionId}
            >
              {(data.editions ?? []).map((edition) => (
                <option key={edition.id} value={edition.id}>
                  {edition.title} — {edition.status}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {data?.gates?.ready ? (
        <section className="mt-5 rounded-md border border-[#8da27f] bg-[#edf5e9] p-5 text-[#3f5d35]">
          <h2 className="text-lg font-semibold">Pronta para promocao</h2>
          <p className="mt-2 text-sm">
            Edicao valida, curadoria aceita e permissoes de entrega confirmadas.
          </p>
          <p className="mt-2 text-sm">
            Feche esta aba e retorne a captura que ficou aberta. Depois selecione
            <strong> Atualizar gates</strong>.
          </p>
          <button
            className="mt-4 rounded-md bg-[#3f5d35] px-4 py-2 text-sm font-semibold text-white"
            onClick={() => window.close()}
            type="button"
          >
            Fechar revisao
          </button>
        </section>
      ) : data ? (
        <div className="mt-5 space-y-5">
          <section className="rounded-md border border-[#d8d0c1] bg-white p-5">
            <h2 className="text-lg font-semibold">1. Validacao musical da edicao</h2>
            <p className="mt-2 text-sm text-[#70695e]">
              Estado atual: <strong>{selectedEdition?.status ?? "desconhecido"}</strong>.
              Confirme a revisao da melodia e dos acordes capturados.
            </p>
            <label className="mt-4 flex items-start gap-3 text-sm">
              <input checked={editionReviewed} className="mt-1" onChange={(event) => setEditionReviewed(event.target.checked)} type="checkbox" />
              Revisei a integridade musical desta edicao e a considero valida.
            </label>
            <label className="mt-4 flex flex-col gap-2 text-sm font-semibold">
              Responsavel pela validacao musical
              <input className="h-11 rounded-md border border-[#cfc6b5] px-3 font-normal" onChange={(event) => setEditionReviewedBy(event.target.value)} value={editionReviewedBy} />
            </label>
            <label className="mt-4 flex flex-col gap-2 text-sm font-semibold">
              Perfil da partitura
              <select
                className="h-11 rounded-md border border-[#cfc6b5] bg-white px-3 font-normal"
                onChange={(event) =>
                  setNotationKind(
                    event.target.value as
                      | "lead_sheet"
                      | "partitura_instrumental_original",
                  )
                }
                value={notationKind}
              >
                <option value="lead_sheet">Lead sheet — melodia e cifras</option>
                <option value="partitura_instrumental_original">
                  Partitura instrumental original — excecao
                </option>
              </select>
            </label>
            {notationKind === "partitura_instrumental_original" ? (
              <div className="mt-4 rounded-md border border-[#d3a36f] bg-[#fff8e9] p-4">
                <p className="text-sm text-[#70431f]">
                  Use somente quando a obra foi originalmente concebida para
                  piano ou violao e a escrita instrumental integra sua identidade.
                  A opcao nao autoriza arranjos ou transcricoes posteriores.
                </p>
                <label className="mt-4 flex flex-col gap-2 text-sm font-semibold">
                  Instrumento original
                  <select
                    className="h-11 rounded-md border border-[#cfc6b5] bg-white px-3 font-normal"
                    onChange={(event) =>
                      setNotationInstrument(event.target.value as "piano" | "violao")
                    }
                    value={notationInstrument}
                  >
                    <option value="piano">Piano</option>
                    <option value="violao">Violao</option>
                  </select>
                </label>
                <label className="mt-4 flex flex-col gap-2 text-sm font-semibold">
                  Justificativa editorial da excecao
                  <textarea
                    className="min-h-24 rounded-md border border-[#cfc6b5] bg-white p-3 font-normal"
                    onChange={(event) => setNotationJustification(event.target.value)}
                    required
                    value={notationJustification}
                  />
                </label>
              </div>
            ) : null}
          </section>

          <section className="rounded-md border border-[#d8d0c1] bg-white p-5">
            <h2 className="text-lg font-semibold">2. Decisao curatorial</h2>
            <p className="mt-2 text-sm text-[#70695e]">
              A decisao e a revisao independente ficam registradas e seladas no historico do dossie.
            </p>
            {data.gates?.researchComplete === false ? (
              <div className="mt-4 rounded-md border border-[#c78f8f] bg-[#fff8f6] p-4 text-sm text-[#8a2f2f]">
                <p className="font-semibold">Pesquisa minima ainda incompleta</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {data.gates.researchPending.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <a className="mt-3 inline-block font-semibold underline" href={`/import/obras/${encodeURIComponent(workId)}/pesquisa`}>
                  Registrar pesquisa editorial
                </a>
              </div>
            ) : null}
            <label className="mt-4 flex items-start gap-3 text-sm">
              <input checked={curationAccepted} className="mt-1" disabled={data.gates?.researchComplete === false} onChange={(event) => setCurationAccepted(event.target.checked)} type="checkbox" />
              Aceito esta obra no recorte editorial do Cancioneiro.
            </label>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-semibold">
                Responsavel pela decisao
                <input className="h-11 rounded-md border border-[#cfc6b5] px-3 font-normal" onChange={(event) => setCurationDecidedBy(event.target.value)} value={curationDecidedBy} />
              </label>
              <label className="flex flex-col gap-2 text-sm font-semibold">
                Revisor independente
                <input className="h-11 rounded-md border border-[#cfc6b5] px-3 font-normal" onChange={(event) => setCurationReviewedBy(event.target.value)} value={curationReviewedBy} />
                <span className="font-normal text-[#70695e]">Deve ser uma pessoa diferente de quem tomou a decisao.</span>
              </label>
            </div>
            <label className="mt-4 flex flex-col gap-2 text-sm font-semibold">
              Justificativa curatorial
              <textarea className="min-h-28 rounded-md border border-[#cfc6b5] p-3 font-normal" onChange={(event) => setCurationJustification(event.target.value)} required value={curationJustification} />
            </label>
          </section>

          <section className="rounded-md border border-[#d8d0c1] bg-white p-5">
            <h2 className="text-lg font-semibold">3. Verificacao de direitos</h2>
            <p className="mt-2 text-sm text-[#70695e]">
              Permissoes ainda bloqueadas: {(data.gates?.blockedRights ?? []).map((action) => actionLabels[action] ?? action).join(", ") || "nenhuma"}.
            </p>
            <div className="mt-3 rounded border border-[#d3a36f] bg-[#fff8e9] p-3 text-xs leading-relaxed text-[#70431f]">
              Marque apenas depois de verificar a base juridica ou editorial. O sistema nao presume dominio publico nem autorizacao.
            </div>
            <label className="mt-4 flex items-start gap-3 text-sm">
              <input checked={rightsConfirmed} className="mt-1" onChange={(event) => setRightsConfirmed(event.target.checked)} type="checkbox" />
              Confirmo que as acoes listadas acima podem ser oferecidas publicamente.
            </label>
            <label className="mt-4 flex flex-col gap-2 text-sm font-semibold">
              Responsavel pela verificacao de direitos
              <input className="h-11 rounded-md border border-[#cfc6b5] px-3 font-normal" onChange={(event) => setRightsConfirmedBy(event.target.value)} value={rightsConfirmedBy} />
            </label>
            <label className="mt-4 flex flex-col gap-2 text-sm font-semibold">
              Base da verificacao
              <textarea className="min-h-28 rounded-md border border-[#cfc6b5] p-3 font-normal" onChange={(event) => setRightsBasis(event.target.value)} placeholder="Ex.: dominio publico verificado, autorizacao documentada ou licenca aplicavel." required value={rightsBasis} />
            </label>
          </section>

          <button
            className="w-full rounded-md bg-[#70431f] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!formComplete || state === "saving"}
            onClick={() => void saveReview()}
            type="button"
          >
            {state === "saving" ? "Registrando revisao..." : "Concluir gates editoriais"}
          </button>
        </div>
      ) : null}
    </main>
  );
}
