import type { Kategorija, KategorijaUpsert } from "../domain/kategorija.js";
import { BiciklRepository } from "../infrastructure/biciklRepository.js";
import { KategorijaRepository } from "../infrastructure/kategorijaRepository.js";

export class KategorijaService {
  constructor(
    private readonly repo = new KategorijaRepository(),
    private readonly biciklRepo = new BiciklRepository(),
  ) {}

  list(search?: string): Promise<Kategorija[]> {
    return this.repo.findAll(search);
  }

  async getById(id: number): Promise<Kategorija | null> {
    return this.repo.findById(id);
  }

  async create(body: KategorijaUpsert): Promise<Kategorija> {
    const naziv = body.naziv?.trim();
    if (!naziv) {
      throw new Error("VALIDATION: naziv je obavezan");
    }
    return this.repo.insert({ naziv, opis: body.opis });
  }

  async update(id: number, body: KategorijaUpsert): Promise<Kategorija | null> {
    const naziv = body.naziv?.trim();
    if (!naziv) {
      throw new Error("VALIDATION: naziv je obavezan");
    }
    return this.repo.update(id, { naziv, opis: body.opis });
  }

  async delete(
    id: number,
    opts?: { force?: boolean },
  ): Promise<{ ok: true } | { ok: false; reason: "NOT_FOUND" | "HAS_BICIKLI" }> {
    const existing = await this.repo.findById(id);
    if (!existing) return { ok: false, reason: "NOT_FOUND" };
    const n = await this.repo.countBicikli(id);
    if (n > 0 && !opts?.force) return { ok: false, reason: "HAS_BICIKLI" };
    if (opts?.force && n > 0) {
      const ids = await this.repo.listBiciklIdsZaKategoriju(id);
      for (const bid of ids) {
        await this.biciklRepo.deleteVrstaCascade(bid);
      }
    }
    await this.repo.deleteById(id);
    return { ok: true };
  }
}
