import type { AppConfig, DashboardResponse } from "../../shared/types.js";

export interface ConfigResponse {
  config: AppConfig;
  path: string;
}

/** Raised when the sidecar server reports a failure; `message` is safe to show to the user. */
export class ApiError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError("Cannot reach the Crow's Eye server. Is `npm run dev` still running?");
  }

  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) {
    throw new ApiError(body?.error ?? `Request failed with status ${response.status}.`);
  }
  return body as T;
}

export const api = {
  dashboard: () => request<DashboardResponse>("/api/dashboard"),
  config: () => request<ConfigResponse>("/api/config"),
  saveConfig: (config: AppConfig) =>
    request<ConfigResponse>("/api/config", { method: "PUT", body: JSON.stringify(config) }),
  resetConfig: () => request<ConfigResponse>("/api/config/reset", { method: "POST" }),
};
