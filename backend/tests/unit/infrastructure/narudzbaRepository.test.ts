import { beforeEach, describe, expect, it, vi } from "vitest";
import { pool } from "../../../src/infrastructure/pool.js";

vi.mock("../../../src/infrastructure/pool.js", () => ({
  pool: {
    query: vi.fn(),
  },
}));

import { NarudzbaRepository } from "../../../src/infrastructure/narudzbaRepository.js";

describe("NarudzbaRepository", () => {
  beforeEach(() => {
    vi.mocked(pool.query).mockReset();
  });

  it("findAll vraća retke iz pool.query", async () => {
    const rows = [
      {
        narudzba_id: 1,
        datum: "d",
        status: "NOVA",
        adresa_dostave: "A",
        nacin_placanja: "POUZEĆE",
        prodaja_obradena: false,
        kupac_korisnik_id: 1,
        djelatnik_korisnik_id: null,
        kupac_ime: "Iva",
        kupac_prezime: "Ivić",
        djelatnik_ime: null,
        djelatnik_prezime: null,
      },
    ];
    vi.mocked(pool.query).mockResolvedValue({ rows } as never);
    const repo = new NarudzbaRepository();
    const r = await repo.findAll(25);
    expect(r).toEqual(rows);
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("FROM narudzba"), [25]);
  });

  it("findByIdWithStavke spaja zaglavlje i stavke iz dva upita", async () => {
    const head = {
      narudzba_id: 1,
      datum: "d",
      status: "NOVA",
      adresa_dostave: "X",
      nacin_placanja: "POUZEĆE",
      prodaja_obradena: false,
      kupac_korisnik_id: 1,
      djelatnik_korisnik_id: null,
      kupac_ime: "Iva",
      kupac_prezime: "Ivić",
      djelatnik_ime: null,
      djelatnik_prezime: null,
    };
    const stavka = {
      stavka_id: 9,
      kolicina: 1,
      cijena: "100.00",
      jedinica_id: 5,
      narudzba_id: 1,
      bicikl_naziv: "B",
      bicikl_inventarni_broj: "INV-1",
    };
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [head] } as never)
      .mockResolvedValueOnce({ rows: [stavka] } as never);
    const repo = new NarudzbaRepository();
    const r = await repo.findByIdWithStavke(1);
    expect(r).toEqual({ ...head, stavke: [stavka] });
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  it("findByIdWithStavke vraća null kad zaglavlje ne postoji", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);
    const repo = new NarudzbaRepository();
    const r = await repo.findByIdWithStavke(999);
    expect(r).toBeNull();
    expect(pool.query).toHaveBeenCalledTimes(1);
  });
});
