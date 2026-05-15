import type { Kategorija, KategorijaUpsert } from "../domain/kategorija.js";
import { pool } from "./pool.js";

export class KategorijaRepository {
  async findAll(search?: string): Promise<Kategorija[]> {
    const q = search?.trim();
    const res = await pool.query<Kategorija>(
      `SELECT kategorija_id, naziv, opis
       FROM kategorijabicikla
       WHERE ($1::text IS NULL OR naziv ILIKE '%' || $1 || '%')
       ORDER BY naziv`,
      [q || null],
    );
    return res.rows;
  }

  async findById(id: number): Promise<Kategorija | null> {
    const res = await pool.query<Kategorija>(
      `SELECT kategorija_id, naziv, opis FROM kategorijabicikla WHERE kategorija_id = $1`,
      [id],
    );
    return res.rows[0] ?? null;
  }

  async insert(row: KategorijaUpsert): Promise<Kategorija> {
    const res = await pool.query<Kategorija>(
      `INSERT INTO kategorijabicikla (naziv, opis)
       VALUES ($1, $2)
       RETURNING kategorija_id, naziv, opis`,
      [row.naziv.trim(), row.opis ?? null],
    );
    return res.rows[0]!;
  }

  async update(id: number, row: KategorijaUpsert): Promise<Kategorija | null> {
    const res = await pool.query<Kategorija>(
      `UPDATE kategorijabicikla
       SET naziv = $2, opis = $3
       WHERE kategorija_id = $1
       RETURNING kategorija_id, naziv, opis`,
      [id, row.naziv.trim(), row.opis ?? null],
    );
    return res.rows[0] ?? null;
  }

  async deleteById(id: number): Promise<boolean> {
    const res = await pool.query(`DELETE FROM kategorijabicikla WHERE kategorija_id = $1`, [
      id,
    ]);
    return (res.rowCount ?? 0) > 0;
  }

  async countBicikli(kategorijaId: number): Promise<number> {
    const res = await pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM bicikl WHERE kategorija_id = $1`,
      [kategorijaId],
    );
    return Number(res.rows[0]?.c ?? 0);
  }

  async listBiciklIdsZaKategoriju(kategorijaId: number): Promise<number[]> {
    const res = await pool.query<{ bicikl_id: number }>(
      `SELECT bicikl_id FROM bicikl WHERE kategorija_id = $1 ORDER BY bicikl_id`,
      [kategorijaId],
    );
    return res.rows.map((r) => r.bicikl_id);
  }
}
