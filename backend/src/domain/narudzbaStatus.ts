

export const NARUDZBA_STATUSI = [
  "NOVA",
  "POTVRDJENA",
  "U_OBRADI",
  "ZAVRSENA",
  "OTKAZANA",
] as const;

export type NarudzbaStatusKod = (typeof NARUDZBA_STATUSI)[number];

const NAZIVI: Record<NarudzbaStatusKod, string> = {
  NOVA: "Nova",
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
