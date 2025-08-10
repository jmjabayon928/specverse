// src/utils/errors.ts

// src/utils/errors.ts

export class HttpError extends Error {
  readonly status: number;
  readonly cause?: unknown;
  constructor(status: number, message: string, cause?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.cause = cause;
  }
}

export function toError(err: unknown): Error {
  if (err instanceof Error) return err;
  if (typeof err === "string") return new Error(err);
  try { return new Error(JSON.stringify(err)); } catch { return new Error("Unknown error"); }
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try { return JSON.stringify(err); } catch { return "Unknown error"; }
}

export function isAbortError(err: unknown): boolean {
  if (typeof DOMException !== "undefined" && err instanceof DOMException) {
    return err.name === "AbortError";
  }
  if (typeof err === "object" && err !== null) {
    const name = (err as { name?: unknown }).name;
    const code = (err as { code?: unknown }).code;
    if (typeof name === "string" && name === "AbortError") return true;
    if (typeof code === "string" && code === "ABORT_ERR") return true;
  }
  return false;
}

export function isNodeErrnoException(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && typeof (err as Partial<NodeJS.ErrnoException>).code !== "undefined";
}

export interface MinimalAxiosError {
  isAxiosError: true;
  message: string;
  code?: string;
  response?: { status: number; data?: unknown };
  config?: unknown;
  request?: unknown;
}

export function isAxiosError(err: unknown): err is MinimalAxiosError {
  return typeof err === "object" && err !== null &&
    (err as { isAxiosError?: unknown }).isAxiosError === true;
}

export function getHttpStatus(err: unknown): number | undefined {
  if (err instanceof HttpError) return err.status;
  if (isAxiosError(err) && err.response) return err.response.status;
  return undefined;
}

export function assertNever(x: never, message = "Unexpected value"): never {
  throw new Error(`${message}: ${String(x)}`);
}

export function logError(err: unknown, context?: string): void {
  const msg = getErrorMessage(err);
  // Gate logs if you want less noise in tests:
  if (process.env.NODE_ENV !== "test") {
    console.error(context ? `[${context}] ${msg}` : msg, err instanceof Error ? err : undefined);
  }
}
