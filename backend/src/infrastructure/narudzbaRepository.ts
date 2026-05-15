import type { NarudzbaDetaljRow, NarudzbaListRow, StavkaNarudzbeRow } from "../domain/narudzba.js";
import { pool } from "./pool.js";

export type JedinicaZaStavkuRow = {
  jedinica_id: number;
  bicikl_id: number;
  cijena: string;
  naziv: string;
  status: string;
};

export class NarudzbaRepository {
  async findAll(limit = 50): Promise<NarudzbaListRow[]> {
    const res = await pool.query<NarudzbaListRow>(
      `SELECT n.narudzba_id,
              n.datum::text AS datum,
              n.status,
              n.adresa_dostave,
              n.nacin_placanja,
              n.prodaja_obradena,
              n.kupac_korisnik_id,
              n.djelatnik_korisnik_id,
              k.ime AS kupac_ime,
              k.prezime AS kupac_prezime,
              kd.ime AS djelatnik_ime,
              kd.prezime AS djelatnik_prezime
       FROM narudzba n
       JOIN kupac ku ON ku.korisnik_id = n.kupac_korisnik_id
       JOIN korisnik k ON k.korisnik_id = ku.korisnik_id
       LEFT JOIN djelatnik dj ON dj.korisnik_id = n.djelatnik_korisnik_id
       LEFT JOIN korisnik kd ON kd.korisnik_id = dj.korisnik_id
       ORDER BY n.datum DESC
       LIMIT $1`,
      [limit],
    );
    return res.rows;
  }

  async findAllZaKupca(kupacKorisnikId: number, limit = 50): Promise<NarudzbaListRow[]> {
    const res = await pool.query<NarudzbaListRow>(
      `SELECT n.narudzba_id,
              n.datum::text AS datum,
              n.status,
              n.adresa_dostave,
              n.nacin_placanja,
              n.prodaja_obradena,
              n.kupac_korisnik_id,
              n.djelatnik_korisnik_id,
              k.ime AS kupac_ime,
              k.prezime AS kupac_prezime,
              kd.ime AS djelatnik_ime,
              kd.prezime AS djelatnik_prezime
       FROM narudzba n
       JOIN kupac ku ON ku.korisnik_id = n.kupac_korisnik_id
       JOIN korisnik k ON k.korisnik_id = ku.korisnik_id
       LEFT JOIN djelatnik dj ON dj.korisnik_id = n.djelatnik_korisnik_id
       LEFT JOIN korisnik kd ON kd.korisnik_id = dj.korisnik_id
       WHERE n.kupac_korisnik_id = $1
       ORDER BY n.datum DESC
       LIMIT $2`,
      [kupacKorisnikId, limit],
    );
    return res.rows;
  }

  async findByIdWithStavke(id: number): Promise<NarudzbaDetaljRow | null> {
    type Head = {
      narudzba_id: number;
      datum: string;
      status: string;
      adresa_dostave: string;
      nacin_placanja: string;
      prodaja_obradena: boolean;
      kupac_korisnik_id: number;
      djelatnik_korisnik_id: number | null;
      kupac_ime: string;
      kupac_prezime: string;
      djelatnik_ime: string | null;
      djelatnik_prezime: string | null;
    };
    const head = await pool.query<Head>(
      `SELECT n.narudzba_id,
              n.datum::text AS datum,
              n.status,
              n.adresa_dostave,
              n.nacin_placanja,
              n.prodaja_obradena,
              n.kupac_korisnik_id,
              n.djelatnik_korisnik_id,
              k.ime AS kupac_ime,
              k.prezime AS kupac_prezime,
              d.ime AS djelatnik_ime,
              d.prezime AS djelatnik_prezime
       FROM narudzba n
       JOIN kupac ku ON ku.korisnik_id = n.kupac_korisnik_id
       JOIN korisnik k ON k.korisnik_id = ku.korisnik_id
       LEFT JOIN djelatnik dj ON dj.korisnik_id = n.djelatnik_korisnik_id
       LEFT JOIN korisnik d ON d.korisnik_id = dj.korisnik_id
       WHERE n.narudzba_id = $1`,
      [id],
    );
    const h = head.rows[0];
    if (!h) return null;

    const st = await pool.query<StavkaNarudzbeRow>(
      `SELECT sn.stavka_id,
              sn.kolicina,
              sn.cijena::text AS cijena,
              sn.jedinica_id,
              sn.narudzba_id,
              b.naziv AS bicikl_naziv,
              j.inventarni_broj AS bicikl_inventarni_broj
       FROM stavkanarudzbe sn
       JOIN bicikl_jedinica j ON j.jedinica_id = sn.jedinica_id
       JOIN bicikl b ON b.bicikl_id = j.bicikl_id
       WHERE sn.narudzba_id = $1
       ORDER BY sn.stavka_id`,
      [id],
    );

    return { ...h, stavke: st.rows };
  }

  async insertNarudzba(
    status: string,
    kupacKorisnikId: number,
    djelatnikKorisnikId: number | null,
    adresaDostave: string,
    nacinPlacanja: string,
  ): Promise<number> {
    const res = await pool.query<{ narudzba_id: number }>(
      `INSERT INTO narudzba (status, kupac_korisnik_id, djelatnik_korisnik_id, adresa_dostave, nacin_placanja)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING narudzba_id`,
      [status, kupacKorisnikId, djelatnikKorisnikId, adresaDostave, nacinPlacanja],
    );
    return res.rows[0]!.narudzba_id;
  }

  
  async insertKupnjaNarudzbaSaStavkom(params: {
    kupacKorisnikId: number;
    adresaDostave: string;
    nacinPlacanja: string;
    biciklVrstaId: number;
    kolicina: number;
  }): Promise<number> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const vr = await client.query<{ cijena: string }>(
        `SELECT cijena::text AS cijena FROM bicikl WHERE bicikl_id = $1 FOR UPDATE`,
        [params.biciklVrstaId],
      );
      const vrsta = vr.rows[0];
      if (!vrsta) {
        throw new Error("VALIDATION: vrsta bicikla ne postoji");
      }
      const jr = await client.query<{ jedinica_id: number }>(
        `SELECT j.jedinica_id
         FROM bicikl_jedinica j
         WHERE j.bicikl_id = $1 AND j.status = 'DOSTUPAN'
         ORDER BY j.jedinica_id
         FOR UPDATE
         LIMIT $2`,
        [params.biciklVrstaId, params.kolicina],
      );
      if (jr.rows.length < params.kolicina) {
        throw new Error("VALIDATION: nema dovoljno dostupnih jedinica ove vrste");
      }
      const nr = await client.query<{ narudzba_id: number }>(
        `INSERT INTO narudzba (status, kupac_korisnik_id, djelatnik_korisnik_id, adresa_dostave, nacin_placanja)
         VALUES ('NOVA', $1, NULL, $2, $3)
         RETURNING narudzba_id`,
        [params.kupacKorisnikId, params.adresaDostave, params.nacinPlacanja],
      );
      const nid = nr.rows[0]!.narudzba_id;
      for (const row of jr.rows) {
        await client.query(
          `INSERT INTO stavkanarudzbe (kolicina, cijena, jedinica_id, narudzba_id)
           VALUES (1, $1, $2, $3)`,
          [vrsta.cijena, row.jedinica_id, nid],
        );
        await client.query(`UPDATE bicikl_jedinica SET status = 'PRODAN' WHERE jedinica_id = $1`, [
          row.jedinica_id,
        ]);
      }
      await client.query("COMMIT");
      return nid;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  /**
   * Ažuriranje zaglavlja; prvi prijelaz u POTVRDJENA (potvrda), ZAVRSENA ili U_OBRADI u istoj transakciji
   * primjenjuje prodaju (zaliha + status jedinice) i postavlja prodaja_obradena + datum_zavrsetka za izvještaj.
   */
  async updateNarudzba(
    id: number,
    patch: {
      status?: string;
      djelatnik_korisnik_id?: number | null;
      adresa_dostave?: string;
      nacin_placanja?: string;
    },
  ): Promise<boolean> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const cur = await client.query<{ status: string; prodaja_obradena: boolean }>(
        `SELECT status, prodaja_obradena FROM narudzba WHERE narudzba_id = $1 FOR UPDATE`,
        [id],
      );
      if (cur.rows.length === 0) {
        await client.query("ROLLBACK");
        return false;
      }
      const oldStatus = cur.rows[0]!.status;
      const newStatus = patch.status !== undefined ? patch.status : oldStatus;
      const becomesZavrsena = newStatus === "ZAVRSENA" && oldStatus !== "ZAVRSENA";
      const becomesUObradi = newStatus === "U_OBRADI" && oldStatus !== "U_OBRADI";
      const becomesPotvrdena = newStatus === "POTVRDJENA" && oldStatus !== "POTVRDJENA";
      const prodajaVecObavljena = cur.rows[0]!.prodaja_obradena;
      const primjeniProdajuPrviPut =
        (becomesZavrsena || becomesUObradi || becomesPotvrdena) && !prodajaVecObavljena;
      const becomesOtkazana =
        newStatus === "OTKAZANA" && oldStatus !== "OTKAZANA" && !cur.rows[0]!.prodaja_obradena;

      if (becomesOtkazana) {
        const lines = await client.query<{ jedinica_id: number }>(
          `SELECT jedinica_id FROM stavkanarudzbe WHERE narudzba_id = $1`,
          [id],
        );
        for (const ln of lines.rows) {
          await client.query(`UPDATE bicikl_jedinica SET status = 'DOSTUPAN' WHERE jedinica_id = $1`, [
            ln.jedinica_id,
          ]);
        }
      }

      if (primjeniProdajuPrviPut) {
        const lines = await client.query<{ jedinica_id: number; kolicina: number }>(
          `SELECT jedinica_id, kolicina FROM stavkanarudzbe WHERE narudzba_id = $1`,
          [id],
        );
        if (lines.rowCount === 0) {
          await client.query("ROLLBACK");
          throw new Error("VALIDATION: narudžba mora imati barem jednu stavku prije potvrde (knjiženja prodaje)");
        }
        for (const ln of lines.rows) {
          await client.query(`UPDATE bicikl_jedinica SET status = 'PRODAN' WHERE jedinica_id = $1`, [
            ln.jedinica_id,
          ]);
        }
      }

      const parts: string[] = [];
      const vals: unknown[] = [];
      let i = 1;
      if (patch.status !== undefined) {
        parts.push(`status = $${i++}`);
        vals.push(patch.status);
      }
      if (patch.djelatnik_korisnik_id !== undefined) {
        parts.push(`djelatnik_korisnik_id = $${i++}`);
        vals.push(patch.djelatnik_korisnik_id);
      }
      if (patch.adresa_dostave !== undefined) {
        parts.push(`adresa_dostave = $${i++}`);
        vals.push(patch.adresa_dostave);
      }
      if (patch.nacin_placanja !== undefined) {
        parts.push(`nacin_placanja = $${i++}`);
        vals.push(patch.nacin_placanja);
      }
      if (primjeniProdajuPrviPut) {
        parts.push(`prodaja_obradena = TRUE`);
        parts.push(`datum_zavrsetka = CURRENT_TIMESTAMP`);
      }
      if (parts.length === 0) {
        await client.query("COMMIT");
        return true;
      }
      vals.push(id);
      await client.query(`UPDATE narudzba SET ${parts.join(", ")} WHERE narudzba_id = $${i}`, vals);
      await client.query("COMMIT");
      return true;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  async getJedinicaZaStavku(jedinicaId: number): Promise<JedinicaZaStavkuRow | null> {
    const res = await pool.query<JedinicaZaStavkuRow>(
      `SELECT j.jedinica_id,
              j.bicikl_id,
              b.cijena::text AS cijena,
              b.naziv,
              j.status
       FROM bicikl_jedinica j
       JOIN bicikl b ON b.bicikl_id = j.bicikl_id
       WHERE j.jedinica_id = $1`,
      [jedinicaId],
    );
    return res.rows[0] ?? null;
  }

  async sumKolicinaZaJedinicuUNarudzbi(
    narudzbaId: number,
    jedinicaId: number,
    excludeStavkaId?: number,
  ): Promise<number> {
    const res = await pool.query<{ s: string }>(
      `SELECT COALESCE(SUM(kolicina), 0)::text AS s
       FROM stavkanarudzbe
       WHERE narudzba_id = $1 AND jedinica_id = $2
         AND ($3::int IS NULL OR stavka_id <> $3::int)`,
      [narudzbaId, jedinicaId, excludeStavkaId ?? null],
    );
    return Number(res.rows[0]?.s ?? 0);
  }

  async insertStavka(
    narudzbaId: number,
    jedinicaId: number,
    kolicina: number,
    cijena: string,
  ): Promise<StavkaNarudzbeRow> {
    const res = await pool.query<StavkaNarudzbeRow>(
      `INSERT INTO stavkanarudzbe AS sn (kolicina, cijena, jedinica_id, narudzba_id)
       VALUES ($1, $2, $3, $4)
       RETURNING sn.stavka_id,
                 sn.kolicina,
                 sn.cijena::text AS cijena,
                 sn.jedinica_id,
                 sn.narudzba_id,
                 (SELECT b.naziv FROM bicikl_jedinica j JOIN bicikl b ON b.bicikl_id = j.bicikl_id WHERE j.jedinica_id = sn.jedinica_id) AS bicikl_naziv,
                 (SELECT j.inventarni_broj FROM bicikl_jedinica j WHERE j.jedinica_id = sn.jedinica_id) AS bicikl_inventarni_broj`,
      [kolicina, cijena, jedinicaId, narudzbaId],
    );
    return res.rows[0]!;
  }

  async updateStavka(
    stavkaId: number,
    narudzbaId: number,
    jedinicaId: number,
    kolicina: number,
    cijena: string,
  ): Promise<StavkaNarudzbeRow | null> {
    const res = await pool.query<StavkaNarudzbeRow>(
      `UPDATE stavkanarudzbe AS sn
       SET jedinica_id = $3, kolicina = $4, cijena = $5
       WHERE sn.stavka_id = $1 AND sn.narudzba_id = $2
       RETURNING sn.stavka_id,
                 sn.kolicina,
                 sn.cijena::text AS cijena,
                 sn.jedinica_id,
                 sn.narudzba_id,
                 (SELECT b.naziv FROM bicikl_jedinica j JOIN bicikl b ON b.bicikl_id = j.bicikl_id WHERE j.jedinica_id = sn.jedinica_id) AS bicikl_naziv,
                 (SELECT j.inventarni_broj FROM bicikl_jedinica j WHERE j.jedinica_id = sn.jedinica_id) AS bicikl_inventarni_broj`,
      [stavkaId, narudzbaId, jedinicaId, kolicina, cijena],
    );
    return res.rows[0] ?? null;
  }

  async deleteStavka(stavkaId: number, narudzbaId: number): Promise<boolean> {
    const res = await pool.query(
      `DELETE FROM stavkanarudzbe WHERE stavka_id = $1 AND narudzba_id = $2`,
      [stavkaId, narudzbaId],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async getStavka(stavkaId: number, narudzbaId: number): Promise<{ jedinica_id: number; kolicina: number } | null> {
    const res = await pool.query<{ jedinica_id: number; kolicina: number }>(
      `SELECT jedinica_id, kolicina FROM stavkanarudzbe WHERE stavka_id = $1 AND narudzba_id = $2`,
      [stavkaId, narudzbaId],
    );
    return res.rows[0] ?? null;
  }

  async setJedinicaStatus(jedinicaId: number, status: string): Promise<void> {
    await pool.query(`UPDATE bicikl_jedinica SET status = $1 WHERE jedinica_id = $2`, [status, jedinicaId]);
  }
}
