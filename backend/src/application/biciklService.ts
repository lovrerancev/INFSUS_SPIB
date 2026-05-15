import { KategorijaRepository } from "../infrastructure/kategorijaRepository.js";
import type { BiciklJedinicaRow, BiciklKatalogFilter, BiciklRow } from "../infrastructure/biciklRepository.js";
import { BiciklRepository } from "../infrastructure/biciklRepository.js";
import { assertBiciklStatus } from "../domain/biciklEnums.js";

export type BiciklDto = BiciklRow;

export class BiciklService {
  constructor(
    private readonly repo = new BiciklRepository(),
    private readonly katRepo = new KategorijaRepository(),
  ) {}

  katalog(f: BiciklKatalogFilter): Promise<BiciklDto[]> {
    return this.repo.findKatalog(f);
  }

  jediniceKatalog(f: { bicikl_id?: number; samo_dostupni?: boolean }): Promise<BiciklJedinicaRow[]> {
    return this.repo.findJediniceKatalog({
      bicikl_id: f.bicikl_id,
      samo_dostupni: f.samo_dostupni ?? false,
    });
  }

  async getJedinica(jedinicaId: number): Promise<BiciklJedinicaRow | null> {
    return this.repo.findJedinicaById(jedinicaId);
  }

  async getById(id: number): Promise<BiciklDto | null> {
    return this.repo.findKatalogRowForVrsta(id);
  }

  private async assertInventarniJedinica(inv: string, excludeJedinicaId: number | null): Promise<void> {
    const t = inv.trim();
    if (t.length === 0) throw new Error("VALIDATION: inventarni broj ne smije biti prazan");
    if (t.length > 64) throw new Error("VALIDATION: inventarni broj predugačak (najviše 64 znaka)");
    const n = await this.repo.countInventarniJedinica(t, excludeJedinicaId);
    if (n > 0) throw new Error("VALIDATION: inventarni broj već postoji (druga skladišna jedinica)");
  }

  /** Nova vrsta (model) u katalogu — bez jedinica; jedinice dodajte posebno. */
  async createVrsta(body: {
    naziv: string;
    cijena: string;
    kategorija_id: number;
    cijena_najma_po_danu?: string | null;
  }): Promise<number> {
    const naziv = body.naziv?.trim();
    if (!naziv) throw new Error("VALIDATION: naziv je obavezan");
    const kid = Number(body.kategorija_id);
    if (!Number.isFinite(kid)) throw new Error("VALIDATION: kategorija_id je obavezan");
    const kat = await this.katRepo.findById(kid);
    if (!kat) throw new Error("VALIDATION: kategorija ne postoji");
    const cijena = String(body.cijena ?? "").trim();
    if (!cijena) throw new Error("VALIDATION: cijena je obavezna");
    const cnd = body.cijena_najma_po_danu?.trim();
    const cijenaNajma = cnd && cnd.length > 0 ? cnd : null;
    return this.repo.insertVrsta({
      naziv,
      cijena,
      kategorija_id: kid,
      cijena_najma_po_danu: cijenaNajma,
    });
  }

  async updateVrsta(
    id: number,
    body: {
      naziv: string;
      cijena: string;
      kategorija_id: number;
      cijena_najma_po_danu?: string | null;
    },
  ): Promise<boolean> {
    const naziv = body.naziv?.trim();
    if (!naziv) throw new Error("VALIDATION: naziv je obavezan");
    const kid = Number(body.kategorija_id);
    if (!Number.isFinite(kid)) throw new Error("VALIDATION: kategorija_id je obavezan");
    const kat = await this.katRepo.findById(kid);
    if (!kat) throw new Error("VALIDATION: kategorija ne postoji");
    const cijena = String(body.cijena ?? "").trim();
    if (!cijena) throw new Error("VALIDATION: cijena je obavezna");
    const cnd = body.cijena_najma_po_danu?.trim();
    const cijenaNajma = cnd && cnd.length > 0 ? cnd : null;
    return this.repo.updateVrsta(id, {
      naziv,
      cijena,
      kategorija_id: kid,
      cijena_najma_po_danu: cijenaNajma,
    });
  }

  async createJedinica(
    vrstaId: number,
    body: { inventarni_broj?: string | null; status?: string },
  ): Promise<number> {
    const v = await this.repo.findKatalogRowForVrsta(vrstaId);
    if (!v) throw new Error("VALIDATION: vrsta bicikla ne postoji");
    const status = assertBiciklStatus(body.status?.trim() || "DOSTUPAN");
    const invRaw = body.inventarni_broj?.trim();
    const inventarni = invRaw && invRaw.length > 0 ? invRaw : null;
    if (inventarni) await this.assertInventarniJedinica(inventarni, null);
    return this.repo.insertJedinica(vrstaId, inventarni, status);
  }

  async updateJedinica(
    jedinicaId: number,
    body: { inventarni_broj: string; status: string },
  ): Promise<boolean> {
    const j = await this.repo.findJedinicaById(jedinicaId);
    if (!j) return false;
    await this.assertInventarniJedinica(body.inventarni_broj, jedinicaId);
    const status = assertBiciklStatus(body.status.trim());
    return this.repo.updateJedinica(jedinicaId, {
      inventarni_broj: body.inventarni_broj.trim(),
      status,
    });
  }

  async removeJedinica(
    jedinicaId: number,
    opts?: { force?: boolean },
  ): Promise<{ ok: true } | { ok: false; reason: "NOT_FOUND" | "IN_USE" }> {
    const j = await this.repo.findJedinicaById(jedinicaId);
    if (!j) return { ok: false, reason: "NOT_FOUND" };
    if (opts?.force) {
      await this.repo.deleteJedinicaCascade(jedinicaId);
      return { ok: true };
    }
    const s = await this.repo.countStavkeJedinica(jedinicaId);
    const n = await this.repo.countNajmoviJedinica(jedinicaId);
    if (s > 0 || n > 0) return { ok: false, reason: "IN_USE" };
    const ok = await this.repo.deleteJedinica(jedinicaId);
    return ok ? { ok: true } : { ok: false, reason: "NOT_FOUND" };
  }

  async removeVrsta(
    id: number,
    opts?: { force?: boolean },
  ): Promise<{ ok: true } | { ok: false; reason: "NOT_FOUND" | "IN_USE" }> {
    const v = await this.repo.findKatalogRowForVrsta(id);
    if (!v) return { ok: false, reason: "NOT_FOUND" };
    if (opts?.force) {
      await this.repo.deleteVrstaCascade(id);
      return { ok: true };
    }
    const jedinice = await this.repo.findJediniceKatalog({ bicikl_id: id });
    for (const j of jedinice) {
      const s = await this.repo.countStavkeJedinica(j.jedinica_id);
      const n = await this.repo.countNajmoviJedinica(j.jedinica_id);
      if (s > 0 || n > 0) return { ok: false, reason: "IN_USE" };
    }
    const ok = await this.repo.deleteVrsta(id);
    return ok ? { ok: true } : { ok: false, reason: "NOT_FOUND" };
  }

 
  async postaviOdabraneNaServis(
    ids: unknown,
  ): Promise<{
    updated: number;
    skipped: number;
    jedinice: { jedinica_id: number; inventarni_broj: string; naziv: string }[];
  }> {
    const raw = Array.isArray(ids) ? ids : [];
    const unique = [...new Set(raw.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))];
    if (unique.length === 0) {
      throw new Error("VALIDATION: odaberite barem jednu jedinicu (jedinica_id)");
    }
    let updated = 0;
    let skipped = 0;
    const jedinice: { jedinica_id: number; inventarni_broj: string; naziv: string }[] = [];
    for (const jid of unique) {
      const b = await this.repo.findJedinicaById(jid);
      if (!b || b.status !== "DOSTUPAN") {
        skipped += 1;
        continue;
      }
      jedinice.push({ jedinica_id: jid, inventarni_broj: b.inventarni_broj, naziv: b.naziv });
      await this.repo.setJedinicaStatus(jid, "U_SERVISU");
      updated += 1;
    }
    if (updated === 0) {
      throw new Error("VALIDATION: nijedna odabrana jedinica nije u statusu DOSTUPAN");
    }
    return { updated, skipped, jedinice };
  }
}
