import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { signAccessToken } from "../../../src/lib/jwt.js";
import { registerIzvjestajiRoutes } from "../../../src/presentation/izvjestajiRoutes.js";

describe("registerIzvjestajiRoutes", () => {
  it("GET /izvjestaji/prodaja vraća 403 za djelatnika", async () => {
    const app = Fastify();
    await app.register(registerIzvjestajiRoutes, { prefix: "/api" });
    const token = signAccessToken({ sub: 1, role: "djelatnik" });
    const res = await app.inject({
      method: "GET",
      url: "/api/izvjestaji/prodaja?od=2026-01-01&do=2026-01-31",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).error).toMatch(/administrator/i);
  });

  it("GET /izvjestaji/prodaja vraća 403 za kupca", async () => {
    const app = Fastify();
    await app.register(registerIzvjestajiRoutes, { prefix: "/api" });
    const token = signAccessToken({ sub: 1, role: "kupac" });
    const res = await app.inject({
      method: "GET",
      url: "/api/izvjestaji/prodaja?od=2026-01-01&do=2026-01-31",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });
});
