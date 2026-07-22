import { NextResponse } from "next/server";

export function apiError(error: unknown, status = 400): NextResponse {
  const message = error instanceof Error ? error.message : "Something went wrong";
  const code = message === "STALE_VERSION" ? "STALE_VERSION" : "REQUEST_FAILED";
  return NextResponse.json({ error: { code, message } }, { status: code === "STALE_VERSION" ? 409 : status });
}

export function cookieFromHeader(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

export function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return process.env.NODE_ENV !== "production";
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  const allowed = new Set<string>();
  if (configured) allowed.add(new URL(configured).origin);
  if (process.env.VERCEL_URL) allowed.add(`https://${process.env.VERCEL_URL}`);
  if (allowed.size > 0) return allowed.has(origin);
  return process.env.NODE_ENV !== "production";
}
