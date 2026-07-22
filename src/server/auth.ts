import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function createResumeToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashResumeToken(token: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters");
  return createHash("sha256").update(`${secret}:${token}`).digest("hex");
}

export function tokenMatches(token: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashResumeToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function roomCookieName(slug: string): string {
  return `rill_${slug}`;
}
