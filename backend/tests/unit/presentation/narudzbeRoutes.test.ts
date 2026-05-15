import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NarudzbaService } from "../../../src/application/narudzbaService.js";
import { signAccessToken } from "../../../src/lib/jwt.js";
import { registerNarudzbeRoutes } from "../../../src/presentation/narudzbeRoutes.js";

describe("registerNarudzbeRoutes", () => {
  const mockList = vi.fn();
  const mockGetById = vi.fn();
  const mockCreate = vi.fn();
  const mockUpdate = vi.fn();
  const mockKreirajKupnju = vi.fn();
  const mockAddStavka = vi.fn();
  const mockUpdateStavka = vi.fn();
  const mockRemoveStavka = vi.fn();

  beforeEach(() => {
    mockList.mockReset();
    mockGetById.mockReset();
    mockCreate.mockReset();
    mockUpdate.mockReset();
    mockKreirajKupnju.mockReset();
    mockAddStavka.mockReset();
    mockUpdateStavka.mockReset();
    mockRemoveStavka.mockReset();
  });

  function service(): NarudzbaService {
    return {
      list: mockList,
      getById: mockGetById,
      create: mockCreate,
      update: mockUpdate,
      kreirajKupnju: mockKreirajKupnju,
      addStavka: mockAddStavka,
      updateStavka: mockUpdateStavka,
      removeStavka: mockRemoveStavka,
    } as unknown as NarudzbaService;
  }

  async function buildApp() {
    const app = Fastify();
    await app.register(
      async (f) => {
        await registerNarudzbeRoutes(f, { service: service() });
      },
      { prefix: "/api" },
    );
    return app;
  }

  it("GET /narudzbe bez Bearer tokena vraća 401", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/narudzbe" });
    expect(res.statusCode).toBe(401);
  });

  it("GET /narudzbe s valjanim JWT-om vraća JSON iz servisa", async () => {
    mockList.mockResolvedValue([
      {
        narudzba_id: 1,
        datum: "d",
        status: "NOVA",
        adresa_dostave: "A",
        nacin_placanja: "POUZEĆE",
        kupac_korisnik_id: 1,
        kupac_ime: "I",
        kupac_prezime: "K",
        djelatnik_korisnik_id: null,
      },
    ]);
    const token = signAccessToken({ sub: 1, role: "djelatnik" });
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/narudzbe",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].narudzba_id).toBe(1);
    expect(mockList).toHaveBeenCalled();
  });

  it("GET /narudzbe/statusi ne zahtijeva autentikaciju", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/narudzbe/statusi" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body)).toBe(true);
    expect(body.some((x: { kod: string }) => x.kod === "NOVA")).toBe(true);
  });

  it("POST /narudzbe s JWT-om vraća 403 (kreiranje samo preko POST /kupnja)", async () => {
    const token = signAccessToken({ sub: 1, role: "djelatnik" });
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/narudzbe",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      payload: JSON.stringify({
        status: "NOVA",
        kupac_korisnik_id: 1,
        adresa_dostave: "A",
        nacin_placanja: "POUZEĆE",
      }),
    });
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).error).toMatch(/Kupnja|kupnja/i);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
