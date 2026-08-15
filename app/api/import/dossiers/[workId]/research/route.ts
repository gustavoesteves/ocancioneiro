import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { editorialVocabulary } from "../../../../../../lib/editorial-dossier.mjs";
import {
  addEditorialResearch,
  EditorialResearchError,
  editorialResearchSnapshot,
} from "../../../../../../lib/editorial-research.mjs";
import { editionFileFingerprint } from "../../../../../../lib/editorial-edition-metadata.mjs";
import { resolveLocalProjectRoot } from "../../../../../../lib/local-project-root.mjs";
import { privateCapturePaths } from "../../../../../../lib/private-capture-store.mjs";
import { loadEditorialDossiers } from "../../../../../../scripts/validate-dossiers.mjs";

const localHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);
const workIdPattern = /^[a-z0-9][a-z0-9_-]{0,127}$/;

function requireLocalRequest(request: Request) {
  const url = new URL(request.url);
  if (!localHosts.has(url.hostname)) {
    return Response.json(
      { error: "Pesquisa editorial disponivel apenas em ambiente local." },
      { status: 403 },
    );
  }
  const origin = request.headers.get("Origin");
  if (origin) {
    try {
      if (!localHosts.has(new URL(origin).hostname)) {
        return Response.json({ error: "Origem nao autorizada." }, { status: 403 });
      }
    } catch {
      return Response.json({ error: "Origem nao autorizada." }, { status: 403 });
    }
  }
  return null;
}

async function dossierEntry(projectRoot: string, workId: string) {
  if (!workIdPattern.test(workId)) {
    throw new EditorialResearchError("INVALID_RESEARCH", "workId invalido.");
  }
  const entry = (
    await loadEditorialDossiers(path.join(projectRoot, "data", "dossiers"))
  ).find((candidate) => candidate.dossier.work.id === workId);
  if (!entry) {
    throw new EditorialResearchError("DOSSIER_NOT_FOUND", "Dossie nao encontrado.");
  }
  const stat = await fs.lstat(entry.filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new EditorialResearchError("UNSAFE_DOSSIER", "Arquivo de dossie inseguro.");
  }
  return entry;
}

type ResearchDossier = Record<string, unknown> & {
  work: { id: string; preferredTitle: string };
};

function responseBody(dossier: ResearchDossier, contents: string, updated = false) {
  return {
    ...editorialResearchSnapshot(dossier),
    fingerprint: editionFileFingerprint(contents),
    updated,
    vocabularies: {
      canonicalReach: editorialVocabulary.canonicalReach,
      centrality: editorialVocabulary.centrality,
      evidenceCriteria: editorialVocabulary.evidenceCriteria,
      evidenceDirections: editorialVocabulary.evidenceDirections,
      evidenceStrengths: editorialVocabulary.evidenceStrengths,
      sourceTypes: editorialVocabulary.sourceTypes,
    },
    work: {
      id: dossier.work.id,
      title: dossier.work.preferredTitle,
    },
  };
}

async function acquireResearchLock(projectRoot: string) {
  const probe = await privateCapturePaths(projectRoot, "capture_research_lock_0001");
  const lockRoot = path.join(probe.root, "locks");
  const lockPath = path.join(lockRoot, "promotion-catalog.lock");
  await fs.mkdir(lockRoot, { recursive: true, mode: 0o700 });
  try {
    await fs.mkdir(lockPath, { mode: 0o700 });
    await fs.writeFile(
      path.join(lockPath, "owner.json"),
      `${JSON.stringify({
        operation: "editorial_research",
        pid: process.pid,
        startedAt: new Date().toISOString(),
      })}\n`,
      { encoding: "utf8", flag: "wx", mode: 0o600 },
    );
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      throw new EditorialResearchError(
        "EDITORIAL_WRITE_CONFLICT",
        "Outra alteracao editorial esta em andamento.",
      );
    }
    await fs.rm(lockPath, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
  return async () => fs.rm(lockPath, { recursive: true, force: true });
}

async function writeTextAtomically(filePath: string, value: string) {
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporaryPath, value, { encoding: "utf8", flag: "wx" });
    await fs.rename(temporaryPath, filePath);
  } finally {
    await fs.rm(temporaryPath, { force: true });
  }
}

function errorResponse(error: unknown) {
  if (error instanceof EditorialResearchError) {
    const status = error.code === "DOSSIER_NOT_FOUND"
      ? 404
      : error.code === "DOSSIER_CHANGED" ||
          error.code === "EDITORIAL_WRITE_CONFLICT"
        ? 409
        : 400;
    return Response.json({ code: error.code, error: error.message }, { status });
  }
  console.error(error);
  return Response.json(
    { error: "Falha inesperada ao registrar a pesquisa editorial." },
    { status: 500 },
  );
}

type RouteContext = { params: Promise<{ workId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const localError = requireLocalRequest(request);
  if (localError) return localError;
  try {
    const projectRoot = await resolveLocalProjectRoot();
    const { workId } = await context.params;
    const entry = await dossierEntry(projectRoot, workId);
    const contents = await fs.readFile(entry.filePath, "utf8");
    return Response.json(responseBody(entry.dossier, contents));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const localError = requireLocalRequest(request);
  if (localError) return localError;
  let releaseLock: (() => Promise<void>) | null = null;
  try {
    const projectRoot = await resolveLocalProjectRoot();
    const { workId } = await context.params;
    const body = (await request.json()) as {
      canonicalClaim?: Record<string, unknown>;
      evidence?: Record<string, unknown>;
      existingSourceId?: string;
      expectedFingerprint?: string;
      source?: Record<string, unknown>;
    };
    if (!/^[a-f0-9]{64}$/.test(body.expectedFingerprint ?? "")) {
      throw new EditorialResearchError("INVALID_RESEARCH", "Fingerprint invalido.");
    }

    releaseLock = await acquireResearchLock(projectRoot);
    const entry = await dossierEntry(projectRoot, workId);
    const original = await fs.readFile(entry.filePath, "utf8");
    if (editionFileFingerprint(original) !== body.expectedFingerprint) {
      throw new EditorialResearchError(
        "DOSSIER_CHANGED",
        "O dossie mudou desde que a pesquisa foi aberta. Atualize antes de salvar.",
      );
    }
    const updated = addEditorialResearch(JSON.parse(original), {
      assessedAt: new Date().toISOString(),
      canonicalClaim: body.canonicalClaim ?? {},
      evidence: body.evidence ?? {},
      evidenceId: `evidencia-${randomUUID()}`,
      existingSourceId: body.existingSourceId,
      source: body.source ?? {},
      sourceId: `fonte-${randomUUID()}`,
    });
    const contents = `${JSON.stringify(updated.dossier, null, 2)}\n`;
    await writeTextAtomically(entry.filePath, contents);
    return Response.json(responseBody(updated.dossier, contents, true));
  } catch (error) {
    return errorResponse(error);
  } finally {
    if (releaseLock) await releaseLock();
  }
}
