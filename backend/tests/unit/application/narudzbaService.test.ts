import { describe, expect, it, vi } from "vitest";
import type { NarudzbaDetaljRow, NarudzbaListRow } from "../../../src/domain/narudzba.js";
import type { NarudzbaRepository } from "../../../src/infrastructure/narudzbaRepository.js";
import { NarudzbaService } from "../../../src/application/narudzbaService.js";

function mkDetalj(over: Partial<NarudzbaDetaljRow> = {}): NarudzbaDetaljRow {
  return {
    narudzba_id: 1,
    datum: "2026-01-01",
    status: "NOVA",
    adresa_dostave: "Zagreb",
    nacin_placanja: "POUZEĆE",
    prodaja_obradena: false,
    kupac_korisnik_id: 7,
    djelatnik_korisnik_id: null,
    kupac_ime: "Ana",
    kupac_prezime: "Anić",
    djelatnik_ime: null,
    djelatnik_prezime: null,
    stavke: [],
    ...over,
  };
}

describe("NarudzbaService", () => {
  it("create baca VALIDATION kad status nedostaje", async () => {
    const repo = {
      insertNarudzba: vi.fn(),
      findByIdWithStavke: vi.fn(),
    } as unknown as NarudzbaRepository;
    const s = new NarudzbaService(repo);
    await expect(
      s.create(
        {
          status: "   ",
          kupac_korisnik_id: 1,
          adresa_dostave: "A",
          nacin_placanja: "POUZEĆE",
        },
        { korisnik_id: 99, role: "djelatnik" },
      ),
    ).rejects.toThrow(/status/);
    expect(repo.insertNarudzba).not.toHaveBeenCalled();
  });

  it("create poziva insert i vraća DTO detalja", async () => {
    const full = mkDetalj({ narudzba_id: 55 });
    const insertNarudzba = vi.fn().mockResolvedValue(55);
    const findByIdWithStavke = vi.fn().mockResolvedValue(full);
    const repo = { insertNarudzba, findByIdWithStavke } as unknown as NarudzbaRepository;
    const s = new NarudzbaService(repo);
    const r = await s.create(
      {
        status: "NOVA",
        kupac_korisnik_id: 7,
        djelatnik_korisnik_id: null,
        adresa_dostave: "Zagreb",
        nacin_placanja: "POUZEĆE",
      },
      { korisnik_id: 1, role: "djelatnik" },
    );
    expect(insertNarudzba).toHaveBeenCalledWith("NOVA", 7, null, "Zagreb", "POUZEĆE");
    expect(r.narudzba_id).toBe(55);
    expect(r.stavke).toEqual([]);
  });

  it("list za kupca koristi findAllZaKupca", async () => {
    const row: NarudzbaListRow = {
      narudzba_id: 1,
      datum: "d",
      status: "NOVA",
      adresa_dostave: "A",
      nacin_placanja: "POUZEĆE",
      prodaja_obradena: false,
      kupac_korisnik_id: 7,
      djelatnik_korisnik_id: null,
      kupac_ime: "A",
      kupac_prezime: "B",
      djelatnik_ime: null,
      djelatnik_prezime: null,
    };
    const findAllZaKupca = vi.fn().mockResolvedValue([row]);
    const findAll = vi.fn();
    const repo = { findAllZaKupca, findAll } as unknown as NarudzbaRepository;
    const s = new NarudzbaService(repo);
    const list = await s.list({ korisnik_id: 7, role: "kupac" }, 10);
    expect(findAllZaKupca).toHaveBeenCalledWith(7, 10);
    expect(findAll).not.toHaveBeenCalled();
    expect(list).toHaveLength(1);
    expect(list[0]!.narudzba_id).toBe(1);
  });

  it("getById za kupca vraća null kad narudžba nije njegova", async () => {
    const row = mkDetalj({ kupac_korisnik_id: 99 });
    const repo = { findByIdWithStavke: vi.fn().mockResolvedValue(row) } as unknown as NarudzbaRepository;
    const s = new NarudzbaService(repo);
    const r = await s.getById(1, { korisnik_id: 7, role: "kupac" });
    expect(r).toBeNull();
  });

  it("getById za djelatnika vraća narudžbu", async () => {
    const row = mkDetalj({ kupac_korisnik_id: 99 });
    const repo = { findByIdWithStavke: vi.fn().mockResolvedValue(row) } as unknown as NarudzbaRepository;
    const s = new NarudzbaService(repo);
    const r = await s.getById(1, { korisnik_id: 1, role: "djelatnik" });
    expect(r?.narudzba_id).toBe(1);
  });

  it("addStavka odbija djelatnika", async () => {
    const row = mkDetalj();
    const repo = {
      findByIdWithStavke: vi.fn().mockResolvedValue(row),
      insertStavka: vi.fn(),
    } as unknown as NarudzbaRepository;
    const s = new NarudzbaService(repo);
    await expect(
      s.addStavka(1, { jedinica_id: 1, kolicina: 1 }, { korisnik_id: 2, role: "djelatnik" }),
    ).rejects.toThrow(/djelatnik ne smije mijenjati stavke/);
  });

  it("addStavka odbija kupca (samo pregled)", async () => {
    const row = mkDetalj();
    const repo = { findByIdWithStavke: vi.fn().mockResolvedValue(row), insertStavka: vi.fn() } as unknown as NarudzbaRepository;
    const s = new NarudzbaService(repo);
    await expect(
      s.addStavka(1, { jedinica_id: 1, kolicina: 1 }, { korisnik_id: 7, role: "kupac" }),
    ).rejects.toThrow(/pregled/i);
    expect(repo.insertStavka).not.toHaveBeenCalled();
  });

  it("update: djelatnik potvrđuje NOVA → POTVRDJENA i postavlja djelatnik_korisnik_id", async () => {
    const row = mkDetalj();
    const nakon = mkDetalj({
      status: "POTVRDJENA",
      djelatnik_korisnik_id: 3,
      djelatnik_ime: "Marko",
      djelatnik_prezime: "Marić",
    });
    const findByIdWithStavke = vi.fn().mockResolvedValueOnce(row).mockResolvedValueOnce(nakon);
    const updateNarudzba = vi.fn().mockResolvedValue(true);
    const repo = { findByIdWithStavke, updateNarudzba } as unknown as NarudzbaRepository;
    const s = new NarudzbaService(repo);
    const r = await s.update(1, { status: "POTVRDJENA" }, { korisnik_id: 3, role: "djelatnik" });
    expect(updateNarudzba).toHaveBeenCalledWith(1, { status: "POTVRDJENA", djelatnik_korisnik_id: 3 });
    expect(r?.status).toBe("POTVRDJENA");
    expect(r?.djelatnik_korisnik_id).toBe(3);
  });

  it("update: djelatnik ne smije ZAVRSENA iz Nove", async () => {
    const row = mkDetalj();
    const repo = { findByIdWithStavke: vi.fn().mockResolvedValue(row), updateNarudzba: vi.fn() } as unknown as NarudzbaRepository;
    const s = new NarudzbaService(repo);
    await expect(
      s.update(1, { status: "ZAVRSENA" }, { korisnik_id: 1, role: "djelatnik" }),
    ).rejects.toThrow(/Potvrđena/);
    expect(repo.updateNarudzba).not.toHaveBeenCalled();
  });

  it("update: djelatnik ne smije mijenjati adresu", async () => {
    const row = mkDetalj();
    const repo = { findByIdWithStavke: vi.fn().mockResolvedValue(row), updateNarudzba: vi.fn() } as unknown as NarudzbaRepository;
    const s = new NarudzbaService(repo);
    await expect(
      s.update(1, { status: "POTVRDJENA", adresa_dostave: "X" }, { korisnik_id: 1, role: "djelatnik" }),
    ).rejects.toThrow(/potvrditi/);
    expect(repo.updateNarudzba).not.toHaveBeenCalled();
  });

  it("update zaglavlja odbija kupca", async () => {
    const row = mkDetalj();
    const repo = { findByIdWithStavke: vi.fn().mockResolvedValue(row), updateNarudzba: vi.fn() } as unknown as NarudzbaRepository;
    const s = new NarudzbaService(repo);
    await expect(
      s.update(1, { adresa_dostave: "Nova" }, { korisnik_id: 7, role: "kupac" }),
    ).rejects.toThrow(/samo pregled/);
    expect(repo.updateNarudzba).not.toHaveBeenCalled();
  });
});
