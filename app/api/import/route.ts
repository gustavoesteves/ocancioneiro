import { promises as fs } from "node:fs";
import path from "node:path";
import { parseCatalog } from "../../../lib/catalog.mjs";
import { summarizeEditorialDossiers } from "../../../lib/editorial-dossier-summary.mjs";
import {
  dossierConflictMessage,
  findDossierImportConflict,
} from "../../../lib/import-dossier-conflicts.mjs";
import { loadEditorialDossiers } from "../../../scripts/validate-dossiers.mjs";
import {
  assertMusicXmlDocument,
  defaultEditorialFields,
  metadataFromMusicXml,
  slugify,
} from "../../../lib/musicxml-metadata.mjs";
import {
  discardPrivateCapture,
  PrivateCaptureError,
} from "../../../lib/private-capture-store.mjs";
import { confirmPrivateImport } from "../../../lib/private-import-confirmation.mjs";
import { importIdentityDifferences } from "../../../lib/import-identity.mjs";
import { resolveLocalProjectRoot } from "../../../lib/local-project-root.mjs";
import {
  buildCandidateEditorialDossier,
  reserveCandidateEditorialDossier,
} from "../../../lib/new-editorial-dossier.mjs";

type ImportPayload = {
  captureId?: string;
  capturedAt?: string;
  captureRequestId?: string;
  confirmedBy?: string;
  createDossier?: boolean;
  musescoreVersion?: string;
  pluginVersion?: string;
  editorial?: {
    genre?: string;
    level?: string;
    notes?: string;
    source?: string;
    tags?: string[];
  };
  dossierWorkId?: string;
  editionId?: string;
  id?: string;
  identityConfirmed?: boolean;
  provenance?: "manual_file" | "musescore_export";
  protocol?: string;
  rawSha256?: string;
  xml?: string;
};

const localHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

function isLocalRequest(request: Request) {
  const url = new URL(request.url);
  return localHosts.has(url.hostname);
}

function textField(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function tagsField(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
    .filter(Boolean);
}

async function projectPaths() {
  const projectRoot = await resolveLocalProjectRoot();

  return {
    catalogPath: path.join(projectRoot, "public", "catalog.json"),
    dossierDirectory: path.join(projectRoot, "data", "dossiers"),
    editorialPath: path.join(projectRoot, "data", "editorial.json"),
    projectRoot,
  };
}

async function readEditorialManifest(editorialPath: string) {
  try {
    return JSON.parse(await fs.readFile(editorialPath, "utf8")) as {
      songs?: Record<string, unknown>;
    };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return { songs: {} };
    }
    throw error;
  }
}

async function readCatalog(catalogPath: string) {
  return parseCatalog(JSON.parse(await fs.readFile(catalogPath, "utf8")), {
    allowLegacy: true,
  });
}

function editorialEntry(payload: ImportPayload) {
  return {
    genre: textField(payload.editorial?.genre, defaultEditorialFields.genre),
    level: textField(payload.editorial?.level, defaultEditorialFields.level),
    notes:
      typeof payload.editorial?.notes === "string"
        ? payload.editorial.notes
        : defaultEditorialFields.notes,
    source: textField(payload.editorial?.source, defaultEditorialFields.source),
    tags: tagsField(payload.editorial?.tags),
  };
}

function requireLocalRequest(request: Request) {
  if (isLocalRequest(request)) return null;

  return Response.json(
    { error: "Importacao disponivel apenas em ambiente local." },
    { status: 403 },
  );
}

function privateCaptureErrorResponse(error: unknown) {
  if (!(error instanceof PrivateCaptureError)) return null;
  const status =
    error.code === "CAPTURE_NOT_FOUND"
      ? 404
      : ["CAPTURE_ID_CONFLICT", "RAW_HASH_MISMATCH"].includes(error.code)
        ? 409
        : 400;
  return Response.json({ code: error.code, error: error.message }, { status });
}

export async function GET(request: Request) {
  const localError = requireLocalRequest(request);
  if (localError) return localError;

  try {
    const { catalogPath, dossierDirectory, editorialPath } = await projectPaths();
    const [catalog, manifest, dossierEntries] = await Promise.all([
      readCatalog(catalogPath),
      readEditorialManifest(editorialPath),
      loadEditorialDossiers(dossierDirectory),
    ]);

    return Response.json({
      dossiers: summarizeEditorialDossiers(dossierEntries),
      songs: catalog.songs
        .filter((song) => typeof song.musicxml === "string")
        .map((song) => ({
          ...song,
          editorial: manifest.songs?.[song.id] ?? {
            genre: song.genre,
            level: song.level,
            notes: song.notes,
            source: song.source,
            tags: song.tags,
          },
          path: `public${song.musicxml}`,
        })),
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro inesperado" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const localError = requireLocalRequest(request);
  if (localError) return localError;

  let provisionalDossierPath: string | null = null;
  try {
    const payload = (await request.json()) as ImportPayload;
    const { dossierDirectory, projectRoot } = await projectPaths();
    const xml = typeof payload.xml === "string" ? payload.xml : "";

    if (!xml.trim()) {
      return Response.json({ error: "xml e obrigatorio" }, { status: 400 });
    }

    assertMusicXmlDocument("import.musicxml", xml);
    const metadata = metadataFromMusicXml(xml, "import.musicxml");
    const id = slugify(payload.id || metadata.id);

    if (!id) {
      return Response.json({ error: "id invalido" }, { status: 400 });
    }

    const dossierEntries = await loadEditorialDossiers(dossierDirectory);
    const dossierWorkId =
      typeof payload.dossierWorkId === "string" ? payload.dossierWorkId.trim() : "";
    let dossierEntry = dossierWorkId
      ? dossierEntries.find((entry) => entry.dossier.work.id === dossierWorkId)
      : null;
    const createDossier = payload.createDossier === true;
    const expectedNewWorkId = `obra-${id}`;

    if (createDossier) {
      if (dossierWorkId && dossierWorkId !== expectedNewWorkId) {
        return Response.json(
          { error: "O identificador da nova obra nao corresponde ao MusicXML." },
          { status: 400 },
        );
      }
      const existingConflict = findDossierImportConflict(dossierEntries, id);
      if (existingConflict) {
        return Response.json(
          {
            code: "DOSSIER_ALREADY_EXISTS",
            error: `Ja existe o dossie ${existingConflict.workId}. Escolha essa obra como destino em vez de criar outra.`,
          },
          { status: 409 },
        );
      }
      const reserved = await reserveCandidateEditorialDossier({
        dossier: buildCandidateEditorialDossier({
          composer: metadata.composer,
          title: metadata.title,
          workId: expectedNewWorkId,
        }),
        dossierDirectory,
      });
      dossierEntry = reserved;
      provisionalDossierPath = reserved.filePath;
    }

    if (!createDossier && dossierWorkId && !dossierEntry) {
      return Response.json({ error: "Dossie editorial nao encontrado." }, { status: 404 });
    }
    if (!dossierEntry) {
      return Response.json(
        {
          error:
            "Selecione um dossie editorial existente. Novas importacoes sem governanca nao podem ser gravadas em public/.",
        },
        { status: 409 },
      );
    }
    const editionId =
      typeof payload.editionId === "string" ? payload.editionId.trim() : "";
    if (!editionId) {
      return Response.json(
        { error: "Selecione explicitamente uma edicao editorial." },
        { status: 400 },
      );
    }
    const identityDifferences = createDossier
      ? []
      : importIdentityDifferences(metadata, dossierEntry.dossier);
    if (identityDifferences.length > 0 && payload.identityConfirmed !== true) {
      return Response.json(
        {
          differences: identityDifferences,
          error: "Confirme explicitamente as divergencias de identidade.",
        },
        { status: 409 },
      );
    }
    const dossierConflict = createDossier
      ? null
      : findDossierImportConflict(dossierEntries, id);
    if (
      dossierConflict &&
      (!dossierEntry || dossierConflict.workId !== dossierEntry.dossier.work.id)
    ) {
      return Response.json(
        { error: dossierConflictMessage(dossierConflict) },
        { status: 409 },
      );
    }

    const provenance =
      payload.provenance === "musescore_export" ? "musescore_export" : "manual_file";
    const confirmed = await confirmPrivateImport({
      capture: {
        captureId: payload.captureId,
        capturedAt: payload.capturedAt,
        confirmedBy: payload.confirmedBy,
        expectedRawSha256: payload.rawSha256 ?? null,
        musescoreVersion: payload.musescoreVersion,
        pluginVersion: payload.pluginVersion,
        protocol: payload.protocol,
        provenance,
        requestId: payload.captureRequestId ?? null,
      },
      dossierEntry,
      editionId,
      editorial: editorialEntry(payload),
      metadata: {
        ...metadata,
        partCount: [...xml.matchAll(/<score-part\b/gi)].length,
      },
      projectRoot,
      xml,
    });
    const dossierCreated = provisionalDossierPath !== null;
    provisionalDossierPath = null;

    return Response.json(
      {
        capture: {
          canonicalSha256: confirmed.record.canonicalSha256,
          captureId: confirmed.record.captureId,
          created: confirmed.captureCreated,
          editionId: confirmed.record.editionId,
          provenance: confirmed.record.provenance.technicalOrigin,
          rawSha256: confirmed.record.rawSha256,
          state: confirmed.record.state,
          workId: confirmed.record.workId,
        },
        editionCreated: confirmed.editionCreated,
        dossierCreated,
        id,
        title: metadata.title,
      },
      { status: confirmed.captureCreated ? 201 : 200 },
    );
  } catch (error) {
    if (provisionalDossierPath) {
      await fs.rm(provisionalDossierPath, { force: true }).catch(() => {});
    }
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      return Response.json(
        {
          code: "DOSSIER_ALREADY_EXISTS",
          error: "Outro processo criou este dossie. Atualize o acervo e escolha a obra existente.",
        },
        { status: 409 },
      );
    }
    const privateError = privateCaptureErrorResponse(error);
    if (privateError) return privateError;
    console.error(error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro inesperado" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const localError = requireLocalRequest(request);
  if (localError) return localError;

  return Response.json(
    {
      code: "LEGACY_IMPORT_UPDATE_RETIRED",
      editor: "/import/obras/{workId}/editar",
      error:
        "A atualizacao direta de assets publicos foi aposentada. Edite metadados pelo dossie; para substituir a partitura, use captura, revisao e promocao.",
    },
    { status: 410 },
  );
}

export async function DELETE(request: Request) {
  const localError = requireLocalRequest(request);
  if (localError) return localError;

  try {
    const body =
      request.headers.get("content-type")?.includes("application/json")
        ? ((await request.json()) as { captureId?: string })
        : {};
    if (typeof body.captureId === "string" && body.captureId.trim()) {
      const { projectRoot } = await projectPaths();
      const discarded = await discardPrivateCapture({
        captureId: body.captureId.trim(),
        projectRoot,
      });
      return Response.json({
        captureId: discarded.captureId,
        recoverable: true,
        trashId: discarded.trashId,
      });
    }

    return Response.json(
      {
        code: "LEGACY_IMPORT_DELETE_RETIRED",
        error:
          "A exclusao direta de assets publicos foi aposentada. Use este endpoint somente para o descarte recuperavel de uma captura privada.",
      },
      { status: 410 },
    );
  } catch (error) {
    const privateError = privateCaptureErrorResponse(error);
    if (privateError) return privateError;
    console.error(error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro inesperado" },
      { status: 500 },
    );
  }
}
