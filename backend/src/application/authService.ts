import bcrypt from "bcrypt";
import type { UserRole } from "../domain/userRole.js";
import { signAccessToken } from "../lib/jwt.js";
import { KorisnikRepository } from "../infrastructure/korisnikRepository.js";

const BCRYPT_ROUNDS = 10;

export class AuthService {
  constructor(private readonly repo = new KorisnikRepository()) {}

  async register(body: {
    ime: string;
    prezime: string;
    email: string;
    lozinka: string;
  }): Promise<{ token: string; korisnik_id: number; role: "kupac" }> {
    const ime = body.ime?.trim();
    const prezime = body.prezime?.trim();
    const email = body.email?.trim();
    const lozinka = body.lozinka ?? "";
    if (!ime || !prezime || !email) throw new Error("VALIDATION: ime, prezime i email su obavezni");
    if (lozinka.length < 8) throw new Error("VALIDATION: lozinka mora imati najmanje 8 znakova");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("VALIDATION: nevaljan format e-maila");
    }
    if (await this.repo.emailExists(email)) {
      throw new Error("VALIDATION: e-mail je već registriran");
    }
    const hash = await bcrypt.hash(lozinka, BCRYPT_ROUNDS);
    const kid = await this.repo.insertKorisnik(ime, prezime, email, hash);
    await this.repo.insertKupac(kid);
    const token = signAccessToken({ sub: kid, role: "kupac" });
    return { token, korisnik_id: kid, role: "kupac" };
  }

  async login(body: { email: string; lozinka: string }): Promise<{
    token: string;
    korisnik_id: number;
    role: UserRole;
  }> {
    const email = body.email?.trim();
    const lozinka = body.lozinka ?? "";
    if (!email || !lozinka) throw new Error("VALIDATION: email i lozinka su obavezni");
    const row = await this.repo.findByEmailForAuth(email);
    if (!row) throw new Error("VALIDATION: neispravan e-mail ili lozinka");
    const ok = await bcrypt.compare(lozinka, row.lozinka);
    if (!ok) throw new Error("VALIDATION: neispravan e-mail ili lozinka");
    const token = signAccessToken({ sub: row.korisnik_id, role: row.uloga });
    return { token, korisnik_id: row.korisnik_id, role: row.uloga };
  }

  async me(korisnikId: number, role: UserRole): Promise<{
    korisnik_id: number;
    role: UserRole;
    ime: string;
    prezime: string;
    email: string;
  } | null> {
    const p = await this.repo.findProfil(korisnikId);
    if (!p) return null;
    return { korisnik_id: korisnikId, role, ...p };
  }
}
