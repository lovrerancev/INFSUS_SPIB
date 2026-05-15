
export type StavkaNarudzbeDto = {
  stavka_id: number;
  kolicina: number;

  cijena: string;
  jedinica_id: number;
  narudzba_id: number;
  bicikl_naziv: string | null;
  bicikl_inventarni_broj: string | null;
};


export type NarudzbaListDto = {
  narudzba_id: number;
  datum: string;
  status: string;
  adresa_dostave: string;
  nacin_placanja: string;
  kupac_korisnik_id: number;
  kupac_ime: string;
  kupac_prezime: string;
  djelatnik_korisnik_id: number | null;
  djelatnik_ime: string | null;
  djelatnik_prezime: string | null;
};


export type NarudzbaDetaljDto = NarudzbaListDto & {
  stavke: StavkaNarudzbeDto[];
};


export type NarudzbaCreateDto = {
  status: string;
  kupac_korisnik_id: number;
  djelatnik_korisnik_id?: number | null;
  adresa_dostave: string;
  nacin_placanja: string;
};


export type NarudzbaUpdateDto = {
  status?: string;
  djelatnik_korisnik_id?: number | null;
  adresa_dostave?: string;
  nacin_placanja?: string;
};


export type StavkaCreateDto = {
  jedinica_id: number;
  kolicina: number;
};

/** Ulaz: izmjena stavke */
export type StavkaUpdateDto = {
  jedinica_id?: number;
  kolicina?: number;
};
