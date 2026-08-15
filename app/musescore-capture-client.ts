const DEFAULT_BRIDGE_URL = "http://127.0.0.1:47631";
const POLL_INTERVAL_MS = 250;

type BridgeSession = {
  browserToken: string;
  protocol: string;
  sessionId: string;
};

export type MuseScoreBridgeStatus = {
  activeRequestId: string | null;
  bridge: "online";
  capture: "idle" | "waiting";
  maxCaptureBytes: number;
  maxPendingRequests: number;
  plugin: "absent" | "pairing" | "paired" | "exporting" | "failed";
  protocol: string;
};

export type MuseScoreCaptureResult = {
  byteLength: number;
  captureId: string;
  capturedAt: string;
  musescoreVersion: string | null;
  pluginVersion: string | null;
  protocol: string;
  requestId: string;
  sha256: string;
  state: "ready";
  xml: string;
};

type BridgeFailure = {
  error?: {
    code?: string;
    message?: string;
    retryable?: boolean;
  };
  state?: "failed";
};

export class MuseScoreBridgeError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "MuseScoreBridgeError";
    this.code = code;
  }
}

async function responseBody(response: Response) {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function bridgeError(body: BridgeFailure, fallback: string) {
  return new MuseScoreBridgeError(
    body.error?.code || "BRIDGE_UNAVAILABLE",
    body.error?.message || fallback,
  );
}

function wait(delay: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, delay);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Captura cancelada", "AbortError"));
      },
      { once: true },
    );
  });
}

export class MuseScoreCaptureClient {
  private readonly baseUrl: string;
  private currentController: AbortController | null = null;
  private currentRequestId: string | null = null;
  private session: BridgeSession | null = null;

  constructor(baseUrl = DEFAULT_BRIDGE_URL) {
    this.baseUrl = baseUrl;
  }

  private async openSession() {
    const response = await fetch(`${this.baseUrl}/api/v1/session`, {
      cache: "no-store",
    });
    const body = (await responseBody(response)) as BridgeSession & BridgeFailure;
    if (
      !response.ok ||
      typeof body.browserToken !== "string" ||
      typeof body.sessionId !== "string"
    ) {
      throw bridgeError(body, "Ponte local do MuseScore indisponivel.");
    }
    this.session = body;
    return body;
  }

  private async authenticatedFetch(path: string, init: RequestInit = {}) {
    const session = this.session ?? (await this.openSession());
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        ...init.headers,
        "X-Cancioneiro-Browser-Token": session.browserToken,
      },
    });
    if (response.status === 401) this.session = null;
    return response;
  }

  async status() {
    const response = await this.authenticatedFetch("/api/v1/status");
    const body = (await responseBody(response)) as MuseScoreBridgeStatus & BridgeFailure;
    if (!response.ok) throw bridgeError(body, "Nao consegui consultar a ponte.");
    return body;
  }

  cancel() {
    this.currentRequestId = null;
    this.currentController?.abort();
    this.currentController = null;
  }

  async capture() {
    this.cancel();
    const controller = new AbortController();
    this.currentController = controller;

    const createResponse = await this.authenticatedFetch("/api/v1/captures", {
      method: "POST",
      signal: controller.signal,
    });
    const created = (await responseBody(createResponse)) as {
      requestId?: string;
    } & BridgeFailure;
    if (!createResponse.ok || typeof created.requestId !== "string") {
      throw bridgeError(created, "Nao consegui iniciar a captura.");
    }

    const requestId = created.requestId;
    this.currentRequestId = requestId;

    try {
      while (!controller.signal.aborted) {
        const response = await this.authenticatedFetch(
          `/api/v1/captures/${encodeURIComponent(requestId)}`,
          { signal: controller.signal },
        );
        const body = (await responseBody(response)) as
          | MuseScoreCaptureResult
          | BridgeFailure;

        if (this.currentRequestId !== requestId) {
          throw new DOMException("Resposta de captura antiga", "AbortError");
        }
        if (response.status === 202) {
          await wait(POLL_INTERVAL_MS, controller.signal);
          continue;
        }
        if (!response.ok || body.state === "failed") {
          throw bridgeError(body as BridgeFailure, "A captura do MuseScore falhou.");
        }
        if (
          body.state !== "ready" ||
          typeof body.xml !== "string" ||
          typeof body.sha256 !== "string" ||
          typeof body.captureId !== "string" ||
          typeof body.protocol !== "string"
        ) {
          throw new MuseScoreBridgeError(
            "INVALID_CAPTURE_RESPONSE",
            "A ponte devolveu uma captura incompleta.",
          );
        }
        return body;
      }
      throw new DOMException("Captura cancelada", "AbortError");
    } finally {
      if (this.currentRequestId === requestId) this.currentRequestId = null;
      if (this.currentController === controller) this.currentController = null;
    }
  }
}
