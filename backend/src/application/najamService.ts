import type { NajamRowDb } from "../infrastructure/najamRepository.js";
import { BiciklRepository } from "../infrastructure/biciklRepository.js";
import { NajamRepository } from "../infrastructure/najamRepository.js";

function danaUkljucivo(datumPocetka: string, datumZavrsetka: string): number {
  const a = new Date(`${datumPocetka}T12:00:00Z`);
  const b = new Date(`${datumZavrsetka}T12:00:00Z`);
  if (b < a) throw new Error("VALIDATION: datum završetka ne smije biti raniji od početka najma");
  return Math.floor((b.getTime() - a.getTime()) / 86400000) + 1;
}

function withPrikaz(row: NajamRowDb): NajamRowDb & {
  prikaz_statusa: "AKTIVAN" | "VRACEN" | "KASNJENJE";
} {
  if (row.status_najma === "VRACEN") return { ...row, prikaz_statusa: "VRACEN" };
  const zavr = new Date(`${row.datum_zavrsetka}T23:59:59Z`);
  const kasno = Date.now() > zavr.getTime() + 24 * 3600 * 1000;
  return { ...row, prikaz_statusa: kasno ? "KASNJENJE" : "AKTIVAN" };
}

export class NajamService {
  constructor(
    private readonly repo = new NajamRepository(),
    private readonly biciklRepo = new BiciklRepository(),
  ) {}

  listZaDjelatnika(): Promise<Array<NajamRowDb & { prikaz_statusa: "AKTIVAN" | "VRACEN" | "KASNJENJE" }>> {
    return this.repo.listAll().then((rows) => rows.map(withPrikaz));
  }

  listObavijestiKasnjenje(): Promise<NajamRowDb[]> {
    return this.repo.listKasnjenjeZaObavijest();
  }

  async kreiraj(
    kupacKorisnikId: number,
    body: { jedinica_id: number; datum_pocetka: string; datum_zavrsetka: string },
  ): Promise<NajamRowDb & { prikaz_statusa: "AKTIVAN" | "VRACEN" | "KASNJENJE" }> {
    const jedinicaId = Number(body.jedinica_id);
    const dp = body.datum_pocetka?.trim();
    const dz = body.datum_zavrsetka?.trim();
    if (!Number.isFinite(jedinicaId) || !dp || !dz) {
      throw new Error("VALIDATION: jedinica_id, datum_pocetka i datum_zavrsetka su obavezni");
    }
    const dani = danaUkljucivo(dp, dz);
    const jed = await this.biciklRepo.findJedinicaById(jedinicaId);
    if (!jed) throw new Error("VALIDATION: jedinica ne postoji");
    if (jed.status !== "DOSTUPAN") throw new Error("VALIDATION: jedinica nije dostupna za najam");
    if (!jed.cijena_najma_po_danu || Number(jed.cijena_najma_po_danu) <= 0) {
      throw new Error("VALIDATION: vrsta nema definiranu cijenu najma po danu");
    }
    const overlap = await this.repo.countAktivanOverlap(jedinicaId, dp, dz);
    if (overlap > 0) throw new Error("VALIDATION: u odabranom razdoblju jedinica je već iznajmljena");
    const cijenaPoDanu = Number(jed.cijena_najma_po_danu);
    const ukupno = (dani * cijenaPoDanu).toFixed(2);
    const nid = await this.repo.insert({
      datum_pocetka: dp,
      datum_zavrsetka: dz,
      status_najma: "AKTIVAN",
      ukupna_cijena: ukupno,
      jedinica_id: jedinicaId,
      djelatnik_korisnik_id: null,
      kupac_korisnik_id: kupacKorisnikId,
    });
    await this.biciklRepo.setJedinicaStatus(jedinicaId, "IZNAJMLJEN");
    const row = await this.repo.findById(nid);
    if (!row) throw new Error("INTERNAL: najam nije učitan");
    return withPrikaz(row);
  }

  async oznaciVraceno(najamId: number): Promise<(NajamRowDb & { prikaz_statusa: "AKTIVAN" | "VRACEN" | "KASNJENJE" }) | null> {
    const existing = await this.repo.findById(najamId);
    if (!existing) return null;
    const ok = await this.repo.setVracen(najamId);
    if (!ok) return null;
    await this.biciklRepo.setJedinicaStatus(existing.jedinica_id, "DOSTUPAN");
    const row = await this.repo.findById(najamId);
    return row ? withPrikaz(row) : null;
  }
}
