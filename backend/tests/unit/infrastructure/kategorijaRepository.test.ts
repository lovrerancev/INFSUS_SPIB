import { beforeEach, describe, expect, it, vi } from "vitest";
import { pool } from "../../../src/infrastructure/pool.js";

vi.mock("../../../src/infrastructure/pool.js", () => ({
  pool: {
    query: vi.fn(),
  },
}));

import { KategorijaRepository } from "../../../src/infrastructure/kategorijaRepository.js";

describe("KategorijaRepository", () => {
  beforeEach(() => {
    vi.mocked(pool.query).mockReset();
  });

  it("findAll šalje null za pretragu kad parametar nije zadan", async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [] } as never);
    const repo = new KategorijaRepository();
    await repo.findAll();
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("kategorijabicikla"), [null]);
  });

  it("findAll trimira tekst pretrage", async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [] } as never);
    const repo = new KategorijaRepository();
    await repo.findAll("  grad  ");
    expect(pool.query).toHaveBeenCalledWith(expect.any(String), ["grad"]);
  });

  it("findById vraća null kad nema retka", async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [] } as never);
    const repo = new KategorijaRepository();
    const r = await repo.findById(42);
    expect(r).toBeNull();
  });

  it("insert vraća kategoriju iz RETURNING", async () => {
    const row = { kategorija_id: 3, naziv: "Gravel", opis: null };
    vi.mocked(pool.query).mockResolvedValue({ rows: [row] } as never);
    const repo = new KategorijaRepository();
    const r = await repo.insert({ naziv: "Gravel", opis: null });
    expect(r).toEqual(row);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO kategorijabicikla"),
      ["Gravel", null],
    );
  });
});
