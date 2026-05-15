import type { AuthUser } from "../domain/authTypes.js";
import {
  isPostgresFkViolation,
  KorisnikRepository,
} from "../infrastructure/korisnikRepository.js";

export class AdminService {
  constructor(private readonly repo = new KorisnikRepository()) {}

  async listKorisnika(): Promise<
    Array<{
      korisnik_id: number;
      ime: string;
      prezime: string;
      email: string;
      uloga: string;
    }>
  > {
    return this.repo.listKorisnikaZaAdmin();
  }

  async ukloniKorisnika(auth: AuthUser, korisnikId: number): Promise<void> {
    if (!Number.isFinite(korisnikId) || korisnikId <= 0) {
      throw new Error("VALIDATION: nevaljan korisnik_id");
    }
    if (korisnikId === auth.korisnik_id) {
      throw new Error("VALIDATION: ne možete obrisati vlastiti račun");
    }
    if (await this.repo.isAdministrator(korisnikId)) {
      throw new Error("VALIDATION: brisanje administratora nije dopušteno");
    }
    if (!(await this.repo.existsKorisnik(korisnikId))) {
      throw new Error("VALIDATION: korisnik ne postoji");
    }
    try {
      await this.repo.deleteKorisnikById(korisnikId);
    } catch (e) {
      if (isPostgresFkViolation(e)) {
        throw new Error(
          "VALIDATION: korisnik se ne može obrisati jer postoje povezani podaci (npr. narudžbe ili najmovi)",
        );
      }
      throw e;
    }
  }

  async dodajDjelatnika(auth: AuthUser, korisnikId: number, pozicija: string): Promise<void> {
    void auth;
    if (!Number.isFinite(korisnikId) || korisnikId <= 0) {
      throw new Error("VALIDATION: nevaljan korisnik_id");
    }
    const p = pozicija.trim() || "Djelatnik";
    if (p.length > 50) throw new Error("VALIDATION: pozicija predugačka");
    if (!(await this.repo.existsKorisnik(korisnikId))) {
      throw new Error("VALIDATION: korisnik ne postoji");
    }
    if (await this.repo.isAdministrator(korisnikId)) {
      throw new Error("VALIDATION: administrator se ne registrira kao djelatnik");
    }
    if (await this.repo.existsDjelatnik(korisnikId)) {
      throw new Error("VALIDATION: korisnik je već djelatnik");
    }
    await this.repo.insertDjelatnik(korisnikId, p);
  }

  async ukloniDjelatnika(auth: AuthUser, korisnikId: number): Promise<void> {
    void auth;
    if (!Number.isFinite(korisnikId) || korisnikId <= 0) {
      throw new Error("VALIDATION: nevaljan korisnik_id");
    }
    if (await this.repo.isAdministrator(korisnikId)) {
      throw new Error("VALIDATION: uklanjanje uloge djelatnika administratoru nema smisla");
    }
    const ok = await this.repo.deleteDjelatnik(korisnikId);
    if (!ok) throw new Error("VALIDATION: korisnik nije djelatnik");
  }
}
