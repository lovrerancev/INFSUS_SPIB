
export const NARUDZBA_STATUSI = [
  "NOVA",
  "CEKA_ADMIN",
  "NA_DORADI",
  "POTVRDJENA",
  "U_OBRADI",
  "ZAVRSENA",
  "OTKAZANA",
] as const;

export type NarudzbaStatusKod = (typeof NARUDZBA_STATUSI)[number];

const NAZIVI: Record<NarudzbaStatusKod, string> = {
  NOVA: "Nova",
  CEKA_ADMIN: "Čeka odluku administratora",
  NA_DORADI: "Vraćena kupcu na doradu",
  POTVRDJENA: "Potvrđena",
  U_OBRADI: "U obradi",
  ZAVRSENA: "Završena",
  OTKAZANA: "Otkazana",
};

export function isNarudzbaStatus(s: string): s is NarudzbaStatusKod {
  return (NARUDZBA_STATUSI as readonly string[]).includes(s);
}

export function narudzbaStatusNaziv(kod: NarudzbaStatusKod): string {
  return NAZIVI[kod];
}

export function assertNarudzbaStatus(s: string): NarudzbaStatusKod {
  if (!isNarudzbaStatus(s)) {
    throw new Error(
      `VALIDATION: status mora biti jedan od: ${NARUDZBA_STATUSI.join(", ")}`,
    );
  }
  return s;
}

export function listaNarudzbaStatusaZaApi(): { kod: NarudzbaStatusKod; naziv: string }[] {
  return NARUDZBA_STATUSI.map((kod) => ({ kod, naziv: NAZIVI[kod] }));
}

export function assertAdresaDostave(adresa: string): string {
  const t = adresa.trim();
  if (t.length < 15) {
    throw new Error(
      "VALIDATION: adresa mora imati najmanje 15 znakova (ulica, kućni broj i mjesto)",
    );
  }
  if (!/\d/.test(t)) {
    throw new Error("VALIDATION: adresa mora sadržavati kućni broj (barem jednu znamenku)");
  }
  if (t.split(/\s+/).filter(Boolean).length < 3) {
    throw new Error(
      "VALIDATION: adresa mora sadržavati ulicu, broj i mjesto (npr. Ilica 1, Zagreb)",
    );
  }
  if (/^(test|asdf|xxx|\?+)$/i.test(t.replace(/\s/g, ""))) {
    throw new Error("VALIDATION: adresa izgleda neispravno (placeholder tekst)");
  }
  return t;
}
