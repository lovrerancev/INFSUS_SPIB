import type { FastifyRequest } from "fastify";
import { verifyAccessToken } from "../lib/jwt.js";
import type { AuthUser } from "../domain/authTypes.js";

export function tryAuthUser(request: FastifyRequest): AuthUser | undefined {
  const h = request.headers.authorization;
  if (!h?.startsWith("Bearer ")) return undefined;
  try {
    const p = verifyAccessToken(h.slice(7).trim());
    return { korisnik_id: p.sub, role: p.role };
  } catch {
    return undefined;
  }
}

export function requireAuth(request: FastifyRequest): AuthUser {
  const u = tryAuthUser(request);
  if (!u) {
    const e = new Error("Potrebna je prijava");
    (e as Error & { statusCode: number }).statusCode = 401;
    throw e;
  }
  return u;
}

export function requireDjelatnik(request: FastifyRequest): AuthUser {
  const u = requireAuth(request);
  if (u.role !== "djelatnik") {
    const e = new Error("Samo djelatnik");
    (e as Error & { statusCode: number }).statusCode = 403;
    throw e;
  }
  return u;
}

export function requireAdministrator(request: FastifyRequest): AuthUser {
  const u = requireAuth(request);
  if (u.role !== "administrator") {
    const e = new Error("Samo administrator");
    (e as Error & { statusCode: number }).statusCode = 403;
    throw e;
  }
  return u;
}

export function requireKupac(request: FastifyRequest): AuthUser {
  const u = requireAuth(request);
  if (u.role !== "kupac") {
    const e = new Error("Samo kupac");
    (e as Error & { statusCode: number }).statusCode = 403;
    throw e;
  }
  return u;
}

/** Katalog (javni pregled) — administrator ne smije. */
export function forbidAdministratorKatalog(request: FastifyRequest): void {
  const u = tryAuthUser(request);
  if (u?.role === "administrator") {
    const e = new Error("Administrator nema pristup katalogu");
    (e as Error & { statusCode: number }).statusCode = 403;
    throw e;
  }
}
