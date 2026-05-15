
CREATE TABLE IF NOT EXISTS administrator (
    korisnik_id INT PRIMARY KEY,
    CONSTRAINT fk_administrator_korisnik
        FOREIGN KEY (korisnik_id)
        REFERENCES Korisnik(korisnik_id)
        ON DELETE CASCADE
);


INSERT INTO Korisnik (ime, prezime, email, lozinka)
SELECT 'Admin', 'Sustava', 'admin@spi.local', '$2b$10$YOsmUNorzlfMXi2mSfg.mOe5Mik0Ngq5EftaJ.GFsr9IADpFSzf2e'
WHERE NOT EXISTS (SELECT 1 FROM Korisnik WHERE lower(email) = lower('admin@spi.local'));

INSERT INTO administrator (korisnik_id)
SELECT k.korisnik_id
FROM Korisnik k
WHERE lower(k.email) = lower('admin@spi.local')
  AND NOT EXISTS (SELECT 1 FROM administrator a WHERE a.korisnik_id = k.korisnik_id);
