import type { ApiErrorBody } from "@verity/shared";

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public fields?: Record<string, string[] | undefined>,
  ) {
    super(code);
  }
}

type Options = {
  method?: string;
  json?: unknown;
  form?: FormData;
  body?: BodyInit;
  contentType?: string;
  signal?: AbortSignal;
};

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const method = opts.method ?? (opts.json !== undefined || opts.form || opts.body ? "POST" : "GET");
  const headers: Record<string, string> = { accept: "application/json" };
  if (method !== "GET") headers["x-verity-csrf"] = "1";
  let body: BodyInit | undefined;
  if (opts.json !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(opts.json);
  } else if (opts.form) {
    body = opts.form;
  } else if (opts.body) {
    body = opts.body;
    if (opts.contentType) headers["content-type"] = opts.contentType;
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body, credentials: "include", signal: opts.signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError(0, "network");
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : undefined;
  if (!res.ok) {
    const err = (data as ApiErrorBody | undefined)?.error;
    throw new ApiError(res.status, err?.code ?? "generic", err?.fields);
  }
  return data as T;
}

export const tp = (slug: string, path = "") => `/t/${encodeURIComponent(slug)}${path}`;
export const fileUrl = (id: string) => `${BASE}/files/${encodeURIComponent(id)}`;
