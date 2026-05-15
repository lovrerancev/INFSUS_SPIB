import { pool } from "./pool.js";

export type NajamRowDb = {
  najam_id: number;
  datum_pocetka: string;
  datum_zavrsetka: string;
  status_najma: string;
  ukupna_cijena: string;
  jedinica_id: number;
  bicikl_naziv: string | null;
  kupac_korisnik_id: number;
  kupac_ime: string | null;
  kupac_prezime: string | null;
};

export class NajamRepository {
  async insert(row: {
    datum_pocetka: string;
    datum_zavrsetka: string;
    status_najma: string;
    ukupna_cijena: string;
    jedinica_id: number;
    djelatnik_korisnik_id: number | null;
    kupac_korisnik_id: number;
  }): Promise<number> {
    const res = await pool.query<{ najam_id: number }>(
      `INSERT INTO najam (datum_pocetka, datum_zavrsetka, status_najma, ukupna_cijena, jedinica_id, djelatnik_korisnik_id, kupac_korisnik_id)
       VALUES ($1::date, $2::date, $3, $4, $5, $6, $7)
       RETURNING najam_id`,
      [
        row.datum_pocetka,
        row.datum_zavrsetka,
        row.status_najma,
        row.ukupna_cijena,
        row.jedinica_id,
        row.djelatnik_korisnik_id,
        row.kupac_korisnik_id,
      ],
    );
    return res.rows[0]!.najam_id;
  }

  async listAll(): Promise<NajamRowDb[]> {
    const res = await pool.query<NajamRowDb>(
      `SELECT n.najam_id,
              n.datum_pocetka::text AS datum_pocetka,
              n.datum_zavrsetka::text AS datum_zavrsetka,
              n.status_najma,
              n.ukupna_cijena::text AS ukupna_cijena,
              n.jedinica_id,
              b.naziv AS bicikl_naziv,
              n.kupac_korisnik_id,
              k.ime AS kupac_ime,
              k.prezime AS kupac_prezime
       FROM najam n
       JOIN bicikl_jedinica j ON j.jedinica_id = n.jedinica_id
       JOIN bicikl b ON b.bicikl_id = j.bicikl_id
       JOIN kupac ku ON ku.korisnik_id = n.kupac_korisnik_id
       JOIN korisnik k ON k.korisnik_id = ku.korisnik_id
       ORDER BY n.datum_pocetka DESC`,
    );
    return res.rows;
  }

  async findById(id: number): Promise<NajamRowDb | null> {
    const res = await pool.query<NajamRowDb>(
      `SELECT n.najam_id,
              n.datum_pocetka::text AS datum_pocetka,
              n.datum_zavrsetka::text AS datum_zavrsetka,
              n.status_najma,
              n.ukupna_cijena::text AS ukupna_cijena,
              n.jedinica_id,
              b.naziv AS bicikl_naziv,
              n.kupac_korisnik_id,
              k.ime AS kupac_ime,
              k.prezime AS kupac_prezime
       FROM najam n
       JOIN bicikl_jedinica j ON j.jedinica_id = n.jedinica_id
       JOIN bicikl b ON b.bicikl_id = j.bicikl_id
       JOIN kupac ku ON ku.korisnik_id = n.kupac_korisnik_id
       JOIN korisnik k ON k.korisnik_id = ku.korisnik_id
       WHERE n.najam_id = $1`,
      [id],
    );
    return res.rows[0] ?? null;
  }

  async countAktivanOverlap(jedinicaId: number, od: string, doDat: string, excludeNajamId?: number): Promise<number> {
    const res = await pool.query<{ c: string }>(
      `SELECT count(*)::text AS c
       FROM najam
       WHERE jedinica_id = $1
         AND status_najma = 'AKTIVAN'
         AND ($4::int IS NULL OR najam_id <> $4::int)
         AND daterange(datum_pocetka, datum_zavrsetka, '[]') && daterange($2::date, $3::date, '[]')`,
      [jedinicaId, od, doDat, excludeNajamId ?? null],
    );
    return Number(res.rows[0]?.c ?? 0);
  }

  async setVracen(najamId: number): Promise<boolean> {
    const res = await pool.query(
      `UPDATE najam SET status_najma = 'VRACEN' WHERE najam_id = $1 AND status_najma = 'AKTIVAN'`,
      [najamId],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async listKasnjenjeZaObavijest(): Promise<NajamRowDb[]> {
    const res = await pool.query<NajamRowDb>(
      `SELECT n.najam_id,
              n.datum_pocetka::text AS datum_pocetka,
              n.datum_zavrsetka::text AS datum_zavrsetka,
              n.status_najma,
              n.ukupna_cijena::text AS ukupna_cijena,
              n.jedinica_id,
              b.naziv AS bicikl_naziv,
              n.kupac_korisnik_id,
              k.ime AS kupac_ime,
              k.prezime AS kupac_prezime
       FROM najam n
       JOIN bicikl_jedinica j ON j.jedinica_id = n.jedinica_id
       JOIN bicikl b ON b.bicikl_id = j.bicikl_id
       JOIN kupac ku ON ku.korisnik_id = n.kupac_korisnik_id
       JOIN korisnik k ON k.korisnik_id = ku.korisnik_id
       WHERE n.status_najma = 'AKTIVAN'
         AND (n.datum_zavrsetka::timestamp + interval '24 hours') < CURRENT_TIMESTAMP
       ORDER BY n.datum_zavrsetka`,
    );
    return res.rows;
  }
}
