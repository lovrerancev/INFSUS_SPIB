import type { DatabaseError } from "pg";
import { pool } from "./pool.js";
import type { KorisnikUlogaPrikaz, UserRole } from "../domain/userRole.js";

export type KorisnikAuthRow = {
  korisnik_id: number;
  lozinka: string;
  uloga: UserRole;
};

export type KorisnikAdminListRow = {
  korisnik_id: number;
  ime: string;
  prezime: string;
  email: string;
  uloga: KorisnikUlogaPrikaz;
};

function mapUlogaFromParts(isAdmin: boolean, isDjel: boolean, isKup: boolean): KorisnikUlogaPrikaz {
  if (isAdmin) return "administrator";
  if (isDjel) return "djelatnik";
  if (isKup) return "kupac";
  return "bez_uloge";
}

export class KorisnikRepository {
  async findByEmailForAuth(email: string): Promise<KorisnikAuthRow | null> {
    const res = await pool.query<{
      korisnik_id: number;
      lozinka: string;
      uloga: string;
    }>(
      `SELECT k.korisnik_id,
              k.lozinka,
              CASE
                WHEN a.korisnik_id IS NOT NULL THEN 'administrator'
                WHEN d.korisnik_id IS NOT NULL THEN 'djelatnik'
                ELSE 'kupac'
              END AS uloga
       FROM korisnik k
       LEFT JOIN administrator a ON a.korisnik_id = k.korisnik_id
       LEFT JOIN djelatnik d ON d.korisnik_id = k.korisnik_id
       WHERE lower(k.email) = lower($1)`,
      [email.trim()],
    );
    const row = res.rows[0];
    if (!row) return null;
    const uloga: UserRole =
      row.uloga === "administrator" || row.uloga === "djelatnik" || row.uloga === "kupac"
        ? row.uloga
        : "kupac";
    return {
      korisnik_id: row.korisnik_id,
      lozinka: row.lozinka,
      uloga,
    };
  }

  async insertKorisnik(ime: string, prezime: string, email: string, lozinkaHash: string): Promise<number> {
    const res = await pool.query<{ korisnik_id: number }>(
      `INSERT INTO korisnik (ime, prezime, email, lozinka)
       VALUES ($1, $2, $3, $4)
       RETURNING korisnik_id`,
      [ime, prezime, email.trim().toLowerCase(), lozinkaHash],
    );
    return res.rows[0]!.korisnik_id;
  }

  async insertKupac(korisnikId: number): Promise<void> {
    await pool.query(`INSERT INTO kupac (korisnik_id) VALUES ($1)`, [korisnikId]);
  }

  async emailExists(email: string): Promise<boolean> {
    const res = await pool.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM korisnik WHERE lower(email) = lower($1)`,
      [email.trim()],
    );
    return Number(res.rows[0]?.c ?? 0) > 0;
  }

  async findProfil(korisnikId: number): Promise<{ ime: string; prezime: string; email: string } | null> {
    const res = await pool.query<{ ime: string; prezime: string; email: string }>(
      `SELECT ime, prezime, email FROM korisnik WHERE korisnik_id = $1`,
      [korisnikId],
    );
    return res.rows[0] ?? null;
  }

  async listKorisnikaZaAdmin(): Promise<KorisnikAdminListRow[]> {
    const res = await pool.query<{
      korisnik_id: number;
      ime: string;
      prezime: string;
      email: string;
      is_admin: boolean;
      is_djel: boolean;
      is_kup: boolean;
    }>(
      `SELECT k.korisnik_id,
              k.ime,
              k.prezime,
              k.email,
              (a.korisnik_id IS NOT NULL) AS is_admin,
              (d.korisnik_id IS NOT NULL) AS is_djel,
              (ku.korisnik_id IS NOT NULL) AS is_kup
       FROM korisnik k
       LEFT JOIN administrator a ON a.korisnik_id = k.korisnik_id
       LEFT JOIN djelatnik d ON d.korisnik_id = k.korisnik_id
       LEFT JOIN kupac ku ON ku.korisnik_id = k.korisnik_id
       ORDER BY k.korisnik_id`,
    );
    return res.rows.map((r) => ({
      korisnik_id: r.korisnik_id,
      ime: r.ime,
      prezime: r.prezime,
      email: r.email,
      uloga: mapUlogaFromParts(r.is_admin, r.is_djel, r.is_kup),
    }));
  }

  async isAdministrator(korisnikId: number): Promise<boolean> {
    const res = await pool.query<{ ok: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM administrator WHERE korisnik_id = $1) AS ok`,
      [korisnikId],
    );
    return Boolean(res.rows[0]?.ok);
  }

  async existsDjelatnik(korisnikId: number): Promise<boolean> {
    const res = await pool.query<{ ok: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM djelatnik WHERE korisnik_id = $1) AS ok`,
      [korisnikId],
    );
    return Boolean(res.rows[0]?.ok);
  }

  async existsKorisnik(korisnikId: number): Promise<boolean> {
    const res = await pool.query<{ ok: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM korisnik WHERE korisnik_id = $1) AS ok`,
      [korisnikId],
    );
    return Boolean(res.rows[0]?.ok);
  }

  async insertDjelatnik(korisnikId: number, pozicija: string): Promise<void> {
    await pool.query(`INSERT INTO djelatnik (korisnik_id, pozicija) VALUES ($1, $2)`, [korisnikId, pozicija]);
  }

  async deleteDjelatnik(korisnikId: number): Promise<boolean> {
    const res = await pool.query(`DELETE FROM djelatnik WHERE korisnik_id = $1`, [korisnikId]);
    return (res.rowCount ?? 0) > 0;
  }

  async deleteKorisnikById(korisnikId: number): Promise<void> {
    await pool.query(`DELETE FROM korisnik WHERE korisnik_id = $1`, [korisnikId]);
  }
}

export function isPostgresFkViolation(e: unknown): e is DatabaseError {
  return typeof e === "object" && e !== null && "code" in e && (e as DatabaseError).code === "23503";
}
