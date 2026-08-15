import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CAPTURE_REQUEST_TIMEOUT_MS,
  isCurrentCaptureResponse,
  MAX_CAPTURE_BYTES,
  MAX_PENDING_CAPTURE_REQUESTS,
  MUSESCORE_CAPTURE_PROTOCOL,
  parseCaptureMessage,
} from "../lib/musescore-capture-protocol.mjs";
import { assertMusicXmlDocument } from "../lib/musicxml-metadata.mjs";

const DEFAULT_PORT = 47631;
const LOOPBACK_HOST = "127.0.0.1";
const TEMP_PREFIX = "o-cancioneiro-musescore-";
const STALE_TEMP_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_CONTROL_BODY_BYTES = 64 * 1024;
const MAX_COMPLETED_CAPTURES = 2;
const PLUGIN_HEARTBEAT_TIMEOUT_MS = 3_000;

function opaqueId(prefix) {
  return `${prefix}_${randomBytes(18).toString("hex")}`;
}

function secret() {
  return randomBytes(32).toString("base64url");
}

function secureEqual(actual, expected) {
  if (typeof actual !== "string" || typeof expected !== "string") return false;
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function isLoopbackOrigin(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

export function parseAllowedOrigins(value) {
  const origins = (value || "http://localhost:3000,http://127.0.0.1:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0 || origins.some((origin) => !isLoopbackOrigin(origin))) {
    throw new Error("Origens da ponte devem ser HTTP e exclusivamente loopback");
  }

  return new Set(origins);
}

export function parseMaxCaptureBytes(value) {
  if (value === undefined || value === null || value === "") {
    return MAX_CAPTURE_BYTES;
  }
  const parsed = Number(value);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 1 ||
    parsed > MAX_CAPTURE_BYTES
  ) {
    throw new Error(
      `CANCIONEIRO_MUSESCORE_MAX_CAPTURE_BYTES deve ser um inteiro entre 1 e ${MAX_CAPTURE_BYTES}`,
    );
  }
  return parsed;
}

async function cleanupStaleDirectories(tempRoot, nowMs) {
  let entries;
  try {
    entries = await fs.readdir(tempRoot, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }

  await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && entry.name.startsWith(TEMP_PREFIX))
      .map(async (entry) => {
        const target = path.join(tempRoot, entry.name);
        const stats = await fs.stat(target);
        let ownerIsActive = false;
        let ownerIsKnown = false;
        try {
          const owner = JSON.parse(
            await fs.readFile(path.join(target, ".owner.json"), "utf8"),
          );
          if (Number.isSafeInteger(owner.pid) && owner.pid > 0) {
            ownerIsKnown = true;
            try {
              process.kill(owner.pid, 0);
              ownerIsActive = true;
            } catch (error) {
              ownerIsActive = error.code !== "ESRCH";
            }
          }
        } catch (error) {
          if (error.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
        }

        if (
          !ownerIsActive &&
          (ownerIsKnown || nowMs - stats.mtimeMs >= STALE_TEMP_AGE_MS)
        ) {
          await fs.rm(target, { recursive: true, force: true });
        }
      }),
  );
}

function sendJson(response, status, body, origin = null) {
  const serialized = JSON.stringify(body);
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(serialized),
    "Content-Type": "application/json; charset=utf-8",
    ...(origin
      ? {
          "Access-Control-Allow-Headers":
            "Content-Type, X-Cancioneiro-Browser-Token, X-Cancioneiro-Plugin-Token, X-Cancioneiro-Plugin-Session",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Origin": origin,
          Vary: "Origin",
        }
      : {}),
  });
  response.end(serialized);
}

async function readJson(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > MAX_CONTROL_BODY_BYTES) {
      throw Object.assign(new Error("Corpo de controle excede o limite"), {
        status: 413,
        code: "CONTROL_PAYLOAD_TOO_LARGE",
      });
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(new Error("JSON invalido"), {
      status: 400,
      code: "INVALID_JSON",
    });
  }
}

function operationalError(code, message, status = 400) {
  return Object.assign(new Error(message), { code, status });
}

export async function createMuseScoreCaptureBridge({
  allowedOrigins = parseAllowedOrigins(process.env.CANCIONEIRO_IMPORT_ORIGINS),
  host = LOOPBACK_HOST,
  logger = (event) => console.log(JSON.stringify(event)),
  maxCaptureBytes = parseMaxCaptureBytes(
    process.env.CANCIONEIRO_MUSESCORE_MAX_CAPTURE_BYTES,
  ),
  now = () => Date.now(),
  port = Number(process.env.CANCIONEIRO_MUSESCORE_BRIDGE_PORT || DEFAULT_PORT),
  tempRoot = os.tmpdir(),
} = {}) {
  if (host !== LOOPBACK_HOST) {
    throw new Error("A ponte MuseScore so pode escutar em 127.0.0.1");
  }
  if (
    !Number.isSafeInteger(maxCaptureBytes) ||
    maxCaptureBytes < 1 ||
    maxCaptureBytes > MAX_CAPTURE_BYTES
  ) {
    throw new Error("Limite de captura invalido");
  }
  if (!(allowedOrigins instanceof Set) || [...allowedOrigins].some((origin) => !isLoopbackOrigin(origin))) {
    throw new Error("Allowlist de origens locais invalida");
  }

  await cleanupStaleDirectories(tempRoot, now());
  const temporaryDirectory = await fs.mkdtemp(path.join(tempRoot, TEMP_PREFIX));
  await fs.writeFile(
    path.join(temporaryDirectory, ".owner.json"),
    JSON.stringify({ pid: process.pid, startedAt: new Date(now()).toISOString() }),
    { mode: 0o600 },
  );
  const sessionId = opaqueId("session");
  const pluginSessionId = opaqueId("plugin");
  const browserToken = secret();
  const pluginToken = secret();
  const completed = new Map();
  let activeRequest = null;
  let expirationTimer = null;
  let pluginState = "absent";
  let pluginLastSeenAt = null;
  let pluginDetails = null;
  let closed = false;

  function log(event, details = {}) {
    logger({ event, ...details });
  }

  function rememberCompleted(requestId, result) {
    completed.set(requestId, result);
    while (completed.size > MAX_COMPLETED_CAPTURES) {
      completed.delete(completed.keys().next().value);
    }
  }

  function expireActiveRequest() {
    if (!activeRequest || now() < activeRequest.expiresAtMs) return;
    const failed = {
      requestId: activeRequest.requestId,
      state: "failed",
      error: {
        code: "REQUEST_EXPIRED",
        message: "A captura expirou antes da confirmacao do plugin.",
        retryable: true,
      },
    };
    rememberCompleted(activeRequest.requestId, failed);
    void fs.rm(activeRequest.destinationPath, { force: true });
    activeRequest = null;
    pluginState =
      pluginLastSeenAt !== null && now() - pluginLastSeenAt <= PLUGIN_HEARTBEAT_TIMEOUT_MS
        ? "paired"
        : "absent";
    log("capture_expired");
  }

  function scheduleExpiration() {
    if (expirationTimer) clearTimeout(expirationTimer);
    if (!activeRequest) return;
    const delay = Math.max(0, activeRequest.expiresAtMs - now());
    expirationTimer = setTimeout(expireActiveRequest, delay);
    expirationTimer.unref?.();
  }

  function browserOrigin(request) {
    const origin = request.headers.origin;
    if (typeof origin !== "string" || !allowedOrigins.has(origin)) {
      throw operationalError("ORIGIN_REJECTED", "Origem local nao autorizada", 403);
    }
    return origin;
  }

  function requireBrowser(request) {
    const origin = browserOrigin(request);
    if (!secureEqual(request.headers["x-cancioneiro-browser-token"], browserToken)) {
      const error = operationalError(
        "TOKEN_REJECTED",
        "Sessao do navegador invalida",
        401,
      );
      error.corsOrigin = origin;
      throw error;
    }
    return origin;
  }

  function requirePlugin(request) {
    const origin = request.headers.origin;
    if (typeof origin === "string" && !allowedOrigins.has(origin)) {
      throw operationalError("ORIGIN_REJECTED", "Origem nao autorizada", 403);
    }
    if (!secureEqual(request.headers["x-cancioneiro-plugin-token"], pluginToken)) {
      throw operationalError("TOKEN_REJECTED", "Sessao do plugin invalida", 401);
    }
    if (request.headers["x-cancioneiro-plugin-session"] !== pluginSessionId) {
      throw operationalError("SESSION_EXPIRED", "Sessao do plugin expirada", 409);
    }
    pluginLastSeenAt = now();
  }

  function statusPayload() {
    expireActiveRequest();
    const observedPluginState =
      pluginLastSeenAt !== null && now() - pluginLastSeenAt <= PLUGIN_HEARTBEAT_TIMEOUT_MS
        ? pluginState
        : "absent";
    return {
      protocol: MUSESCORE_CAPTURE_PROTOCOL,
      bridge: "online",
      plugin: observedPluginState,
      capture: activeRequest ? "waiting" : "idle",
      activeRequestId: activeRequest?.requestId ?? null,
      maxCaptureBytes,
      maxPendingRequests: MAX_PENDING_CAPTURE_REQUESTS,
    };
  }

  async function verifyCaptureFile(requestState) {
    const expectedPath = requestState.destinationPath;
    let stats;
    try {
      stats = await fs.lstat(expectedPath);
    } catch (error) {
      if (error.code === "ENOENT") {
        throw operationalError("FILE_NOT_FOUND", "Arquivo exportado nao encontrado", 422);
      }
      throw error;
    }

    if (stats.isSymbolicLink()) {
      throw operationalError("SYMLINK_REJECTED", "Link simbolico rejeitado", 422);
    }
    if (!stats.isFile()) {
      throw operationalError("PATH_MISMATCH", "Captura nao e arquivo regular", 422);
    }
    const [realFile, realDirectory] = await Promise.all([
      fs.realpath(expectedPath),
      fs.realpath(temporaryDirectory),
    ]);
    if (
      realFile !== path.join(realDirectory, path.basename(expectedPath)) ||
      path.dirname(realFile) !== realDirectory ||
      !realFile.toLowerCase().endsWith(".musicxml")
    ) {
      throw operationalError("PATH_MISMATCH", "Caminho de captura rejeitado", 422);
    }
    if (stats.size < 1 || stats.size > requestState.maxBytes) {
      throw operationalError("FILE_TOO_LARGE", "Tamanho da captura rejeitado", 422);
    }

    const raw = await fs.readFile(expectedPath);
    if (raw.byteLength !== stats.size) {
      throw operationalError("FILE_TOO_LARGE", "Tamanho da captura mudou durante a leitura", 422);
    }
    const xml = raw.toString("utf8");
    try {
      assertMusicXmlDocument("capture.musicxml", xml);
    } catch {
      throw operationalError("INVALID_MUSICXML", "Documento MusicXML invalido", 422);
    }
    const sha256 = createHash("sha256").update(raw).digest("hex");
    return { byteLength: raw.byteLength, sha256, xml };
  }

  async function handlePluginMessage(message) {
    const parsed = parseCaptureMessage(message);
    if (parsed.payload.sessionId !== sessionId || parsed.payload.pluginSessionId !== pluginSessionId) {
      throw operationalError("SESSION_EXPIRED", "Mensagem pertence a outra sessao", 409);
    }

    if (parsed.messageType === "SESSION_OPEN") {
      if (!parsed.payload.supportedProtocols.includes(MUSESCORE_CAPTURE_PROTOCOL)) {
        throw operationalError("UNSUPPORTED_PROTOCOL", "Plugin incompativel", 409);
      }
      pluginState = "paired";
      pluginDetails = {
        musescoreVersion: parsed.payload.musescoreVersion,
        pluginVersion: parsed.payload.pluginVersion,
      };
      log("plugin_paired");
      return { accepted: true, protocol: MUSESCORE_CAPTURE_PROTOCOL };
    }

    if (!["CAPTURE_READY", "CAPTURE_FAILED", "STATUS"].includes(parsed.messageType)) {
      throw operationalError("UNKNOWN_MESSAGE_TYPE", "Mensagem nao permitida para o plugin", 400);
    }
    if (parsed.messageType === "STATUS") {
      pluginState = parsed.payload.pluginState;
      return { accepted: true };
    }

    expireActiveRequest();
    const previous = completed.get(parsed.payload.requestId);
    if (previous) {
      if (parsed.messageType === "CAPTURE_READY" && previous.state === "ready") {
        return {
          accepted: true,
          captureId: previous.captureId,
          idempotent: true,
          sha256: previous.sha256,
        };
      }
      throw operationalError("REQUEST_DUPLICATE", "Requisicao ja concluida", 409);
    }
    if (!activeRequest || !isCurrentCaptureResponse(parsed, activeRequest)) {
      throw operationalError("REQUEST_STALE", "Resposta nao corresponde a captura ativa", 409);
    }

    if (parsed.messageType === "CAPTURE_FAILED") {
      rememberCompleted(parsed.payload.requestId, {
        requestId: parsed.payload.requestId,
        state: "failed",
        error: parsed.payload.error,
      });
      await fs.rm(activeRequest.destinationPath, { force: true });
      activeRequest = null;
      pluginState = "paired";
      scheduleExpiration();
      log("capture_failed", { code: parsed.payload.error.code });
      return { accepted: true };
    }

    const verified = await verifyCaptureFile(activeRequest);
    const result = {
      requestId: parsed.payload.requestId,
      captureId: opaqueId("capture"),
      capturedAt: new Date(now()).toISOString(),
      musescoreVersion: pluginDetails?.musescoreVersion ?? null,
      pluginVersion: pluginDetails?.pluginVersion ?? null,
      protocol: MUSESCORE_CAPTURE_PROTOCOL,
      state: "ready",
      ...verified,
    };
    rememberCompleted(parsed.payload.requestId, result);
    await fs.rm(activeRequest.destinationPath, { force: true });
    activeRequest = null;
    pluginState = "paired";
    scheduleExpiration();
    log("capture_ready", { byteLength: result.byteLength });
    return { accepted: true, captureId: result.captureId, sha256: result.sha256 };
  }

  const server = http.createServer(async (request, response) => {
    let corsOrigin = null;
    try {
      const url = new URL(request.url || "/", `http://${host}`);

      if (request.method === "OPTIONS") {
        corsOrigin = browserOrigin(request);
        sendJson(response, 204, {}, corsOrigin);
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/v1/session") {
        corsOrigin = browserOrigin(request);
        sendJson(
          response,
          200,
          { protocol: MUSESCORE_CAPTURE_PROTOCOL, sessionId, browserToken },
          corsOrigin,
        );
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/v1/plugin-session") {
        const origin = request.headers.origin;
        if (typeof origin === "string" && !allowedOrigins.has(origin)) {
          throw operationalError("ORIGIN_REJECTED", "Origem nao autorizada", 403);
        }
        sendJson(response, 200, {
          protocol: MUSESCORE_CAPTURE_PROTOCOL,
          sessionId,
          pluginSessionId,
          pluginToken,
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/v1/status") {
        corsOrigin = requireBrowser(request);
        sendJson(response, 200, statusPayload(), corsOrigin);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/v1/captures") {
        corsOrigin = requireBrowser(request);
        expireActiveRequest();
        if (
          pluginState !== "paired" ||
          pluginLastSeenAt === null ||
          now() - pluginLastSeenAt > PLUGIN_HEARTBEAT_TIMEOUT_MS
        ) {
          throw operationalError("PLUGIN_NOT_READY", "Plugin ainda nao esta pareado", 409);
        }
        if (activeRequest) {
          throw operationalError("REQUEST_DUPLICATE", "Ja existe uma captura ativa", 409);
        }
        const requestId = opaqueId("request");
        const requestedAtMs = now();
        const expiresAtMs = requestedAtMs + CAPTURE_REQUEST_TIMEOUT_MS;
        const destinationPath = path.join(
          temporaryDirectory,
          `${opaqueId("capture")}.musicxml`,
        );
        activeRequest = {
          sessionId,
          pluginSessionId,
          requestId,
          requestedAtMs,
          expiresAtMs,
          destinationPath,
          maxBytes: maxCaptureBytes,
        };
        scheduleExpiration();
        log("capture_requested");
        sendJson(
          response,
          202,
          {
            requestId,
            requestedAt: new Date(requestedAtMs).toISOString(),
            expiresAt: new Date(expiresAtMs).toISOString(),
          },
          corsOrigin,
        );
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/v1/plugin/events") {
        requirePlugin(request);
        expireActiveRequest();
        if (!activeRequest) {
          sendJson(response, 200, { events: [] });
          return;
        }
        pluginState = "exporting";
        const requestedAt = new Date(activeRequest.requestedAtMs).toISOString();
        const expiresAt = new Date(activeRequest.expiresAtMs).toISOString();
        sendJson(response, 200, {
          events: [
            {
              protocol: MUSESCORE_CAPTURE_PROTOCOL,
              messageType: "CAPTURE_REQUEST",
              messageId: opaqueId("message"),
              sentAt: new Date(now()).toISOString(),
              payload: {
                sessionId,
                pluginSessionId,
                requestId: activeRequest.requestId,
                requestedAt,
                expiresAt,
                destinationPath: activeRequest.destinationPath,
                maxBytes: activeRequest.maxBytes,
              },
            },
          ],
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/v1/plugin/messages") {
        requirePlugin(request);
        const result = await handlePluginMessage(await readJson(request));
        sendJson(response, 200, result);
        return;
      }

      const captureMatch = url.pathname.match(/^\/api\/v1\/captures\/([^/]+)$/);
      if (request.method === "GET" && captureMatch) {
        corsOrigin = requireBrowser(request);
        expireActiveRequest();
        const requestId = decodeURIComponent(captureMatch[1]);
        const result = completed.get(requestId);
        if (result) {
          sendJson(response, 200, result, corsOrigin);
          return;
        }
        if (activeRequest?.requestId === requestId) {
          sendJson(response, 202, { requestId, state: "waiting" }, corsOrigin);
          return;
        }
        throw operationalError("REQUEST_STALE", "Captura nao encontrada", 404);
      }

      sendJson(response, 404, { error: { code: "NOT_FOUND", message: "Rota inexistente" } });
    } catch (error) {
      const code = typeof error?.code === "string" ? error.code : "INTERNAL_ERROR";
      const status = Number.isInteger(error?.status)
        ? error.status
        : error?.name === "CaptureProtocolError"
          ? 400
          : 500;
      if (status >= 500) log("bridge_error", { code });
      sendJson(
        response,
        status,
        {
          error: {
            code,
            message: status >= 500 ? "Falha interna da ponte" : error.message,
          },
        },
        corsOrigin || error?.corsOrigin || null,
      );
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  log("bridge_started", { host, port: actualPort, protocol: MUSESCORE_CAPTURE_PROTOCOL });

  return {
    baseUrl: `http://${host}:${actualPort}`,
    async close() {
      if (closed) return;
      closed = true;
      if (expirationTimer) clearTimeout(expirationTimer);
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      await fs.rm(temporaryDirectory, { recursive: true, force: true });
      log("bridge_stopped");
    },
  };
}

async function main() {
  const bridge = await createMuseScoreCaptureBridge();
  const shutdown = async () => {
    await bridge.close();
    process.exitCode = 0;
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(JSON.stringify({ event: "bridge_start_failed", code: error.code || "INTERNAL_ERROR" }));
    process.exitCode = 1;
  });
}
