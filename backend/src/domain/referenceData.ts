/** Read-only redci za padajuće liste u UI-ju (Faza C). */

export type KupacOption = {
  korisnik_id: number;
  ime: string;
  prezime: string;
};

export type DjelatnikOption = {
  korisnik_id: number;
  ime: string;
  prezime: string;
};

export type BiciklOption = {
  jedinica_id: number;
  bicikl_id: number;
  inventarni_broj: string;
  naziv: string;
  kolicina: number;
  cijena: string;
  cijena_najma_po_danu: string | null;
};
