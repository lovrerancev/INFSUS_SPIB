import type {
  NarudzbaCreateDto,
  NarudzbaDetaljDto,
  NarudzbaListDto,
  NarudzbaUpdateDto,
  StavkaCreateDto,
  StavkaNarudzbeDto,
  StavkaUpdateDto,
} from "../domain/narudzbaDto.js";
import type { AuthUser } from "../domain/authTypes.js";
import type { NarudzbaDetaljRow, NarudzbaListRow } from "../domain/narudzba.js";
import { assertNacinPlacanja } from "../domain/biciklEnums.js";
import { assertAdresaDostave, assertNarudzbaStatus } from "../domain/narudzbaStatus.js";
import { NarudzbaRepository } from "../infrastructure/narudzbaRepository.js";

function mapStavka(r: NarudzbaDetaljRow["stavke"][0]): StavkaNarudzbeDto {
  return {
    stavka_id: r.stavka_id,
    kolicina: r.kolicina,
    cijena: r.cijena,
    jedinica_id: r.jedinica_id,
    narudzba_id: r.narudzba_id,
    bicikl_naziv: r.bicikl_naziv,
    bicikl_inventarni_broj: r.bicikl_inventarni_broj,
  };
}

function mapListRow(r: NarudzbaListRow): NarudzbaListDto {
  return {
    narudzba_id: r.narudzba_id,
    datum: r.datum,
    status: r.status,
    adresa_dostave: r.adresa_dostave,
    nacin_placanja: r.nacin_placanja,
    kupac_korisnik_id: r.kupac_korisnik_id,
    kupac_ime: r.kupac_ime,
    kupac_prezime: r.kupac_prezime,
    djelatnik_korisnik_id: r.djelatnik_korisnik_id,
    djelatnik_ime: r.djelatnik_ime ?? null,
    djelatnik_prezime: r.djelatnik_prezime ?? null,
  };
}

function mapDetalj(r: NarudzbaDetaljRow): NarudzbaDetaljDto {
  return {
    ...mapListRow(r),
    stavke: r.stavke.map(mapStavka),
  };
}

export class NarudzbaService {
  constructor(private readonly repo = new NarudzbaRepository()) {}

  private assertNijeAdministrator(auth: AuthUser): void {
    if (auth.role === "administrator") {
      const e = new Error("Administrator nema pristup modulu narudžbi.");
      (e as Error & { statusCode: number }).statusCode = 403;
      throw e;
    }
  }

  private assertNarudzbaPristup(n: NarudzbaDetaljRow, auth: AuthUser): void {
    if (auth.role === "administrator") {
      if (n.status !== "CEKA_ADMIN") {
        throw new Error("VALIDATION: administrator vidi samo narudžbe koje čekaju odluku");
      }
      return;
    }
    if (auth.role === "djelatnik") return;
    if (n.kupac_korisnik_id !== auth.korisnik_id) {
      throw new Error("VALIDATION: nije vaša narudžba");
    }
  }

  private assertMijenjanjeStavkiZabranjeno(auth: AuthUser): never {
    if (auth.role === "kupac") {
      const e = new Error("Kupac ne smije mijenjati stavke narudžbe (samo pregled).");
      (e as Error & { statusCode: number }).statusCode = 403;
      throw e;
    }
    if (auth.role === "djelatnik") {
      throw new Error("VALIDATION: djelatnik ne smije mijenjati stavke narudžbe");
    }
    throw new Error("INTERNAL: mijenjanje stavki nije dopušteno za ovu ulogu");
  }

  async list(auth: AuthUser, limit?: number): Promise<NarudzbaListDto[]> {
    const lim = limit ?? 50;
    if (auth.role === "administrator") {
      const rows = await this.repo.findAllCekaAdmin(lim);
      return rows.map(mapListRow);
    }
    const rows =
      auth.role === "kupac"
        ? await this.repo.findAllZaKupca(auth.korisnik_id, lim)
        : await this.repo.findAll(lim);
    return rows.map(mapListRow);
  }

  private detaljIzRetka(row: NarudzbaDetaljRow): NarudzbaDetaljDto {
    return mapDetalj(row);
  }

  private async detaljNakonPromjene(id: number): Promise<NarudzbaDetaljDto | null> {
    const row = await this.repo.findByIdWithStavke(id);
    return row ? this.detaljIzRetka(row) : null;
  }

  async getById(id: number, auth: AuthUser): Promise<NarudzbaDetaljDto | null> {
    const row = await this.repo.findByIdWithStavke(id);
    if (!row) return null;
    try {
      this.assertNarudzbaPristup(row, auth);
    } catch {
      return null;
    }
    return this.detaljIzRetka(row);
  }

  async create(body: NarudzbaCreateDto, auth: AuthUser): Promise<NarudzbaDetaljDto> {
    this.assertNijeAdministrator(auth);
    const status = body.status?.trim();
    if (!status) throw new Error("VALIDATION: status je obavezan");
    assertNarudzbaStatus(status);
    let kid = Number(body.kupac_korisnik_id);
    if (auth.role === "kupac") {
      kid = auth.korisnik_id;
    } else if (!Number.isFinite(kid)) {
      throw new Error("VALIDATION: kupac_korisnik_id je obavezan za narudžbu u ime kupca");
    }
    const did =
      body.djelatnik_korisnik_id === undefined || body.djelatnik_korisnik_id === null
        ? null
        : Number(body.djelatnik_korisnik_id);
    if (did !== null && !Number.isFinite(did)) {
      throw new Error("VALIDATION: nevaljan djelatnik_korisnik_id");
    }
    const adresa = body.adresa_dostave?.trim();
    if (!adresa) throw new Error("VALIDATION: adresa dostave je obavezna");
    const nacin = assertNacinPlacanja(body.nacin_placanja ?? "");
    const nid = await this.repo.insertNarudzba(status, kid, did, adresa, nacin);
    const full = await this.repo.findByIdWithStavke(nid);
    if (!full) throw new Error("INTERNAL: narudžba nije učitana nakon inserta");
    return mapDetalj(full);
  }

  async kreirajKupnju(
    auth: AuthUser,
    body: { bicikl_id: unknown; kolicina: unknown; adresa_dostave: unknown; nacin_placanja: unknown },
  ): Promise<NarudzbaDetaljDto> {
    this.assertNijeAdministrator(auth);
    if (auth.role !== "kupac") {
      throw new Error("VALIDATION: kupnju može započeti samo kupac");
    }
    const biciklVrstaId = Number(body.bicikl_id);
    const kol = Number(body.kolicina);
    if (!Number.isFinite(biciklVrstaId) || biciklVrstaId <= 0) {
      throw new Error("VALIDATION: nevaljan bicikl_id (vrsta)");
    }
    if (!Number.isFinite(kol) || kol <= 0 || kol !== Math.floor(kol)) {
      throw new Error("VALIDATION: količina mora biti pozitivni cijeli broj");
    }
    const adresa = assertAdresaDostave(String(body.adresa_dostave ?? ""));
    const nacin = assertNacinPlacanja(String(body.nacin_placanja ?? ""));
    const nid = await this.repo.insertKupnjaNarudzbaSaStavkom({
      kupacKorisnikId: auth.korisnik_id,
      adresaDostave: adresa,
      nacinPlacanja: nacin,
      biciklVrstaId,
      kolicina: kol,
    });
    const full = await this.repo.findByIdWithStavke(nid);
    if (!full) throw new Error("INTERNAL: narudžba nije učitana nakon kupnje");
    return mapDetalj(full);
  }

  private async updateZaglavljeDjelatnik(
    id: number,
    cur: NarudzbaDetaljRow,
    body: NarudzbaUpdateDto,
    auth: AuthUser,
  ): Promise<NarudzbaDetaljDto> {
    if (body.adresa_dostave !== undefined || body.nacin_placanja !== undefined) {
      throw new Error(
        "VALIDATION: djelatnik smije samo promijeniti status (potvrda ili eskalacija administratoru)",
      );
    }
    if (body.status === undefined) {
      throw new Error("VALIDATION: pošaljite status POTVRDJENA ili CEKA_ADMIN");
    }
    const noviStatus = assertNarudzbaStatus(body.status.trim());
    if (noviStatus !== "POTVRDJENA" && noviStatus !== "CEKA_ADMIN") {
      throw new Error("VALIDATION: djelatnik smije postaviti samo Potvrđena ili Čeka administratora");
    }
    if (cur.status !== "NOVA") {
      throw new Error(
        "VALIDATION: pregled djelatnika moguć je samo za narudžbu u statusu Nova (ili nakon kupčeve dorade)",
      );
    }
    if (noviStatus === "POTVRDJENA" && cur.status === "POTVRDJENA") {
      return this.detaljIzRetka(cur);
    }
    const patch =
      noviStatus === "POTVRDJENA"
        ? { status: "POTVRDJENA" as const, djelatnik_korisnik_id: auth.korisnik_id }
        : { status: "CEKA_ADMIN" as const, djelatnik_korisnik_id: auth.korisnik_id };
    const ok = await this.repo.updateNarudzba(id, patch);
    if (!ok) throw new Error("INTERNAL: narudžba nije ažurirana");
    const nakon = await this.detaljNakonPromjene(id);
    if (!nakon) throw new Error("INTERNAL: narudžba nije učitana nakon ažuriranja");
    return nakon;
  }

  private async updateZaglavljeKupacIspravak(
    id: number,
    cur: NarudzbaDetaljRow,
    body: NarudzbaUpdateDto,
    auth: AuthUser,
  ): Promise<NarudzbaDetaljDto> {
    if (cur.status !== "NA_DORADI") {
      throw new Error("VALIDATION: ispravak je moguć samo kad je narudžba vraćena na doradu");
    }
    if (body.status !== undefined) {
      throw new Error("VALIDATION: kupac ne postavlja status ručno; status se automatski vraća na Nova");
    }
    const adresa =
      body.adresa_dostave !== undefined
        ? assertAdresaDostave(body.adresa_dostave)
        : assertAdresaDostave(cur.adresa_dostave);
    const nacin =
      body.nacin_placanja !== undefined
        ? assertNacinPlacanja(body.nacin_placanja)
        : assertNacinPlacanja(cur.nacin_placanja);
    const ok = await this.repo.updateNarudzba(id, {
      adresa_dostave: adresa,
      nacin_placanja: nacin,
      status: "NOVA",
    });
    if (!ok) throw new Error("INTERNAL: narudžba nije ažurirana");
    const nakon = await this.detaljNakonPromjene(id);
    if (!nakon) throw new Error("INTERNAL: narudžba nije učitana nakon ispravka");
    return nakon;
  }

  private async updateZaglavljeAdministrator(
    id: number,
    cur: NarudzbaDetaljRow,
    body: NarudzbaUpdateDto,
  ): Promise<NarudzbaDetaljDto> {
    if (cur.status !== "CEKA_ADMIN") {
      throw new Error("VALIDATION: odluka administratora moguća je samo za narudžbe koje čekaju odluku");
    }
    if (body.adresa_dostave !== undefined || body.nacin_placanja !== undefined) {
      throw new Error("VALIDATION: administrator mijenja samo status (otkaz ili vraćanje kupcu)");
    }
    if (body.status === undefined) {
      throw new Error("VALIDATION: pošaljite status OTKAZANA ili NA_DORADI");
    }
    const noviStatus = assertNarudzbaStatus(body.status.trim());
    if (noviStatus !== "OTKAZANA" && noviStatus !== "NA_DORADI") {
      throw new Error("VALIDATION: administrator smije otkazati narudžbu ili vratiti kupcu na doradu");
    }
    const ok = await this.repo.updateNarudzba(id, { status: noviStatus });
    if (!ok) throw new Error("INTERNAL: narudžba nije ažurirana");
    const nakon = await this.detaljNakonPromjene(id);
    if (!nakon) throw new Error("INTERNAL: narudžba nije učitana nakon odluke");
    return nakon;
  }

  async update(id: number, body: NarudzbaUpdateDto, auth: AuthUser): Promise<NarudzbaDetaljDto | null> {
    const cur = await this.repo.findByIdWithStavke(id);
    if (!cur) return null;
    this.assertNarudzbaPristup(cur, auth);

    if (auth.role === "kupac") {
      return await this.updateZaglavljeKupacIspravak(id, cur, body, auth);
    }
    if (auth.role === "djelatnik") {
      return await this.updateZaglavljeDjelatnik(id, cur, body, auth);
    }
    if (auth.role === "administrator") {
      return await this.updateZaglavljeAdministrator(id, cur, body);
    }

    throw new Error("VALIDATION: ažuriranje zaglavlja nije podržano za ovu ulogu");
  }

  async addStavka(narudzbaId: number, _body: StavkaCreateDto, auth: AuthUser): Promise<NarudzbaDetaljDto | null> {
    this.assertNijeAdministrator(auth);
    const nar = await this.repo.findByIdWithStavke(narudzbaId);
    if (!nar) return null;
    this.assertNarudzbaPristup(nar, auth);
    this.assertMijenjanjeStavkiZabranjeno(auth);
  }

  async updateStavka(
    narudzbaId: number,
    _stavkaId: number,
    _body: StavkaUpdateDto,
    auth: AuthUser,
  ): Promise<NarudzbaDetaljDto | null> {
    this.assertNijeAdministrator(auth);
    const nar = await this.repo.findByIdWithStavke(narudzbaId);
    if (!nar) return null;
    this.assertNarudzbaPristup(nar, auth);
    this.assertMijenjanjeStavkiZabranjeno(auth);
  }

  async removeStavka(narudzbaId: number, _stavkaId: number, auth: AuthUser): Promise<NarudzbaDetaljDto | null> {
    this.assertNijeAdministrator(auth);
    const nar = await this.repo.findByIdWithStavke(narudzbaId);
    if (!nar) return null;
    this.assertNarudzbaPristup(nar, auth);
    this.assertMijenjanjeStavkiZabranjeno(auth);
  }
}
