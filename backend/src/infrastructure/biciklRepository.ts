import { pool } from "./pool.js";


export type BiciklRow = {
  bicikl_id: number;
  inventarni_broj: string;
  naziv: string;
  cijena: string;
  kolicina: number;
  status: string;
  kategorija_id: number;
  kategorija_naziv: string | null;
  cijena_najma_po_danu: string | null;
};


export type BiciklJedinicaRow = {
  jedinica_id: number;
  bicikl_id: number;
  inventarni_broj: string;
  status: string;
  naziv: string;
  cijena: string;
  cijena_najma_po_danu: string | null;
};

export type BiciklKatalogFilter = {
  q?: string;
  kategorija_id?: number;
  cijena_od?: number;
  cijena_do?: number;
  samo_dostupni?: boolean;
};

export type JediniceKatalogFilter = {
  bicikl_id?: number;
  samo_dostupni?: boolean;
};

function defaultInventarni(jedinicaId: number): string {
  return `JB-${String(jedinicaId).padStart(6, "0")}`;
}

export class BiciklRepository {
  
  async findKatalog(f: BiciklKatalogFilter): Promise<BiciklRow[]> {
    const cond: string[] = ["1=1"];
    const vals: unknown[] = [];
    let i = 1;
    if (f.q?.trim()) {
      cond.push(
        `(b.naziv ILIKE $${i} OR EXISTS (
            SELECT 1 FROM bicikl_jedinica ji WHERE ji.bicikl_id = b.bicikl_id AND ji.inventarni_broj ILIKE $${i}
          ))`,
      );
      vals.push(`%${f.q.trim()}%`);
      i++;
    }
    if (f.kategorija_id !== undefined && Number.isFinite(f.kategorija_id)) {
      cond.push(`b.kategorija_id = $${i++}`);
      vals.push(f.kategorija_id);
    }
    if (f.cijena_od !== undefined && Number.isFinite(f.cijena_od)) {
      cond.push(`b.cijena >= $${i++}`);
      vals.push(f.cijena_od);
    }
    if (f.cijena_do !== undefined && Number.isFinite(f.cijena_do)) {
      cond.push(`b.cijena <= $${i++}`);
      vals.push(f.cijena_do);
    }
    if (f.samo_dostupni) {
      cond.push(
        `EXISTS (SELECT 1 FROM bicikl_jedinica jd WHERE jd.bicikl_id = b.bicikl_id AND jd.status = 'DOSTUPAN')`,
      );
    }
    const res = await pool.query<BiciklRow>(
      `SELECT b.bicikl_id,
              ''::text AS inventarni_broj,
              b.naziv,
              b.cijena::text AS cijena,
              COALESCE(COUNT(j.jedinica_id) FILTER (WHERE j.status = 'DOSTUPAN'), 0)::int AS kolicina,
              CASE
                WHEN COUNT(j.jedinica_id) FILTER (WHERE j.status = 'DOSTUPAN') > 0 THEN 'DOSTUPAN'
                ELSE 'NEDOSTUPAN'
              END AS status,
              b.kategorija_id,
              kb.naziv AS kategorija_naziv,
              b.cijena_najma_po_danu::text AS cijena_najma_po_danu
       FROM bicikl b
       JOIN kategorijabicikla kb ON kb.kategorija_id = b.kategorija_id
       LEFT JOIN bicikl_jedinica j ON j.bicikl_id = b.bicikl_id
       WHERE ${cond.join(" AND ")}
       GROUP BY b.bicikl_id, b.naziv, b.cijena, b.kategorija_id, kb.naziv, b.cijena_najma_po_danu
       ORDER BY b.naziv, b.bicikl_id`,
      vals,
    );
    return res.rows;
  }

  /** Pojedinačne jedinice (najam, detalj admina). */
  async findJediniceKatalog(f: JediniceKatalogFilter): Promise<BiciklJedinicaRow[]> {
    const cond: string[] = ["1=1"];
    const vals: unknown[] = [];
    let i = 1;
    if (f.bicikl_id !== undefined && Number.isFinite(f.bicikl_id)) {
      cond.push(`j.bicikl_id = $${i++}`);
      vals.push(f.bicikl_id);
    }
    if (f.samo_dostupni) {
      cond.push(`j.status = 'DOSTUPAN'`);
    }
    const res = await pool.query<BiciklJedinicaRow>(
      `SELECT j.jedinica_id,
              j.bicikl_id,
              j.inventarni_broj,
              j.status,
              b.naziv,
              b.cijena::text AS cijena,
              b.cijena_najma_po_danu::text AS cijena_najma_po_danu
       FROM bicikl_jedinica j
       JOIN bicikl b ON b.bicikl_id = j.bicikl_id
       WHERE ${cond.join(" AND ")}
       ORDER BY j.inventarni_broj`,
      vals,
    );
    return res.rows;
  }

 
  async findKatalogRowForVrsta(id: number): Promise<BiciklRow | null> {
    const rows = await this.findKatalog({});
    return rows.find((r) => r.bicikl_id === id) ?? null;
  }

  async findJedinicaById(jedinicaId: number): Promise<BiciklJedinicaRow | null> {
    const res = await pool.query<BiciklJedinicaRow>(
      `SELECT j.jedinica_id,
              j.bicikl_id,
              j.inventarni_broj,
              j.status,
              b.naziv,
              b.cijena::text AS cijena,
              b.cijena_najma_po_danu::text AS cijena_najma_po_danu
       FROM bicikl_jedinica j
       JOIN bicikl b ON b.bicikl_id = j.bicikl_id
       WHERE j.jedinica_id = $1`,
      [jedinicaId],
    );
    return res.rows[0] ?? null;
  }

  async countInventarniJedinica(inventarni: string, excludeJedinicaId: number | null): Promise<number> {
    const res = await pool.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM bicikl_jedinica
       WHERE inventarni_broj = $1 AND ($2::int IS NULL OR jedinica_id <> $2::int)`,
      [inventarni, excludeJedinicaId],
    );
    return Number(res.rows[0]?.c ?? 0);
  }

  async insertVrsta(row: {
    naziv: string;
    cijena: string;
    kategorija_id: number;
    cijena_najma_po_danu: string | null;
  }): Promise<number> {
    const res = await pool.query<{ bicikl_id: number }>(
      `INSERT INTO bicikl (naziv, cijena, kategorija_id, cijena_najma_po_danu)
       VALUES ($1, $2, $3, $4)
       RETURNING bicikl_id`,
      [row.naziv, row.cijena, row.kategorija_id, row.cijena_najma_po_danu],
    );
    return res.rows[0]!.bicikl_id;
  }

  async updateVrsta(
    id: number,
    row: { naziv: string; cijena: string; kategorija_id: number; cijena_najma_po_danu: string | null },
  ): Promise<boolean> {
    const res = await pool.query(
      `UPDATE bicikl
       SET naziv = $1, cijena = $2, kategorija_id = $3, cijena_najma_po_danu = $4
       WHERE bicikl_id = $5`,
      [row.naziv, row.cijena, row.kategorija_id, row.cijena_najma_po_danu, id],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async insertJedinica(biciklId: number, inventarni_broj: string | null, status: string): Promise<number> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const useProvided = inventarni_broj != null && inventarni_broj.trim() !== "";
      const tmpInv = useProvided
        ? inventarni_broj.trim()
        : `T${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const res = await client.query<{ jedinica_id: number }>(
        `INSERT INTO bicikl_jedinica (bicikl_id, inventarni_broj, status)
         VALUES ($1, $2, $3)
         RETURNING jedinica_id`,
        [biciklId, tmpInv, status],
      );
      const jid = res.rows[0]!.jedinica_id;
      if (!useProvided) {
        await client.query(`UPDATE bicikl_jedinica SET inventarni_broj = $2 WHERE jedinica_id = $1`, [
          jid,
          defaultInventarni(jid),
        ]);
      }
      await client.query("COMMIT");
      return jid;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  async updateJedinica(
    jedinicaId: number,
    row: { inventarni_broj: string; status: string },
  ): Promise<boolean> {
    const res = await pool.query(
      `UPDATE bicikl_jedinica SET inventarni_broj = $1, status = $2 WHERE jedinica_id = $3`,
      [row.inventarni_broj, row.status, jedinicaId],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async deleteVrsta(id: number): Promise<boolean> {
    const res = await pool.query(`DELETE FROM bicikl WHERE bicikl_id = $1`, [id]);
    return (res.rowCount ?? 0) > 0;
  }

  async deleteJedinica(jedinicaId: number): Promise<boolean> {
    const res = await pool.query(`DELETE FROM bicikl_jedinica WHERE jedinica_id = $1`, [jedinicaId]);
    return (res.rowCount ?? 0) > 0;
  }

  /**
   * Briše jedinicu zajedno s povezanim stavkama narudžbe, najmovima i zapisima plaćanja najma.
   * Koristi se samo uz eksplicitni „force“ u admin API-ju.
   */
  async deleteJedinicaCascade(jedinicaId: number): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `DELETE FROM placanje p
         WHERE p.placanje_id IN (
           SELECT pn.placanje_id FROM placanjenajma pn
           INNER JOIN najam n ON n.najam_id = pn.najam_id
           WHERE n.jedinica_id = $1
         )`,
        [jedinicaId],
      );
      await client.query(`DELETE FROM najam WHERE jedinica_id = $1`, [jedinicaId]);
      await client.query(`DELETE FROM stavkanarudzbe WHERE jedinica_id = $1`, [jedinicaId]);
      await client.query(`DELETE FROM bicikl_jedinica WHERE jedinica_id = $1`, [jedinicaId]);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  /** Briše sve jedinice vrste (kaskadno) pa red vrste u bicikl. */
  async deleteVrstaCascade(vrstaId: number): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const jres = await client.query<{ jedinica_id: number }>(
        `SELECT jedinica_id FROM bicikl_jedinica WHERE bicikl_id = $1 ORDER BY jedinica_id`,
        [vrstaId],
      );
      for (const row of jres.rows) {
        await client.query(
          `DELETE FROM placanje p
           WHERE p.placanje_id IN (
             SELECT pn.placanje_id FROM placanjenajma pn
             INNER JOIN najam n ON n.najam_id = pn.najam_id
             WHERE n.jedinica_id = $1
           )`,
          [row.jedinica_id],
        );
        await client.query(`DELETE FROM najam WHERE jedinica_id = $1`, [row.jedinica_id]);
        await client.query(`DELETE FROM stavkanarudzbe WHERE jedinica_id = $1`, [row.jedinica_id]);
        await client.query(`DELETE FROM bicikl_jedinica WHERE jedinica_id = $1`, [row.jedinica_id]);
      }
      await client.query(`DELETE FROM bicikl WHERE bicikl_id = $1`, [vrstaId]);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  async countStavkeJedinica(jedinicaId: number): Promise<number> {
    const r = await pool.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM stavkanarudzbe WHERE jedinica_id = $1`,
      [jedinicaId],
    );
    return Number(r.rows[0]?.c ?? 0);
  }

  async countNajmoviJedinica(jedinicaId: number): Promise<number> {
    const r = await pool.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM najam WHERE jedinica_id = $1`,
      [jedinicaId],
    );
    return Number(r.rows[0]?.c ?? 0);
  }

  async countJedinicaZaVrstu(biciklId: number): Promise<number> {
    const r = await pool.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM bicikl_jedinica WHERE bicikl_id = $1`,
      [biciklId],
    );
    return Number(r.rows[0]?.c ?? 0);
  }

  async setJedinicaStatus(jedinicaId: number, status: string): Promise<void> {
    await pool.query(`UPDATE bicikl_jedinica SET status = $1 WHERE jedinica_id = $2`, [status, jedinicaId]);
  }

}
