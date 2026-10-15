import "server-only";

import type { Serialized } from "@/types/serialized";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

function getErrorMessage(errorText: string, status: number): string {
  const fallbackMessage = `API request failed with status ${status}`;

  if (!errorText) {
    return fallbackMessage;
  }

  try {
    const parsed = JSON.parse(errorText);
    const candidate =
      typeof parsed?.error === "string" ? parsed.error : errorText;

    return candidate.trim() || fallbackMessage;
  } catch {
    return errorText.trim() || fallbackMessage;
  }
}

export async function apiFetch<T>(path: string): Promise<Serialized<T>> {
  const res = await fetch(`${process.env.API_URL}${path}`);

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new ApiError(res.status, getErrorMessage(errorText, res.status));
  }

  return await res.json();
}
