import { describe, expect, it, vi } from "vitest";
import type { BiciklRepository } from "../../../src/infrastructure/biciklRepository.js";
import type { KategorijaRepository } from "../../../src/infrastructure/kategorijaRepository.js";
import { KategorijaService } from "../../../src/application/kategorijaService.js";

function makeService(deps: {
  repo?: Partial<KategorijaRepository>;
  bicikl?: Partial<BiciklRepository>;
}) {
  const repo = {
    findAll: vi.fn(),
    findById: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    deleteById: vi.fn(),
    countBicikli: vi.fn(),
    listBiciklIdsZaKategoriju: vi.fn(),
    ...deps.repo,
  } as unknown as KategorijaRepository;
  const biciklRepo = {
    deleteVrstaCascade: vi.fn(),
    ...deps.bicikl,
  } as unknown as BiciklRepository;
  return new KategorijaService(repo, biciklRepo);
}

describe("KategorijaService", () => {
  it("create baca VALIDATION kad je naziv prazan", async () => {
    const s = makeService({});
    await expect(s.create({ naziv: "   " })).rejects.toThrow(/^VALIDATION:/);
  });

  it("create poziva repozitorij s trimiranim nazivom", async () => {
    const insert = vi.fn().mockResolvedValue({ kategorija_id: 5, naziv: "MTB", opis: null });
    const s = makeService({ repo: { insert } });
    const r = await s.create({ naziv: "  MTB  ", opis: "op" });
    expect(insert).toHaveBeenCalledWith({ naziv: "MTB", opis: "op" });
    expect(r.kategorija_id).toBe(5);
  });

  it("delete vraća HAS_BICIKLI kad postoje bicikli i nema force", async () => {
    const findById = vi.fn().mockResolvedValue({ kategorija_id: 1, naziv: "A", opis: null });
    const countBicikli = vi.fn().mockResolvedValue(2);
    const s = makeService({ repo: { findById, countBicikli } });
    const r = await s.delete(1);
    expect(r).toEqual({ ok: false, reason: "HAS_BICIKLI" });
  });

  it("delete s force briše bicikle kaskadno pa kategoriju", async () => {
    const findById = vi.fn().mockResolvedValue({ kategorija_id: 1, naziv: "A", opis: null });
    const countBicikli = vi.fn().mockResolvedValue(1);
    const listBiciklIdsZaKategoriju = vi.fn().mockResolvedValue([10, 11]);
    const deleteById = vi.fn().mockResolvedValue(undefined);
    const deleteVrstaCascade = vi.fn().mockResolvedValue(undefined);
    const s = makeService({
      repo: { findById, countBicikli, listBiciklIdsZaKategoriju, deleteById },
      bicikl: { deleteVrstaCascade },
    });
    const r = await s.delete(1, { force: true });
    expect(r).toEqual({ ok: true });
    expect(deleteVrstaCascade).toHaveBeenNthCalledWith(1, 10);
    expect(deleteVrstaCascade).toHaveBeenNthCalledWith(2, 11);
    expect(deleteById).toHaveBeenCalledWith(1);
  });
});
