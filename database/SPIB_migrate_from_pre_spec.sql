
ALTER TABLE narudzba ADD COLUMN IF NOT EXISTS adresa_dostave VARCHAR(500) NOT NULL DEFAULT '';
ALTER TABLE narudzba ADD COLUMN IF NOT EXISTS nacin_placanja VARCHAR(30) NOT NULL DEFAULT 'POUZEĆE';
ALTER TABLE narudzba ADD COLUMN IF NOT EXISTS prodaja_obradena BOOLEAN NOT NULL DEFAULT FALSE;


ALTER TABLE bicikl DROP COLUMN IF EXISTS url_slike;
ALTER TABLE bicikl ADD COLUMN IF NOT EXISTS cijena_najma_po_danu DECIMAL(10,2);


ALTER TABLE bicikl ADD COLUMN IF NOT EXISTS inventarni_broj VARCHAR(64);
UPDATE bicikl SET inventarni_broj = 'JB-' || lpad(bicikl_id::text, 6, '0') WHERE inventarni_broj IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_bicikl_inventarni_broj ON bicikl (inventarni_broj);
ALTER TABLE bicikl ALTER COLUMN inventarni_broj SET NOT NULL;


UPDATE bicikl
SET cijena_najma_po_danu = ROUND((cijena * 0.05)::numeric, 2)
WHERE cijena_najma_po_danu IS NULL
  AND status = 'DOSTUPAN'
  AND kolicina > 0;


ALTER TABLE najam ADD COLUMN IF NOT EXISTS ukupna_cijena DECIMAL(10,2) NOT NULL DEFAULT 0;

UPDATE najam SET ukupna_cijena = 0 WHERE ukupna_cijena IS NULL;


UPDATE bicikl SET naziv = 'City One 28"' WHERE naziv = 'City One 28" (rezerva)';
UPDATE bicikl SET naziv = 'Trail X 29"' WHERE naziv = 'Trail X 29" (servis)';


UPDATE korisnik
SET lozinka = '$2b$10$YOsmUNorzlfMXi2mSfg.mOe5Mik0Ngq5EftaJ.GFsr9IADpFSzf2e'
WHERE lozinka IN ('demo', 'demo ');
