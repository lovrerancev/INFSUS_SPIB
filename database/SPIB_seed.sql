-- =============================================================================
-- SPIB – ogledni podaci (nakon SPIB_schema.sql)
-- bicikl = vrsta; bicikl_jedinica = pojedinačne jedinice
-- =============================================================================

INSERT INTO Korisnik (ime, prezime, email, lozinka) VALUES
    ('Iva', 'Ivić', 'iva.narucitelj@spi.local', '$2b$10$YOsmUNorzlfMXi2mSfg.mOe5Mik0Ngq5EftaJ.GFsr9IADpFSzf2e'),
    ('Marko', 'Marković', 'marko.narucitelj@spi.local', '$2b$10$YOsmUNorzlfMXi2mSfg.mOe5Mik0Ngq5EftaJ.GFsr9IADpFSzf2e'),
    ('Petra', 'Horvat', 'petra.djelatnik@spi.local', '$2b$10$YOsmUNorzlfMXi2mSfg.mOe5Mik0Ngq5EftaJ.GFsr9IADpFSzf2e'),
    ('Admin', 'Sustava', 'admin@spi.local', '$2b$10$YOsmUNorzlfMXi2mSfg.mOe5Mik0Ngq5EftaJ.GFsr9IADpFSzf2e');

INSERT INTO Kupac (korisnik_id)
SELECT korisnik_id FROM Korisnik WHERE email = 'iva.narucitelj@spi.local'
UNION ALL
SELECT korisnik_id FROM Korisnik WHERE email = 'marko.narucitelj@spi.local';

INSERT INTO Djelatnik (korisnik_id, pozicija)
SELECT korisnik_id, 'Prodavač' FROM Korisnik WHERE email = 'petra.djelatnik@spi.local';

INSERT INTO Administrator (korisnik_id)
SELECT korisnik_id FROM Korisnik WHERE email = 'admin@spi.local';

INSERT INTO KategorijaBicikla (naziv, opis) VALUES
    ('Gradski', 'Bicikli za gradsku vožnju i pendanje.'),
    ('MTB', 'Brdski / trail bicikli.'),
    ('Cestovni', 'Dugi relaji i tempo vožnja.'),
    ('Dječji', 'Manji okviri i prilagođena oprema.'),
    ('Električni', 'E-bike kategorija.');

INSERT INTO Bicikl (naziv, cijena, kategorija_id, cijena_najma_po_danu) VALUES
    ('City One 28"', 420.00, (SELECT kategorija_id FROM KategorijaBicikla WHERE naziv = 'Gradski'), 18.00),
    ('Urban Lite', 310.50, (SELECT kategorija_id FROM KategorijaBicikla WHERE naziv = 'Gradski'), 15.00),
    ('Trail X 29"', 890.00, (SELECT kategorija_id FROM KategorijaBicikla WHERE naziv = 'MTB'), 35.00),
    ('RockRide Comp', 1250.00, (SELECT kategorija_id FROM KategorijaBicikla WHERE naziv = 'MTB'), 45.00),
    ('Aero Sprint', 2100.00, (SELECT kategorija_id FROM KategorijaBicikla WHERE naziv = 'Cestovni'), 55.00),
    ('Kid 20"', 180.00, (SELECT kategorija_id FROM KategorijaBicikla WHERE naziv = 'Dječji'), 12.00),
    ('E-City Pro', 1650.00, (SELECT kategorija_id FROM KategorijaBicikla WHERE naziv = 'Električni'), 40.00),
    ('E-MTB Lite', 1980.00, (SELECT kategorija_id FROM KategorijaBicikla WHERE naziv = 'Električni'), 48.00);

INSERT INTO bicikl_jedinica (bicikl_id, inventarni_broj, status)
SELECT b.bicikl_id, 'TMP-C' || gs::text, 'DOSTUPAN'
FROM Bicikl b, generate_series(1, 5) gs WHERE b.naziv = 'City One 28"';
INSERT INTO bicikl_jedinica (bicikl_id, inventarni_broj, status)
SELECT b.bicikl_id, 'TMP-CX', 'NEDOSTUPAN' FROM Bicikl b WHERE b.naziv = 'City One 28"';

INSERT INTO bicikl_jedinica (bicikl_id, inventarni_broj, status)
SELECT b.bicikl_id, 'TMP-U' || gs::text, 'DOSTUPAN'
FROM Bicikl b, generate_series(1, 3) gs WHERE b.naziv = 'Urban Lite';

INSERT INTO bicikl_jedinica (bicikl_id, inventarni_broj, status)
SELECT b.bicikl_id, 'TMP-T' || gs::text, CASE WHEN gs <= 2 THEN 'DOSTUPAN' ELSE 'U_SERVISU' END
FROM Bicikl b, generate_series(1, 3) gs WHERE b.naziv = 'Trail X 29"';

INSERT INTO bicikl_jedinica (bicikl_id, inventarni_broj, status)
SELECT b.bicikl_id, 'TMP-R1', 'DOSTUPAN' FROM Bicikl b WHERE b.naziv = 'RockRide Comp';

INSERT INTO bicikl_jedinica (bicikl_id, inventarni_broj, status)
SELECT b.bicikl_id, 'TMP-A' || gs::text, 'DOSTUPAN'
FROM Bicikl b, generate_series(1, 2) gs WHERE b.naziv = 'Aero Sprint';

INSERT INTO bicikl_jedinica (bicikl_id, inventarni_broj, status)
SELECT b.bicikl_id, 'TMP-K' || gs::text, 'DOSTUPAN'
FROM Bicikl b, generate_series(1, 4) gs WHERE b.naziv = 'Kid 20"';

INSERT INTO bicikl_jedinica (bicikl_id, inventarni_broj, status)
SELECT b.bicikl_id, 'TMP-E' || gs::text, 'DOSTUPAN'
FROM Bicikl b, generate_series(1, 2) gs WHERE b.naziv = 'E-City Pro';

INSERT INTO bicikl_jedinica (bicikl_id, inventarni_broj, status)
SELECT b.bicikl_id, 'TMP-M1', 'DOSTUPAN' FROM Bicikl b WHERE b.naziv = 'E-MTB Lite';

UPDATE bicikl_jedinica SET inventarni_broj = 'JB-' || lpad(jedinica_id::text, 6, '0');

INSERT INTO Narudzba (status, kupac_korisnik_id, djelatnik_korisnik_id)
SELECT 'NOVA', k_korisnik.korisnik_id, d_korisnik.korisnik_id
FROM Korisnik k_korisnik
CROSS JOIN Korisnik d_korisnik
WHERE k_korisnik.email = 'iva.narucitelj@spi.local'
  AND d_korisnik.email = 'petra.djelatnik@spi.local';

INSERT INTO Narudzba (status, kupac_korisnik_id, djelatnik_korisnik_id)
SELECT 'POTVRDJENA', k_korisnik.korisnik_id, d_djel.korisnik_id
FROM Korisnik k_korisnik
CROSS JOIN Korisnik d_djel
WHERE k_korisnik.email = 'marko.narucitelj@spi.local'
  AND d_djel.email = 'petra.djelatnik@spi.local';


INSERT INTO StavkaNarudzbe (kolicina, cijena, jedinica_id, narudzba_id)
SELECT 1, b.cijena, j.jedinica_id, n.narudzba_id
FROM bicikl_jedinica j
JOIN Bicikl b ON b.bicikl_id = j.bicikl_id
CROSS JOIN LATERAL (SELECT narudzba_id FROM Narudzba WHERE status = 'NOVA' ORDER BY narudzba_id LIMIT 1) n
WHERE b.naziv = 'City One 28"' AND j.status = 'DOSTUPAN'
ORDER BY j.jedinica_id LIMIT 1;

INSERT INTO StavkaNarudzbe (kolicina, cijena, jedinica_id, narudzba_id)
SELECT 1, b.cijena, j.jedinica_id, n.narudzba_id
FROM bicikl_jedinica j
JOIN Bicikl b ON b.bicikl_id = j.bicikl_id
CROSS JOIN LATERAL (SELECT narudzba_id FROM Narudzba WHERE status = 'NOVA' ORDER BY narudzba_id LIMIT 1) n
WHERE b.naziv = 'Trail X 29"' AND j.status = 'DOSTUPAN'
ORDER BY j.jedinica_id LIMIT 1;

INSERT INTO StavkaNarudzbe (kolicina, cijena, jedinica_id, narudzba_id)
SELECT 1, b.cijena, j.jedinica_id, n.narudzba_id
FROM bicikl_jedinica j
JOIN Bicikl b ON b.bicikl_id = j.bicikl_id
CROSS JOIN LATERAL (SELECT narudzba_id FROM Narudzba WHERE status = 'NOVA' ORDER BY narudzba_id LIMIT 1) n
WHERE b.naziv = 'Trail X 29"' AND j.status = 'DOSTUPAN'
  AND j.jedinica_id NOT IN (
    SELECT jedinica_id FROM StavkaNarudzbe WHERE narudzba_id = n.narudzba_id
  )
ORDER BY j.jedinica_id LIMIT 1;

INSERT INTO StavkaNarudzbe (kolicina, cijena, jedinica_id, narudzba_id)
SELECT 1, b.cijena, j.jedinica_id, n.narudzba_id
FROM bicikl_jedinica j
JOIN Bicikl b ON b.bicikl_id = j.bicikl_id
CROSS JOIN LATERAL (
  SELECT n.narudzba_id
  FROM narudzba n
  JOIN kupac ku ON ku.korisnik_id = n.kupac_korisnik_id
  JOIN korisnik k ON k.korisnik_id = ku.korisnik_id
  WHERE k.email = 'marko.narucitelj@spi.local' AND n.status = 'POTVRDJENA'
  ORDER BY n.narudzba_id
  LIMIT 1
) n
WHERE b.naziv = 'Kid 20"' AND j.status = 'DOSTUPAN'
ORDER BY j.jedinica_id LIMIT 1;


UPDATE narudzba n SET prodaja_obradena = TRUE,
  datum_zavrsetka = COALESCE(n.datum_zavrsetka, n.datum)
FROM kupac ku
JOIN korisnik k ON k.korisnik_id = ku.korisnik_id
WHERE n.kupac_korisnik_id = k.korisnik_id AND k.email = 'marko.narucitelj@spi.local'
  AND n.status = 'POTVRDJENA' AND NOT n.prodaja_obradena;


INSERT INTO Najam (datum_pocetka, datum_zavrsetka, status_najma, ukupna_cijena, jedinica_id, djelatnik_korisnik_id, kupac_korisnik_id)
SELECT DATE '2025-03-10', DATE '2025-03-15', 'VRACEN', 5 * 45.00,
  (SELECT j.jedinica_id FROM bicikl_jedinica j JOIN Bicikl b ON b.bicikl_id = j.bicikl_id WHERE b.naziv = 'RockRide Comp' ORDER BY j.jedinica_id LIMIT 1),
  (SELECT korisnik_id FROM korisnik WHERE email = 'petra.djelatnik@spi.local'),
  (SELECT korisnik_id FROM korisnik WHERE email = 'marko.narucitelj@spi.local');

INSERT INTO Najam (datum_pocetka, datum_zavrsetka, status_najma, ukupna_cijena, jedinica_id, djelatnik_korisnik_id, kupac_korisnik_id)
SELECT CURRENT_DATE - 10, CURRENT_DATE - 6, 'AKTIVAN', 4 * 12.00,
  (SELECT j.jedinica_id FROM bicikl_jedinica j JOIN Bicikl b ON b.bicikl_id = j.bicikl_id
   WHERE b.naziv = 'Kid 20"' AND j.status = 'DOSTUPAN'
     AND j.jedinica_id NOT IN (SELECT jedinica_id FROM StavkaNarudzbe)
   ORDER BY j.jedinica_id LIMIT 1),
  (SELECT korisnik_id FROM korisnik WHERE email = 'petra.djelatnik@spi.local'),
  (SELECT korisnik_id FROM korisnik WHERE email = 'iva.narucitelj@spi.local');

UPDATE bicikl_jedinica j SET status = 'IZNAJMLJEN'
FROM najam n
WHERE n.jedinica_id = j.jedinica_id AND n.status_najma = 'AKTIVAN';
