import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { KategorijaService } from "../../../src/application/kategorijaService.js";
import { registerKategorijeRoutes } from "../../../src/presentation/kategorijeRoutes.js";

describe("registerKategorijeRoutes", () => {
  const mockList = vi.fn();
  const mockGetById = vi.fn();
  const mockCreate = vi.fn();
  const mockUpdate = vi.fn();
  const mockDelete = vi.fn();

  beforeEach(() => {
    mockList.mockReset();
    mockGetById.mockReset();
    mockCreate.mockReset();
    mockUpdate.mockReset();
    mockDelete.mockReset();
  });

  function service(): KategorijaService {
    return {
      list: mockList,
      getById: mockGetById,
      create: mockCreate,
      update: mockUpdate,
      delete: mockDelete,
    } as unknown as KategorijaService;
  }

  async function buildApp() {
    const app = Fastify();
    await app.register(
      async (f) => {
        await registerKategorijeRoutes(f, { service: service() });
      },
      { prefix: "/api" },
    );
    return app;
  }

  it("GET /kategorije delegira na service.list", async () => {
    mockList.mockResolvedValue([{ kategorija_id: 1, naziv: "A", opis: null }]);
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/kategorije" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toEqual([{ kategorija_id: 1, naziv: "A", opis: null }]);
    expect(mockList).toHaveBeenCalledWith(undefined);
  });

  it("GET /kategorije/:id vraća 404 kad kategorija ne postoji", async () => {
    mockGetById.mockResolvedValue(null);
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/kategorije/404" });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).error).toBeTruthy();
  });

  it("POST /kategorije vraća 400 na VALIDATION iz servisa", async () => {
    mockCreate.mockRejectedValue(new Error("VALIDATION: naziv je obavezan"));
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/kategorije",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ naziv: "" }),
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/naziv/i);
  });
});
