import { fileURLToPath } from "node:url";
import {
  recoverInterruptedPromotions,
  rollbackPromotion,
} from "../lib/private-capture-promotion.mjs";
import {
  restorePrivateCapture,
  verifyPrivateCapture,
} from "../lib/private-capture-store.mjs";

const usage = `Uso:
  npm run captures:ops -- verify <captureId>
  npm run captures:ops -- recover-promotions
  npm run captures:ops -- restore <captureId> <trashId>
  npm run captures:ops -- rollback <transactionId> --by <responsavel>`;

function option(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

function writeResult(output, result) {
  output.write(`${JSON.stringify(result, null, 2)}\n`);
}

export async function runPrivateCaptureOps({
  args = process.argv.slice(2),
  output = process.stdout,
  projectRoot = process.cwd(),
} = {}) {
  const [command, first, second] = args;

  if (command === "verify" && first && !second) {
    const { record } = await verifyPrivateCapture({
      captureId: first,
      projectRoot,
    });
    const result = {
      captureId: record.captureId,
      canonicalSha256: record.canonicalSha256,
      editionId: record.editionId,
      rawSha256: record.rawSha256,
      state: record.state,
      verified: true,
      workId: record.workId,
    };
    writeResult(output, result);
    return result;
  }

  if (command === "recover-promotions" && !first) {
    const result = await recoverInterruptedPromotions({ projectRoot });
    const summary = {
      recoveredCount: result.recovered.length,
      releasedStaleLock: result.releasedStaleLock,
      transactionIds: result.recovered,
    };
    writeResult(output, summary);
    return summary;
  }

  if (command === "restore" && first && second && args.length === 3) {
    const result = await restorePrivateCapture({
      captureId: first,
      projectRoot,
      trashId: second,
    });
    const summary = { captureId: result.captureId, restored: result.restored };
    writeResult(output, summary);
    return summary;
  }

  if (command === "rollback" && first) {
    const rolledBackBy = option(args, "--by");
    if (!rolledBackBy || args.length !== 4) throw new Error(usage);
    const result = await rollbackPromotion({
      projectRoot,
      rolledBackBy,
      transactionId: first,
    });
    writeResult(output, result);
    return result;
  }

  throw new Error(usage);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runPrivateCaptureOps().catch((error) => {
    const expected = ["PrivateCaptureError", "PrivatePromotionError"].includes(
      error?.name,
    );
    const message = expected
      ? error.message
      : error?.message === usage
        ? usage
        : "Falha operacional local. Consulte o codigo e os logs redigidos.";
    console.error(
      JSON.stringify({
        code: expected ? error.code : "OPERATION_FAILED",
        message,
      }),
    );
    process.exitCode = 1;
  });
}
