/** Kanonski statusi bicikla (FZ-06) — usklađeno s CHECK u bazi. */
export const BICIKL_STATUSI = [
  "DOSTUPAN",
  "IZNAJMLJEN",
  "PRODAN",
  "U_SERVISU",
  "NEDOSTUPAN",
] as const;

export type BiciklStatusKod = (typeof BICIKL_STATUSI)[number];

export function isBiciklStatus(s: string): s is BiciklStatusKod {
  return (BICIKL_STATUSI as readonly string[]).includes(s);
}

export function assertBiciklStatus(s: string): BiciklStatusKod {
  if (!isBiciklStatus(s)) {
    throw new Error(`VALIDATION: status bicikla mora biti: ${BICIKL_STATUSI.join(", ")}`);
  }
  return s;
}

export const NACINI_PLACANJA = ["KARTICA", "POUZEĆE", "TRANSAKCIJSKI_RACUN"] as const;
export type NacinPlacanja = (typeof NACINI_PLACANJA)[number];

export function assertNacinPlacanja(s: string): NacinPlacanja {
  const t = s.trim();
  if (!(NACINI_PLACANJA as readonly string[]).includes(t)) {
    throw new Error(`VALIDATION: način plaćanja: ${NACINI_PLACANJA.join(", ")}`);
  }
  return t as NacinPlacanja;
}
