/** Kanonski kodovi statusa bicikla (baza) → kratki prikaz u UI-ju. */

export const STATUS_BICIKL_LABEL: Record<string, string> = {
  DOSTUPAN: "Dostupan",
  IZNAJMLJEN: "Iznajmljen",
  PRODAN: "Prodan",
  U_SERVISU: "U servisu",
  NEDOSTUPAN: "Nedostupan",
};

/** Nasumični / stari zapisi u bazi → isti ljudski tekst kao kanonski kod. */
const STATUS_BICIKL_ALIASES: Record<string, string> = {
  SERVIS: "U servisu",
  U_SERVIS: "U servisu",
};

export function statusBicikla(kod: string): string {
  const k = kod.trim().toUpperCase();
  return STATUS_BICIKL_LABEL[k] ?? STATUS_BICIKL_ALIASES[k] ?? kod.trim();
}
