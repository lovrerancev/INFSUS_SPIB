import { pool } from "./pool.js";

export type ProdajaIzvjestaj = {
  broj_zavrsenih_narudzbi: number;
  ukupni_prihod: string;
  broj_stavki: number;
};

export type NajamIzvjestaj = {
  broj_najmova: number;
  ukupna_naplatena_najma: string;
};

export class IzvjestajiRepository {
  async prodaja(od: string, doDat: string): Promise<ProdajaIzvjestaj> {
    const res = await pool.query<ProdajaIzvjestaj>(
      `SELECT
         count(DISTINCT n.narudzba_id)::int AS broj_zavrsenih_narudzbi,
         COALESCE(SUM(sn.kolicina * sn.cijena), 0)::text AS ukupni_prihod,
         COALESCE(SUM(sn.kolicina), 0)::int AS broj_stavki
       FROM narudzba n
       JOIN stavkanarudzbe sn ON sn.narudzba_id = n.narudzba_id
       WHERE (n.prodaja_obradena = TRUE OR n.status = 'ZAVRSENA')
         AND COALESCE(n.datum_zavrsetka, n.datum)::date >= $1::date
         AND COALESCE(n.datum_zavrsetka, n.datum)::date <= $2::date`,
      [od, doDat],
    );
    return (
      res.rows[0] ?? {
        broj_zavrsenih_narudzbi: 0,
        ukupni_prihod: "0",
        broj_stavki: 0,
      }
    );
  }

  async najam(od: string, doDat: string): Promise<NajamIzvjestaj> {
    const res = await pool.query<NajamIzvjestaj>(
      `SELECT
         count(*)::int AS broj_najmova,
         COALESCE(SUM(n.ukupna_cijena), 0)::text AS ukupna_naplatena_najma
       FROM najam n
       WHERE n.datum_pocetka >= $1::date
         AND n.datum_pocetka <= $2::date`,
      [od, doDat],
    );
    return res.rows[0] ?? { broj_najmova: 0, ukupna_naplatena_najma: "0" };
  }
}
