import {
  PrivatePromotionError,
  promotePrivateCapture,
  recoverInterruptedPromotions,
  rollbackPromotion,
} from "../../../../lib/private-capture-promotion.mjs";
import { PrivateCaptureError } from "../../../../lib/private-capture-store.mjs";
import { resolveLocalProjectRoot } from "../../../../lib/local-project-root.mjs";

const localHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

function requireLocalRequest(request: Request) {
  if (localHosts.has(new URL(request.url).hostname)) return null;
  return Response.json(
    { error: "Promocao disponivel apenas em ambiente local." },
    { status: 403 },
  );
}

function promotionErrorResponse(error: unknown) {
  if (error instanceof PrivatePromotionError) {
    const status =
      error.code === "PROMOTION_DOSSIER_NOT_FOUND"
        ? 404
        : error.code === "INVALID_PROMOTION"
          ? 400
          : 409;
    return Response.json({ code: error.code, error: error.message }, { status });
  }
  if (error instanceof PrivateCaptureError) {
    const status = error.code === "CAPTURE_NOT_FOUND" ? 404 : 400;
    return Response.json({ code: error.code, error: error.message }, { status });
  }
  if (error instanceof Error && "code" in error && error.code === "ENOENT") {
    return Response.json({ error: "Registro de promocao nao encontrado." }, { status: 404 });
  }
  return null;
}

export async function POST(request: Request) {
  const localError = requireLocalRequest(request);
  if (localError) return localError;

  try {
    const projectRoot = await resolveLocalProjectRoot();
    const body = (await request.json()) as {
      captureId?: string;
      promotedBy?: string;
      publicId?: string;
    };
    const result = await promotePrivateCapture({
      captureId: body.captureId,
      projectRoot,
      promotedBy: body.promotedBy,
      publicId: body.publicId,
    });
    return Response.json({
      asset: {
        checksum: result.asset.checksum,
        id: result.asset.id,
        path: result.asset.path,
      },
      captureId: result.captureId,
      historical: result.historical ?? false,
      idempotent: result.idempotent,
      promoted: result.promoted,
      promotedBy: result.promotedBy ?? null,
      transactionId: result.transactionId,
    });
  } catch (error) {
    const response = promotionErrorResponse(error);
    if (response) return response;
    console.error(error);
    return Response.json({ error: "Falha inesperada durante a promocao." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const localError = requireLocalRequest(request);
  if (localError) return localError;

  try {
    const projectRoot = await resolveLocalProjectRoot();
    const body = (await request.json()) as {
      rolledBackBy?: string;
      transactionId?: string;
    };
    const result = await rollbackPromotion({
      projectRoot,
      rolledBackBy: body.rolledBackBy,
      transactionId: body.transactionId,
    });
    return Response.json(result);
  } catch (error) {
    const response = promotionErrorResponse(error);
    if (response) return response;
    console.error(error);
    return Response.json({ error: "Falha inesperada durante o rollback." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const localError = requireLocalRequest(request);
  if (localError) return localError;

  try {
    const projectRoot = await resolveLocalProjectRoot();
    return Response.json(
      await recoverInterruptedPromotions({ projectRoot }),
    );
  } catch (error) {
    const response = promotionErrorResponse(error);
    if (response) return response;
    console.error(error);
    return Response.json({ error: "Falha inesperada durante a recuperacao." }, { status: 500 });
  }
}
