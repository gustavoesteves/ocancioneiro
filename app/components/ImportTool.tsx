"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import type {
  ImportLibraryResponse,
  ManagedDossier,
  ManagedSong,
} from "../import-types";
import {
  assertMusicXmlDocument,
  defaultEditorialFields,
  metadataFromMusicXml,
  musicXmlWithDisplayMetadata,
  slugify,
} from "../../lib/musicxml-metadata.mjs";
import { importIdentityDifferences } from "../../lib/import-identity.mjs";
import { importCaptureReadiness } from "../import-capture-readiness";
import { suggestImportDestination } from "../import-destination-suggestion";
import {
  MuseScoreBridgeError,
  MuseScoreCaptureClient,
  type MuseScoreBridgeStatus,
  type MuseScoreCaptureResult,
} from "../musescore-capture-client";
import { ImportLibraryPanel } from "./ImportLibraryPanel";

type ImportMetadata = ReturnType<typeof metadataFromMusicXml>;
type SaveState = "idle" | "saving" | "saved" | "error";
type CaptureState = "idle" | "capturing" | "ready" | "error";

type PrivateCaptureReceipt = {
  canonicalSha256: string;
  captureId: string;
  created: boolean;
  editionId: string;
  provenance: "manual_file" | "musescore_export";
  rawSha256: string;
  state: "em_revisao";
  workId: string;
};

type PromotionReceipt = {
  asset: {
    checksum: string;
    id: string;
    path: string;
  };
  captureId: string;
  historical: boolean;
  idempotent: boolean;
  promoted: boolean;
  promotedBy: string | null;
  transactionId: string | null;
};

type PreImportModel = {
  capture: MuseScoreCaptureResult | null;
  displayXml: string;
  fileName: string;
  metadata: ImportMetadata;
  partCount: number;
  rawXml: string;
  source: "manual_file" | "musescore_export";
  warnings: string[];
};

function splitTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
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

function preImportFromMusicXml({
  capture = null,
  fileName,
  source,
  xml,
}: {
  capture?: MuseScoreCaptureResult | null;
  fileName: string;
  source: PreImportModel["source"];
  xml: string;
}): PreImportModel {
  assertMusicXmlDocument(fileName, xml);
  const partCount = [...xml.matchAll(/<score-part\b/gi)].length;
  const warnings: string[] = [];
  if (partCount > 1) warnings.push(`${partCount} partes detectadas; revisar se ha arranjo.`);
  if (/<lyric\b/i.test(xml)) warnings.push("Letra detectada no MusicXML.");
  if (/<staff-layout\b|<staff-details\b/gi.test(xml)) {
    warnings.push("Configuracao de multiplas pautas detectada.");
  }

  return {
    capture,
    displayXml: musicXmlWithDisplayMetadata(xml, fileName),
    fileName,
    metadata: metadataFromMusicXml(xml, fileName),
    partCount,
    rawXml: xml,
    source,
    warnings,
  };
}

export function ImportTool() {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);
  const bridgeClientRef = useRef<MuseScoreCaptureClient | null>(null);
  const [preImport, setPreImport] = useState<PreImportModel | null>(null);
  const [editorial, setEditorial] = useState<EditorialFields>(initialEditorial);
  const [message, setMessage] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [suggestedId, setSuggestedId] = useState("");
  const [managedSongs, setManagedSongs] = useState<ManagedSong[]>([]);
  const [managedDossiers, setManagedDossiers] = useState<ManagedDossier[]>([]);
  const [selectedDossierWorkId, setSelectedDossierWorkId] = useState<string | null>(
    null,
  );
  const [selectedEditionId, setSelectedEditionId] = useState<string | null>(null);
  const [creatingNewWork, setCreatingNewWork] = useState(false);
  const [destinationTouched, setDestinationTouched] = useState(false);
  const [libraryState, setLibraryState] = useState<SaveState>("idle");
  const [deleteState, setDeleteState] = useState<SaveState>("idle");
  const [bridgeStatus, setBridgeStatus] = useState<MuseScoreBridgeStatus | null>(
    null,
  );
  const [bridgeAvailable, setBridgeAvailable] = useState(false);
  const [captureState, setCaptureState] = useState<CaptureState>("idle");
  const [identityConfirmed, setIdentityConfirmed] = useState(false);
  const [privateCapture, setPrivateCapture] =
    useState<PrivateCaptureReceipt | null>(null);
  const [confirmedBy, setConfirmedBy] = useState("");
  const [promotedBy, setPromotedBy] = useState("");
  const [promotionReceipt, setPromotionReceipt] =
    useState<PromotionReceipt | null>(null);
  const [promotionState, setPromotionState] = useState<SaveState>("idle");

  if (bridgeClientRef.current == null) {
    bridgeClientRef.current = new MuseScoreCaptureClient();
  }

  const fileName = preImport?.fileName ?? "";
  const scoreXml = preImport?.displayXml ?? "";
  const metadata = preImport?.metadata ?? null;

  const effectiveId = suggestedId.trim() || metadata?.id || "nova-peca";
  const suggestedPath = "area privada local — fora de public/ e ignorada pelo Git";
  const suggestedPrivateEditionId = `edicao-importada-${effectiveId}`;
  const suggestedNewWorkId = `obra-${effectiveId}`;
  const selectedDossier = useMemo(
    () =>
      managedDossiers.find((dossier) => dossier.workId === selectedDossierWorkId) ??
      null,
    [managedDossiers, selectedDossierWorkId],
  );
  const selectedEdition = useMemo(
    () =>
      selectedDossier?.editions.find(
        (edition) => edition.id === selectedEditionId,
      ) ?? null,
    [selectedDossier, selectedEditionId],
  );
  const promotionReady = Boolean(
    selectedEdition?.status === "valida" &&
      selectedDossier?.status === "aceita" &&
      selectedDossier.blockedPromotionRights.length === 0,
  );
  const identityDifferences = useMemo(() => {
    if (!metadata || !selectedDossier) return [];
    return importIdentityDifferences(metadata, selectedDossier);
  }, [metadata, selectedDossier]);
  const newWorkConflict = useMemo(
    () =>
      managedDossiers.find(
        (dossier) =>
          dossier.workId === suggestedNewWorkId ||
          dossier.publicCatalogId === effectiveId,
      ) ?? null,
    [effectiveId, managedDossiers, suggestedNewWorkId],
  );
  const canCreateNewWork = creatingNewWork && newWorkConflict === null;
  const destinationWorkId = canCreateNewWork
    ? suggestedNewWorkId
    : selectedDossierWorkId;
  const destinationEditionId = canCreateNewWork
    ? suggestedPrivateEditionId
    : selectedEditionId;
  const captureReadiness = importCaptureReadiness({
    dossierSelected: destinationWorkId !== null,
    editionSelected: destinationEditionId !== null,
    hasIdentityDifferences: identityDifferences.length > 0,
    identityConfirmed,
    privateCaptureConfirmed: privateCapture !== null,
    responsibleProvided: confirmedBy.trim().length > 0,
    saving: saveState === "saving",
  });

  const refreshLibrary = useCallback(async () => {
    setLibraryState("saving");

    try {
      const response = await fetch("/api/import");
      const result = (await response.json()) as ImportLibraryResponse;

      if (!response.ok) {
        throw new Error(result.error || "Nao consegui carregar o acervo.");
      }

      setManagedSongs(result.songs || []);
      setManagedDossiers(result.dossiers || []);
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
  }, []);

  function resetForm() {
    bridgeClientRef.current?.cancel();
    setPreImport(null);
    setEditorial(initialEditorial);
    setMessage(null);
    setSaveState("idle");
    setSuggestedId("");
    setSelectedDossierWorkId(null);
    setSelectedEditionId(null);
    setCreatingNewWork(false);
    setDestinationTouched(false);
    setCaptureState("idle");
    setIdentityConfirmed(false);
    setPrivateCapture(null);
    setConfirmedBy("");
    setPromotedBy("");
    setPromotionReceipt(null);
    setPromotionState("idle");
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;

    setMessage(null);

    try {
      const xml = await file.text();
      const nextPreImport = preImportFromMusicXml({
        fileName: file.name,
        source: "manual_file",
        xml,
      });
      setPreImport(nextPreImport);
      const nextMetadata = nextPreImport.metadata;
      setSuggestedId(nextMetadata.id);
      setEditorial(initialEditorial);
      setSelectedDossierWorkId(null);
      setSelectedEditionId(null);
      setCreatingNewWork(false);
      setDestinationTouched(false);
      setSaveState("idle");
      setCaptureState("idle");
      setIdentityConfirmed(false);
      setPrivateCapture(null);
      setPromotionReceipt(null);
      setPromotionState("idle");
    } catch (error) {
      console.error(error);
      setPreImport(null);
      setMessage("Nao consegui ler este arquivo como MusicXML completo.");
    }
  }

  async function captureFromMuseScore() {
    setMessage(null);
    setCaptureState("capturing");

    try {
      const capture = await bridgeClientRef.current!.capture();
      const nextPreImport = preImportFromMusicXml({
        capture,
        fileName: `musescore-${capture.captureId}.musicxml`,
        source: "musescore_export",
        xml: capture.xml,
      });
      setPreImport(nextPreImport);
      setSuggestedId(nextPreImport.metadata.id);
      setEditorial(initialEditorial);
      setSelectedDossierWorkId(null);
      setSelectedEditionId(null);
      setCreatingNewWork(false);
      setDestinationTouched(false);
      setSaveState("idle");
      setCaptureState("ready");
      setIdentityConfirmed(false);
      setPrivateCapture(null);
      setPromotionReceipt(null);
      setPromotionState("idle");
      setMessage(
        "Captura recebida da partitura ativa. Revise identidade, escopo e destino antes de confirmar.",
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setCaptureState("idle");
        return;
      }
      console.error(error);
      setCaptureState("error");
      setMessage(
        error instanceof MuseScoreBridgeError
          ? `${error.message} (${error.code})`
          : "Nao consegui capturar a partitura do MuseScore.",
      );
    }
  }

  function selectManagedDossier(dossier: ManagedDossier) {
    setDestinationTouched(true);
    setCreatingNewWork(false);
    setSelectedDossierWorkId((current) =>
      current === dossier.workId ? null : dossier.workId,
    );
    setSelectedEditionId(null);
    setIdentityConfirmed(false);
  }

  function selectNewWork() {
    if (newWorkConflict) return;
    setDestinationTouched(true);
    setCreatingNewWork((current) => !current);
    setSelectedDossierWorkId(null);
    setSelectedEditionId(null);
    setIdentityConfirmed(false);
  }

  async function saveImport() {
    if (!metadata || !preImport) return;

    if (!destinationWorkId || !destinationEditionId) {
      setSaveState("error");
      setMessage("Escolha explicitamente o dossie e a edicao antes de confirmar.");
      return;
    }
    if (identityDifferences.length > 0 && !identityConfirmed) {
      setSaveState("error");
      setMessage("Confirme as divergencias de identidade antes de continuar.");
      return;
    }

    setMessage(null);
    setSaveState("saving");

    try {
      const response = await fetch("/api/import", {
        body: JSON.stringify({
          editorial: {
            genre: editorial.genre,
            level: editorial.level,
            notes: editorial.notes,
            source: editorial.source,
            tags: splitTags(editorial.tags),
          },
          captureId: preImport.capture?.captureId,
          capturedAt: preImport.capture?.capturedAt,
          captureRequestId: preImport.capture?.requestId,
          confirmedBy: confirmedBy.trim(),
          createDossier: canCreateNewWork,
          musescoreVersion: preImport.capture?.musescoreVersion,
          pluginVersion: preImport.capture?.pluginVersion,
          dossierWorkId: destinationWorkId,
          editionId: destinationEditionId,
          id: effectiveId,
          identityConfirmed,
          provenance: preImport.source,
          protocol: preImport.capture?.protocol ?? bridgeStatus?.protocol,
          rawSha256: preImport.capture?.sha256,
          xml: preImport.rawXml,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as {
        capture?: PrivateCaptureReceipt;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error || "Nao consegui salvar a importacao.");
      }

      if (!result.capture) {
        throw new Error("A API nao retornou o comprovante da captura privada.");
      }

      setPrivateCapture(result.capture);
      setPromotionReceipt(null);
      setPromotionState("idle");
      if (canCreateNewWork) {
        setCreatingNewWork(false);
        setSelectedDossierWorkId(result.capture.workId);
        setSelectedEditionId(result.capture.editionId);
      }
      setSaveState("saved");
      setMessage(
        result.capture.created
          ? `Captura privada confirmada para ${result.capture.workId} / ${result.capture.editionId}. Nenhum asset foi publicado.`
          : `Esta captura privada ja estava confirmada para ${result.capture.workId} / ${result.capture.editionId}.`,
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

  async function discardPrivateImport() {
    if (!privateCapture) return;
    if (
      !window.confirm(
        "Mover esta captura privada para o descarte recuperavel? Nenhum arquivo publico sera alterado.",
      )
    ) {
      return;
    }

    setDeleteState("saving");
    setMessage(null);
    try {
      const response = await fetch("/api/import", {
        body: JSON.stringify({ captureId: privateCapture.captureId }),
        headers: { "Content-Type": "application/json" },
        method: "DELETE",
      });
      const result = (await response.json()) as {
        error?: string;
        recoverable?: boolean;
      };
      if (!response.ok) {
        throw new Error(result.error || "Nao consegui descartar a captura privada.");
      }
      setPrivateCapture(null);
      setPromotionReceipt(null);
      setPromotionState("idle");
      setSaveState("idle");
      setDeleteState("saved");
      setMessage(
        result.recoverable
          ? "Captura movida para o descarte recuperavel. Nenhum asset publico foi alterado."
          : "Captura descartada.",
      );
    } catch (error) {
      console.error(error);
      setDeleteState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Nao consegui descartar a captura privada.",
      );
    }
  }

  async function promoteConfirmedCapture() {
    if (!privateCapture) return;
    if (!promotedBy.trim()) {
      setPromotionState("error");
      setMessage("Informe quem esta promovendo esta versao.");
      return;
    }

    setPromotionState("saving");
    setMessage(null);
    try {
      const response = await fetch("/api/import/promote", {
        body: JSON.stringify({
          captureId: privateCapture.captureId,
          promotedBy: promotedBy.trim(),
          publicId: effectiveId,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as PromotionReceipt & { error?: string };
      if (!response.ok) {
        throw new Error(result.error || "Nao consegui promover a captura.");
      }
      setPromotionReceipt(result);
      setPromotionState("saved");
      setMessage(
        result.promoted
          ? `Versao promovida para ${result.asset.path}. A versao anterior foi preservada.`
          : result.historical
            ? "Esta captura ja faz parte do historico e nao criou outra versao."
            : "Esta captura ja era a versao publica vigente.",
      );
      await refreshLibrary();
    } catch (error) {
      console.error(error);
      setPromotionState("error");
      setMessage(
        error instanceof Error ? error.message : "Nao consegui promover a captura.",
      );
    }
  }

  async function rollbackPromotedCapture() {
    if (!promotionReceipt?.transactionId || !promotedBy.trim()) return;
    if (
      !window.confirm(
        "Restaurar o catalogo, o dossie e o asset vigentes antes desta promocao?",
      )
    ) {
      return;
    }

    setPromotionState("saving");
    setMessage(null);
    try {
      const response = await fetch("/api/import/promote", {
        body: JSON.stringify({
          rolledBackBy: promotedBy.trim(),
          transactionId: promotionReceipt.transactionId,
        }),
        headers: { "Content-Type": "application/json" },
        method: "DELETE",
      });
      const result = (await response.json()) as {
        error?: string;
        rolledBack?: boolean;
      };
      if (!response.ok || !result.rolledBack) {
        throw new Error(result.error || "Nao consegui reverter a promocao.");
      }
      setPromotionReceipt(null);
      setPromotionState("idle");
      setMessage("Promocao revertida; catalogo, dossie e asset anteriores restaurados.");
      await refreshLibrary();
    } catch (error) {
      console.error(error);
      setPromotionState("error");
      setMessage(
        error instanceof Error ? error.message : "Nao consegui reverter a promocao.",
      );
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshLibrary(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshLibrary]);

  useEffect(() => {
    if (!preImport || destinationTouched || privateCapture) return;
    const timer = window.setTimeout(() => {
      const suggestion = suggestImportDestination(
        preImport.metadata.id,
        managedDossiers,
      );
      setIdentityConfirmed(false);
      if (suggestion.mode === "new") {
        setCreatingNewWork(true);
        setSelectedDossierWorkId(null);
        setSelectedEditionId(null);
        return;
      }
      setCreatingNewWork(false);
      setSelectedDossierWorkId(suggestion.workId);
      setSelectedEditionId(suggestion.editionId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [destinationTouched, managedDossiers, preImport, privateCapture]);

  useEffect(() => {
    if (!privateCapture || promotionReceipt?.promoted) return;

    let timer: number | null = null;
    function scheduleRefresh() {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => void refreshLibrary(), 50);
    }
    function refreshWhenVisible() {
      if (document.visibilityState === "visible") scheduleRefresh();
    }

    window.addEventListener("focus", scheduleRefresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    scheduleRefresh();
    return () => {
      window.removeEventListener("focus", scheduleRefresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [privateCapture, promotionReceipt?.promoted, refreshLibrary]);

  useEffect(() => {
    let disposed = false;

    async function refreshBridgeStatus() {
      try {
        const status = await bridgeClientRef.current!.status();
        if (!disposed) {
          setBridgeStatus(status);
          setBridgeAvailable(true);
        }
      } catch {
        if (!disposed) {
          setBridgeStatus(null);
          setBridgeAvailable(false);
        }
      }
    }

    void refreshBridgeStatus();
    const timer = window.setInterval(() => void refreshBridgeStatus(), 1_000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      bridgeClientRef.current?.cancel();
    };
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
              Capturar MusicXML
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#70695e]">
              Receba a partitura ativa do MuseScore ou selecione um arquivo e
              confirme seu destino editorial antes de qualquer promocao publica.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-[#b99f8d] bg-[#fdfaf3] p-6 text-center transition hover:bg-[#f3efe5]">
              <span className="text-base font-medium text-[#4d473d]">
                Selecionar arquivo MusicXML
              </span>
              <span className="mt-1 text-sm text-[#70695e]">
                {fileName || ".musicxml ou .xml — fallback sempre disponivel"}
              </span>
              <input
                accept=".musicxml,.xml,application/xml,text/xml"
                className="sr-only"
                onChange={(event) => void handleFile(event.target.files?.[0])}
                type="file"
              />
            </label>

            <div className="flex min-h-36 flex-col justify-between rounded-md border border-[#b99f8d] bg-[#fdfaf3] p-5">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-[#4d473d]">
                    Capturar do MuseScore
                  </h2>
                  <span
                    className={`rounded-full border px-2 py-1 text-xs font-medium ${
                      bridgeAvailable
                        ? "border-[#8da27f] bg-[#edf5e9] text-[#3f5d35]"
                        : "border-[#c9b8aa] bg-white text-[#70695e]"
                    }`}
                  >
                    {bridgeAvailable ? "ponte online" : "ponte ausente"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[#70695e]">
                  Plugin: {bridgeStatus?.plugin ?? "ausente"} · Captura:{" "}
                  {captureState === "capturing"
                    ? "aguardando MusicXML"
                    : bridgeStatus?.capture ?? captureState}
                </p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className="rounded-md border border-[#8a4c2f] bg-[#8a4c2f] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#713b23] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={
                    captureState === "capturing" ||
                    !bridgeAvailable ||
                    bridgeStatus?.plugin !== "paired"
                  }
                  onClick={() => void captureFromMuseScore()}
                  type="button"
                >
                  {captureState === "capturing" ? "Capturando..." : "Capturar partitura ativa"}
                </button>
                {captureState === "capturing" ? (
                  <button
                    className="rounded-md border border-[#b99f8d] bg-white px-3 py-2 text-sm font-medium text-[#4b3024]"
                    onClick={() => {
                      bridgeClientRef.current?.cancel();
                      setCaptureState("idle");
                    }}
                    type="button"
                  >
                    Cancelar
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {preImport ? (
          <div className="rounded-md border border-[#d8d0c1] bg-[#fdfaf3] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Acervo local</h2>
                <p className="mt-1 text-sm text-[#70695e]">
                  {libraryState === "saving"
                    ? "Carregando destinos..."
                    : `${managedDossiers.length} dossie(s) disponiveis · destino sugerido automaticamente`}
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

            <div className="mt-4 rounded-md border border-[#8da27f] bg-[#edf5e9] p-4 text-sm text-[#3f5d35]">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h3 className="font-semibold">
                    {canCreateNewWork
                      ? "Nova obra preparada automaticamente"
                      : selectedDossier
                        ? "Obra existente encontrada"
                        : "Destino editorial"}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed">
                    A sugestao usa o identificador do MusicXML. Revise ou altere o
                    destino antes de confirmar; nada e criado nesta etapa.
                  </p>
                </div>
                <button
                  aria-pressed={canCreateNewWork}
                  className="shrink-0 rounded-md border border-[#3f5d35] bg-white px-3 py-2 text-sm font-semibold text-[#3f5d35] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={privateCapture !== null || newWorkConflict !== null}
                  onClick={selectNewWork}
                  type="button"
                >
                  {newWorkConflict
                    ? "Obra ja existe no acervo"
                    : canCreateNewWork
                      ? "Nova obra selecionada"
                      : "Criar nova obra"}
                </button>
              </div>
              {newWorkConflict ? (
                <p className="mt-2 text-xs font-medium">
                  O identificador corresponde a {newWorkConflict.title}. Escolha
                  esse dossie na lista abaixo.
                </p>
              ) : null}
            </div>

            <ImportLibraryPanel
              destinationMode
              dossiers={managedDossiers}
              locked={privateCapture !== null}
              onSelectDossier={selectManagedDossier}
              selectedSongId={null}
              selectedWorkId={canCreateNewWork ? null : selectedDossierWorkId}
              songs={managedSongs}
            />

            {canCreateNewWork ? (
              <div className="mt-4 rounded-md border border-[#8da27f] bg-white p-4 text-sm text-[#3f5d35]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="font-semibold">{preImport.metadata.title}</h4>
                    <p className="mt-1">{preImport.metadata.composer}</p>
                    <p className="mt-2 font-mono text-[11px]">
                      {suggestedNewWorkId} / {suggestedPrivateEditionId}
                    </p>
                  </div>
                  <span className="rounded border border-[#8da27f] bg-[#edf5e9] px-2 py-1 text-xs font-medium">
                    candidata · edicao em_revisao
                  </span>
                </div>
                <p className="mt-3 text-xs leading-relaxed">
                  O dossie e a captura privada serao criados juntos ao confirmar.
                  Nenhum arquivo sera escrito em public/musicxml.
                </p>
              </div>
            ) : null}

            {selectedDossier ? (
                  <div className="mt-4 rounded-md border border-[#d8d0c1] bg-[#fffdf8] p-4 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="font-semibold">{selectedDossier.title}</h4>
                        <p className="mt-1 font-mono text-[11px] text-[#8a4c2f]">
                          {selectedDossier.workId}
                        </p>
                      </div>
                      <span className="rounded border border-[#d8d0c1] bg-[#fdfaf3] px-2 py-1 text-xs text-[#5f5a50]">
                        {selectedDossier.status}
                      </span>
                    </div>

                    <label className="mt-4 flex flex-col gap-2 text-sm font-medium text-[#4d473d]">
                      Edicao editorial obrigatoria
                      <select
                        className="h-10 rounded-md border border-[#cfc6b5] bg-white px-3"
                        disabled={privateCapture !== null}
                        onChange={(event) => {
                          setSelectedEditionId(event.target.value || null);
                          setIdentityConfirmed(false);
                        }}
                        value={selectedEditionId ?? ""}
                      >
                        <option value="">Selecione uma edicao</option>
                        {selectedDossier.editions.map((edition) => (
                          <option key={edition.id} value={edition.id}>
                            {edition.title} — {edition.status}
                          </option>
                        ))}
                        {!selectedDossier.editions.some(
                          (edition) => edition.id === suggestedPrivateEditionId,
                        ) ? (
                          <option value={suggestedPrivateEditionId}>
                            Criar {suggestedPrivateEditionId} — em_revisao
                          </option>
                        ) : null}
                      </select>
                    </label>

                    {identityDifferences.length > 0 ? (
                      <div className="mt-4 rounded-md border border-[#d3a36f] bg-[#fff8e9] p-3 text-sm text-[#70431f]">
                        <p className="font-semibold">Divergencias de identidade</p>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                          {identityDifferences.map((difference) => (
                            <li key={difference}>{difference}</li>
                          ))}
                        </ul>
                        <label className="mt-3 flex items-start gap-2 font-medium">
                          <input
                            checked={identityConfirmed}
                            className="mt-1 accent-[#8a4c2f]"
                            onChange={(event) => setIdentityConfirmed(event.target.checked)}
                            type="checkbox"
                          />
                          Confirmo que revisei a identidade desta captura para a
                          obra e edicao selecionadas.
                        </label>
                      </div>
                    ) : null}

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div>
                        <h5 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8a4c2f]">
                          Fontes
                        </h5>
                        {selectedDossier.sources.length > 0 ? (
                          <ul className="mt-2 space-y-2">
                            {selectedDossier.sources.map((source) => (
                              <li className="text-[#5f5a50]" key={source.id}>
                                <span className="block font-medium text-[#1f1e1b]">
                                  {source.title}
                                </span>
                                <span className="text-xs">
                                  {source.type}
                                  {source.reference ? ` - ${source.reference}` : ""}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-2 text-xs text-[#70695e]">
                            Nenhuma fonte estruturada registrada.
                          </p>
                        )}
                      </div>

                      <div>
                        <h5 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8a4c2f]">
                          Decisao vigente
                        </h5>
                        {selectedDossier.currentDecision ? (
                          <div className="mt-2 text-[#5f5a50]">
                            <p className="font-medium text-[#1f1e1b]">
                              {selectedDossier.currentDecision.status}
                            </p>
                            <p className="mt-1 text-xs">
                              {selectedDossier.currentDecision.decidedAt} -{" "}
                              {selectedDossier.currentDecision.decidedBy}
                            </p>
                            <p className="mt-2 text-xs leading-relaxed">
                              {selectedDossier.currentDecision.justification}
                            </p>
                          </div>
                        ) : (
                          <p className="mt-2 text-xs text-[#70695e]">
                            Nenhuma decisao vigente registrada.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
            ) : null}
          </div>
          ) : null}

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
                  ["Partes", String(preImport?.partCount ?? 0)],
                  ["Cifras", metadata.chords.join(" / ") || "Nao informado"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="font-medium text-[#70695e]">{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              {preImport?.capture ? (
                <div className="mt-4 border-t border-[#d8d0c1] pt-3 text-xs text-[#5f5a50]">
                  <p>
                    Origem: <strong>captura do MuseScore</strong>
                  </p>
                  <p className="mt-1 break-all font-mono">
                    SHA-256: {preImport.capture.sha256}
                  </p>
                  <p className="mt-1 font-mono">
                    {preImport.capture.byteLength} bytes · {preImport.capture.captureId}
                  </p>
                </div>
              ) : null}
              {preImport && preImport.warnings.length > 0 ? (
                <div className="mt-4 rounded-md border border-[#d3a36f] bg-[#fff8e9] p-3 text-sm text-[#70431f]">
                  <p className="font-semibold">Revisar escopo de lead sheet</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {preImport.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
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
              <h2 className="text-lg font-semibold">Destino privado</h2>
              {destinationWorkId ? (
                <p className="mt-2 rounded border border-[#d8d0c1] bg-[#fdfaf3] p-3 font-mono text-xs">
                  {destinationWorkId}
                  {destinationEditionId
                    ? ` / ${destinationEditionId}`
                    : " / edicao pendente"}
                </p>
              ) : null}
              <p className="mt-3 rounded border border-[#d8d0c1] bg-[#fdfaf3] p-3 font-mono text-xs">
                {suggestedPath}
              </p>
              <div className="mt-4 rounded-md border border-[#8da27f] bg-[#edf5e9] p-3 text-sm text-[#3f5d35]">
                <p>
                  A confirmacao cria somente uma captura privada em revisao. A
                  publicacao sera uma operacao separada.
                </p>
                <label className="mt-3 flex flex-col gap-2 font-medium">
                  Responsavel pela confirmacao
                  <input
                    className="h-10 rounded-md border border-[#8da27f] bg-white px-3 text-[#1f1e1b]"
                    disabled={privateCapture !== null}
                    onChange={(event) => setConfirmedBy(event.target.value)}
                    placeholder="Nome editorial explicito"
                    value={confirmedBy}
                  />
                </label>
              </div>
              {privateCapture ? (
                <div className="mt-4 rounded-md border border-[#8da27f] bg-[#edf5e9] p-3 text-xs text-[#3f5d35]">
                  <p className="font-semibold">Captura privada confirmada</p>
                  <p className="mt-1 font-mono">{privateCapture.captureId}</p>
                  <p className="mt-1 break-all font-mono">
                    bruto: {privateCapture.rawSha256}
                  </p>
                  <p className="mt-1 break-all font-mono">
                    canonico: {privateCapture.canonicalSha256}
                  </p>
                </div>
              ) : null}
              {privateCapture ? (
                <div className="mt-4 rounded-md border border-[#d3a36f] bg-[#fff8e9] p-3 text-sm text-[#70431f]">
                  <p className="font-semibold">Promocao publica separada</p>
                  <p className="mt-1 text-xs leading-relaxed">
                    Exige curadoria aceita, edicao valida e todas as permissoes
                    de entrega. Falhar em qualquer gate preserva a versao atual.
                  </p>
                  <ul className="mt-3 space-y-1 rounded border border-[#d3a36f] bg-white p-3 text-xs">
                    <li>
                      {selectedEdition?.status === "valida" ? "✓" : "○"} Edicao valida
                    </li>
                    <li>
                      {selectedDossier?.status === "aceita" ? "✓" : "○"} Curadoria aceita
                    </li>
                    <li>
                      {selectedDossier?.blockedPromotionRights.length === 0 ? "✓" : "○"} Direitos de entrega permitidos
                    </li>
                  </ul>
                  {!promotionReady && selectedDossier && selectedEdition ? (
                    <div className="mt-3 rounded border border-[#d3a36f] bg-white p-3 text-xs">
                      <p className="font-medium">
                        Conclua os gates editoriais antes de assinar a promocao.
                      </p>
                      <p className="mt-1 leading-relaxed">
                        Ao fechar a revisao, esta tela atualiza os gates automaticamente.
                        Use a acao manual abaixo somente se a sincronizacao demorar.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-3">
                        <a
                          className="font-semibold text-[#70431f] underline"
                          href={`/import/obras/${encodeURIComponent(selectedDossier.workId)}/revisar?edition=${encodeURIComponent(selectedEdition.id)}`}
                          rel="noreferrer"
                          target="_blank"
                        >
                          Abrir revisao editorial
                        </a>
                        <button
                          className="font-semibold text-[#70431f] underline disabled:opacity-50"
                          disabled={libraryState === "saving"}
                          onClick={() => void refreshLibrary()}
                          type="button"
                        >
                          {libraryState === "saving" ? "Atualizando..." : "Atualizar gates"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                  <label className="mt-3 flex flex-col gap-2 font-medium">
                    Responsavel pela promocao
                    <input
                      className="h-10 rounded-md border border-[#c7a77f] bg-white px-3"
                      disabled={promotionReceipt?.promoted === true}
                      onChange={(event) => setPromotedBy(event.target.value)}
                      placeholder="Nome editorial explicito"
                      value={promotedBy}
                    />
                  </label>
                  <button
                    className="mt-3 w-full rounded-md border border-[#70431f] bg-[#70431f] px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={
                      promotionState === "saving" ||
                      !promotedBy.trim() ||
                      !promotionReady ||
                      promotionReceipt?.promoted === true
                    }
                    onClick={() => void promoteConfirmedCapture()}
                    type="button"
                  >
                    {promotionState === "saving"
                      ? "Processando promocao..."
                      : promotionReceipt?.promoted
                        ? "Versao promovida"
                        : "Promover versao validada"}
                  </button>
                  {promotionReceipt ? (
                    <div className="mt-3 break-all rounded border border-[#d3a36f] bg-white p-2 font-mono text-[11px]">
                      <p>{promotionReceipt.asset.id}</p>
                      <p className="mt-1">{promotionReceipt.asset.path}</p>
                      <p className="mt-1">{promotionReceipt.asset.checksum}</p>
                    </div>
                  ) : null}
                  {promotionReceipt?.transactionId ? (
                    <button
                      className="mt-3 w-full rounded-md border border-[#a04a3c] bg-white px-3 py-2 text-sm font-semibold text-[#8a2f2f] disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={promotionState === "saving"}
                      onClick={() => void rollbackPromotedCapture()}
                      type="button"
                    >
                      Reverter esta promocao
                    </button>
                  ) : null}
                </div>
              ) : null}
              <button
                className="mt-4 w-full rounded-md border border-[#8a4c2f] bg-[#8a4c2f] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#713b23] disabled:cursor-not-allowed disabled:opacity-60"
                aria-describedby={
                  captureReadiness.guidance ? "capture-readiness-guidance" : undefined
                }
                disabled={captureReadiness.disabled}
                onClick={() => void saveImport()}
                type="button"
              >
                {captureReadiness.label}
              </button>
              {captureReadiness.guidance ? (
                <p
                  className="mt-2 text-sm font-medium text-[#70431f]"
                  id="capture-readiness-guidance"
                  role="status"
                >
                  Proximo passo: {captureReadiness.guidance}
                </p>
              ) : null}
              {privateCapture ? (
                <button
                  className="mt-3 w-full rounded-md border border-[#a04a3c] bg-white px-3 py-2 text-sm font-semibold text-[#8a2f2f] transition hover:bg-[#fff8f6] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={deleteState === "saving"}
                  onClick={() => void discardPrivateImport()}
                  type="button"
                >
                  {deleteState === "saving"
                    ? "Movendo..."
                    : "Descartar captura de forma recuperavel"}
                </button>
              ) : null}
            </div>
          </aside>

          <article className="min-w-0 rounded-md border border-[#d8d0c1] bg-[#fffdf8]">
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
            Selecione um MusicXML ou capture a partitura ativa no MuseScore. O
            acervo aparecera em seguida apenas para escolher o destino editorial.
          </div>
        </section>
      )}
    </main>
  );
}
