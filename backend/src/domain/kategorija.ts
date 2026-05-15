export type Kategorija = {
  kategorija_id: number;
  naziv: string;
  opis: string | null;
};

export type KategorijaUpsert = {
  naziv: string;
  opis?: string | null;
};
