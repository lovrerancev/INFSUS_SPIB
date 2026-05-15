/** Redak stavke iz baze (repozitorij) */
export type StavkaNarudzbeRow = {
  stavka_id: number;
  kolicina: number;
  cijena: string;
  jedinica_id: number;
  narudzba_id: number;
  bicikl_naziv: string | null;
  bicikl_inventarni_broj: string | null;
};


export type NarudzbaListRow = {
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

export type NarudzbaDetaljRow = NarudzbaListRow & {
  stavke: StavkaNarudzbeRow[];
};
