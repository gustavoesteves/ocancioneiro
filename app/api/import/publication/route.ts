import {
  getLocalPublicationStatus,
  getRemotePublicationStatus,
  LocalPublicationError,
  mergeLocalPublication,
  prepareLocalPublication,
  submitLocalPublication,
  verifyLocalPublication,
} from "../../../../lib/local-publication-workflow.mjs";
import { resolveLocalProjectRoot } from "../../../../lib/local-project-root.mjs";

const localHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

function requireLocalRequest(request: Request) {
  const url = new URL(request.url);
  if (!localHosts.has(url.hostname)) {
    return Response.json(
      { error: "Publicacao assistida disponivel apenas em ambiente local." },
      { status: 403 },
    );
  }
  const origin = request.headers.get("Origin");
  let originIsLocal = true;
  if (origin) {
    try {
      originIsLocal = localHosts.has(new URL(origin).hostname);
    } catch {
      originIsLocal = false;
    }
  }
  if (!originIsLocal) {
    return Response.json(
      { error: "Origem nao autorizada para publicacao local." },
      { status: 403 },
    );
  }
  return null;
}

function errorResponse(error: unknown) {
  if (error instanceof LocalPublicationError) {
    const status =
      error.code === "INVALID_PUBLICATION"
        ? 400
        : error.code === "PUBLICATION_COMMAND_FAILED"
          ? 502
          : 409;
    return Response.json({ code: error.code, error: error.message }, { status });
  }
  console.error(error);
  return Response.json(
    { error: "Falha inesperada no fluxo local de publicacao." },
    { status: 500 },
  );
}

export async function GET(request: Request) {
  const localError = requireLocalRequest(request);
  if (localError) return localError;

  try {
    const projectRoot = await resolveLocalProjectRoot();
    const local = await getLocalPublicationStatus({ projectRoot });
    const remote = new URL(request.url).searchParams.get("remote") === "1"
      ? await getRemotePublicationStatus({ projectRoot })
      : null;
    return Response.json({ local, remote });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const localError = requireLocalRequest(request);
  if (localError) return localError;

  try {
    const projectRoot = await resolveLocalProjectRoot();
    const body = (await request.json()) as {
      action?: "merge" | "prepare" | "submit" | "verify";
      branchName?: string;
      expectedFingerprint?: string;
      message?: string;
      responsible?: string;
    };

    switch (body.action) {
      case "verify":
        return Response.json({
          local: await verifyLocalPublication({ projectRoot }),
          remote: null,
        });
      case "prepare":
        return Response.json({
          local: await prepareLocalPublication({
            branchName: body.branchName,
            expectedFingerprint: body.expectedFingerprint,
            message: body.message,
            projectRoot,
            responsible: body.responsible,
          }),
          remote: null,
        });
      case "submit":
        return Response.json({
          local: await getLocalPublicationStatus({ projectRoot }),
          remote: await submitLocalPublication({ projectRoot }),
        });
      case "merge":
        return Response.json({
          local: await getLocalPublicationStatus({ projectRoot }),
          remote: await mergeLocalPublication({
            projectRoot,
            responsible: body.responsible,
          }),
        });
      default:
        return Response.json({ error: "Acao de publicacao invalida." }, { status: 400 });
    }
  } catch (error) {
    return errorResponse(error);
  }
}
