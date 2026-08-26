"use client";

export class ApiClientError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Thin JSON fetch wrapper — throws ApiClientError with the server's message. */
export async function api<T = unknown>(
  url: string,
  init?: RequestInit & { json?: unknown }
): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...rest.headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiClientError(
      res.status,
      (body as { error?: string })?.error ?? "Something went wrong. Try again."
    );
  }
  return body as T;
}
