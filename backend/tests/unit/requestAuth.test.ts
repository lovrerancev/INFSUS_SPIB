import { describe, expect, it } from "vitest";
import type { FastifyRequest } from "fastify";
import { signAccessToken } from "../../src/lib/jwt.js";
import {
  forbidAdministratorKatalog,
  requireAdministrator,
  requireAuth,
  requireDjelatnik,
  requireKupac,
  tryAuthUser,
} from "../../src/presentation/requestAuth.js";

function requestWithAuthHeader(value?: string): FastifyRequest {
  return {
    headers: value ? { authorization: value } : {},
  } as FastifyRequest;
}

function bearer(sub: number, role: "kupac" | "djelatnik" | "administrator"): string {
  return `Bearer ${signAccessToken({ sub, role })}`;
}

describe("requestAuth", () => {
  it("tryAuthUser vraća undefined bez Bearer tokena", () => {
    expect(tryAuthUser(requestWithAuthHeader())).toBeUndefined();
    expect(tryAuthUser(requestWithAuthHeader("Basic abc"))).toBeUndefined();
  });

  it("requireAuth čita korisnika iz valjanog JWT-a", () => {
    const user = requireAuth(requestWithAuthHeader(bearer(42, "kupac")));

    expect(user).toEqual({ korisnik_id: 42, role: "kupac" });
  });

  it("role guardovi vraćaju 403 za krivu ulogu", () => {
    expect(() => requireDjelatnik(requestWithAuthHeader(bearer(1, "kupac")))).toThrow(/Samo djelatnik/);
    expect(() => requireAdministrator(requestWithAuthHeader(bearer(1, "djelatnik")))).toThrow(/Samo administrator/);
    expect(() => requireKupac(requestWithAuthHeader(bearer(1, "administrator")))).toThrow(/Samo kupac/);
  });

  it("forbidAdministratorKatalog zabranjuje katalog administratoru", () => {
    expect(() => forbidAdministratorKatalog(requestWithAuthHeader(bearer(1, "administrator")))).toThrow(
      /Administrator nema pristup katalogu/,
    );
    expect(() => forbidAdministratorKatalog(requestWithAuthHeader(bearer(1, "kupac")))).not.toThrow();
    expect(() => forbidAdministratorKatalog(requestWithAuthHeader())).not.toThrow();
  });
});
