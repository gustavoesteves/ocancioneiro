export const MUSESCORE_CAPTURE_PROTOCOL = "cancioneiro.musescore.capture/1";
export const CAPTURE_REQUEST_TIMEOUT_MS = 30_000;
export const MAX_CAPTURE_BYTES = 16 * 1024 * 1024;
export const MAX_PENDING_CAPTURE_REQUESTS = 1;

export const CAPTURE_MESSAGE_TYPES = Object.freeze([
  "SESSION_OPEN",
  "CAPTURE_REQUEST",
  "CAPTURE_READY",
  "CAPTURE_FAILED",
  "STATUS",
]);

export const CAPTURE_ERROR_CODES = Object.freeze([
  "BRIDGE_UNAVAILABLE",
  "SESSION_EXPIRED",
  "PLUGIN_NOT_READY",
  "NO_ACTIVE_SCORE",
  "EXPORT_FAILED",
  "FILE_NOT_FOUND",
  "PATH_MISMATCH",
  "SYMLINK_REJECTED",
  "FILE_TOO_LARGE",
  "INVALID_MUSICXML",
  "REQUEST_EXPIRED",
  "REQUEST_DUPLICATE",
  "REQUEST_STALE",
  "INTERNAL_ERROR",
]);

const messageTypeSet = new Set(CAPTURE_MESSAGE_TYPES);
const errorCodeSet = new Set(CAPTURE_ERROR_CODES);
const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{15,127}$/;

/**
 * @typedef {"SESSION_OPEN" | "CAPTURE_REQUEST" | "CAPTURE_READY" | "CAPTURE_FAILED" | "STATUS"} CaptureMessageType
 * @typedef {"BRIDGE_UNAVAILABLE" | "SESSION_EXPIRED" | "PLUGIN_NOT_READY" | "NO_ACTIVE_SCORE" | "EXPORT_FAILED" | "FILE_NOT_FOUND" | "PATH_MISMATCH" | "SYMLINK_REJECTED" | "FILE_TOO_LARGE" | "INVALID_MUSICXML" | "REQUEST_EXPIRED" | "REQUEST_DUPLICATE" | "REQUEST_STALE" | "INTERNAL_ERROR"} CaptureErrorCode
 */

export class CaptureProtocolError extends Error {
  constructor(code, message, field = null) {
    super(message);
    this.name = "CaptureProtocolError";
    this.code = code;
    this.field = field;
  }
}

function fail(code, message, field = null) {
  throw new CaptureProtocolError(code, message, field);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireRecord(value, field) {
  if (!isRecord(value)) {
    fail("INVALID_PAYLOAD", `${field} deve ser um objeto`, field);
  }
  return value;
}

function requireExactKeys(value, expectedKeys, field) {
  const actualKeys = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (
    actualKeys.length !== expected.length ||
    actualKeys.some((key, index) => key !== expected[index])
  ) {
    fail(
      "INVALID_PAYLOAD",
      `${field} deve conter exatamente: ${expected.join(", ")}`,
      field,
    );
  }
}

function requireString(value, field, { maxLength = 256, minLength = 1 } = {}) {
  if (
    typeof value !== "string" ||
    value.length < minLength ||
    value.length > maxLength
  ) {
    fail("INVALID_PAYLOAD", `${field} deve ser texto valido`, field);
  }
  return value;
}

function requireIdentifier(value, field) {
  if (typeof value !== "string" || !identifierPattern.test(value)) {
    fail("INVALID_PAYLOAD", `${field} deve ser um identificador opaco`, field);
  }
}

function requireIsoInstant(value, field) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) ||
    Number.isNaN(Date.parse(value))
  ) {
    fail("INVALID_PAYLOAD", `${field} deve ser um instante UTC ISO 8601`, field);
  }
}

function requireEnum(value, allowed, field) {
  if (typeof value !== "string" || !allowed.includes(value)) {
    fail("INVALID_PAYLOAD", `${field} possui valor nao suportado`, field);
  }
}

function requirePositiveInteger(value, field, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    fail("INVALID_PAYLOAD", `${field} deve ser inteiro positivo`, field);
  }
}

function validateSessionIdentity(payload) {
  requireIdentifier(payload.sessionId, "payload.sessionId");
  requireIdentifier(payload.pluginSessionId, "payload.pluginSessionId");
}

function validateSessionOpen(payload) {
  requireExactKeys(
    payload,
    [
      "sessionId",
      "pluginSessionId",
      "pluginVersion",
      "musescoreVersion",
      "supportedProtocols",
    ],
    "payload",
  );
  validateSessionIdentity(payload);
  requireString(payload.pluginVersion, "payload.pluginVersion", { maxLength: 64 });
  requireString(payload.musescoreVersion, "payload.musescoreVersion", {
    maxLength: 64,
  });
  if (
    !Array.isArray(payload.supportedProtocols) ||
    payload.supportedProtocols.length === 0 ||
    payload.supportedProtocols.length > 8 ||
    payload.supportedProtocols.some(
      (protocol) =>
        typeof protocol !== "string" ||
        protocol.length === 0 ||
        protocol.length > 128,
    ) ||
    !payload.supportedProtocols.includes(MUSESCORE_CAPTURE_PROTOCOL)
  ) {
    fail(
      "INVALID_PAYLOAD",
      "payload.supportedProtocols deve listar protocolos suportados",
      "payload.supportedProtocols",
    );
  }
}

function validateCaptureRequest(payload) {
  requireExactKeys(
    payload,
    [
      "sessionId",
      "pluginSessionId",
      "requestId",
      "requestedAt",
      "expiresAt",
      "destinationPath",
      "maxBytes",
    ],
    "payload",
  );
  validateSessionIdentity(payload);
  requireIdentifier(payload.requestId, "payload.requestId");
  requireIsoInstant(payload.requestedAt, "payload.requestedAt");
  requireIsoInstant(payload.expiresAt, "payload.expiresAt");
  if (Date.parse(payload.expiresAt) <= Date.parse(payload.requestedAt)) {
    fail(
      "INVALID_PAYLOAD",
      "payload.expiresAt deve ser posterior a payload.requestedAt",
      "payload.expiresAt",
    );
  }
  if (
    Date.parse(payload.expiresAt) - Date.parse(payload.requestedAt) >
    CAPTURE_REQUEST_TIMEOUT_MS
  ) {
    fail(
      "INVALID_PAYLOAD",
      "duracao da requisicao excede o limite do protocolo",
      "payload.expiresAt",
    );
  }
  requireString(payload.destinationPath, "payload.destinationPath", {
    maxLength: 4096,
  });
  requirePositiveInteger(payload.maxBytes, "payload.maxBytes", MAX_CAPTURE_BYTES);
}

function validateCaptureReady(payload) {
  requireExactKeys(
    payload,
    [
      "sessionId",
      "pluginSessionId",
      "requestId",
      "exportedAt",
    ],
    "payload",
  );
  validateSessionIdentity(payload);
  requireIdentifier(payload.requestId, "payload.requestId");
  requireIsoInstant(payload.exportedAt, "payload.exportedAt");
}

function validateCaptureFailed(payload) {
  requireExactKeys(
    payload,
    ["sessionId", "pluginSessionId", "requestId", "failedAt", "error"],
    "payload",
  );
  validateSessionIdentity(payload);
  requireIdentifier(payload.requestId, "payload.requestId");
  requireIsoInstant(payload.failedAt, "payload.failedAt");
  const error = requireRecord(payload.error, "payload.error");
  requireExactKeys(error, ["code", "message", "retryable"], "payload.error");
  if (!errorCodeSet.has(error.code)) {
    fail("INVALID_PAYLOAD", "payload.error.code nao e estavel", "payload.error.code");
  }
  requireString(error.message, "payload.error.message", { maxLength: 512 });
  if (typeof error.retryable !== "boolean") {
    fail(
      "INVALID_PAYLOAD",
      "payload.error.retryable deve ser booleano",
      "payload.error.retryable",
    );
  }
}

function validateStatus(payload) {
  requireExactKeys(
    payload,
    [
      "sessionId",
      "pluginSessionId",
      "requestId",
      "bridgeState",
      "pluginState",
      "captureState",
      "observedAt",
    ],
    "payload",
  );
  validateSessionIdentity(payload);
  if (payload.requestId !== null) {
    requireIdentifier(payload.requestId, "payload.requestId");
  }
  requireEnum(payload.bridgeState, ["online", "stopping"], "payload.bridgeState");
  requireEnum(
    payload.pluginState,
    ["absent", "pairing", "paired", "exporting", "failed"],
    "payload.pluginState",
  );
  requireEnum(
    payload.captureState,
    ["idle", "waiting", "exporting", "ready", "failed"],
    "payload.captureState",
  );
  requireIsoInstant(payload.observedAt, "payload.observedAt");
}

const payloadValidators = {
  SESSION_OPEN: validateSessionOpen,
  CAPTURE_REQUEST: validateCaptureRequest,
  CAPTURE_READY: validateCaptureReady,
  CAPTURE_FAILED: validateCaptureFailed,
  STATUS: validateStatus,
};

export function parseCaptureMessage(candidate) {
  if (!isRecord(candidate)) {
    fail("MALFORMED_MESSAGE", "Mensagem deve ser um objeto JSON");
  }

  const expectedEnvelopeKeys = [
    "protocol",
    "messageType",
    "messageId",
    "sentAt",
    "payload",
  ];
  const actualKeys = Object.keys(candidate).sort();
  const expectedKeys = [...expectedEnvelopeKeys].sort();
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    fail(
      "INVALID_ENVELOPE",
      `Envelope deve conter exatamente: ${expectedKeys.join(", ")}`,
    );
  }

  if (candidate.protocol !== MUSESCORE_CAPTURE_PROTOCOL) {
    fail("UNSUPPORTED_PROTOCOL", "Versao do protocolo nao suportada", "protocol");
  }
  if (!messageTypeSet.has(candidate.messageType)) {
    fail("UNKNOWN_MESSAGE_TYPE", "Tipo de mensagem desconhecido", "messageType");
  }
  requireIdentifier(candidate.messageId, "messageId");
  requireIsoInstant(candidate.sentAt, "sentAt");
  const payload = requireRecord(candidate.payload, "payload");
  payloadValidators[candidate.messageType](payload);

  return candidate;
}

export function safeParseCaptureMessage(candidate) {
  try {
    return { success: true, data: parseCaptureMessage(candidate) };
  } catch (error) {
    if (error instanceof CaptureProtocolError) {
      return {
        success: false,
        error: { code: error.code, field: error.field, message: error.message },
      };
    }
    throw error;
  }
}

export function isCurrentCaptureResponse(message, currentRequest) {
  if (
    !message ||
    !currentRequest ||
    !["CAPTURE_READY", "CAPTURE_FAILED"].includes(message.messageType)
  ) {
    return false;
  }

  return (
    message.payload.sessionId === currentRequest.sessionId &&
    message.payload.pluginSessionId === currentRequest.pluginSessionId &&
    message.payload.requestId === currentRequest.requestId
  );
}
