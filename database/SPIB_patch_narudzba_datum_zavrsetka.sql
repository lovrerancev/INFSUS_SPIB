
ALTER TABLE narudzba ADD COLUMN IF NOT EXISTS datum_zavrsetka TIMESTAMP NULL;


UPDATE narudzba SET datum_zavrsetka = datum WHERE status = 'ZAVRSENA' AND datum_zavrsetka IS NULL;


UPDATE narudzba SET datum_zavrsetka = datum WHERE status = 'POTVRDJENA' AND prodaja_obradena = TRUE AND datum_zavrsetka IS NULL;
