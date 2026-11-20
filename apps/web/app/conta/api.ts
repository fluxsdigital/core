import { demoEnabled, demoResponse } from "./demo-api";

let pendingRefresh: Promise<Response> | undefined;

function readRefresh() {
  pendingRefresh ??= fetch("/api/v1/auth/refresh", { method: "POST" }).finally(() => {
    pendingRefresh = undefined;
  });
  return pendingRefresh;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function send(endpoint: string, method = "GET", body?: object, authenticated = true) {
  if (demoEnabled) return demoResponse(endpoint, method, body);

  const options: RequestInit = { method, cache: "no-store" };
  if (body instanceof FormData) options.body = body;
  else if (body) {
    options.headers = { "Content-Type": "application/json" };
    options.body = JSON.stringify(body);
  }
  const url = `/api/v1/${endpoint}`;
  let response = await fetch(url, options);
  if (authenticated && response.status === 401 && (await readRefresh()).ok) {
    response = await fetch(url, options);
  }
  return response;
}

export async function api<T = void>(
  endpoint: string,
  method = "GET",
  body?: object,
  authenticated = true,
) {
  const response = await send(endpoint, method, body, authenticated);
  if (response.status === 204 || response.status === 202) return undefined as T;
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      response.status,
      Array.isArray(payload?.message)
        ? payload.message.join(" ")
        : (payload?.message ?? "Operação indisponível."),
    );
  }
  return payload as T;
}

export async function download(endpoint: string, filename: string) {
  const response = await send(endpoint);
  if (!response.ok) {
    throw new ApiError(
      response.status,
      demoEnabled
        ? "Downloads estão desativados na demo visual."
        : "Não foi possível baixar o arquivo.",
    );
  }
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
