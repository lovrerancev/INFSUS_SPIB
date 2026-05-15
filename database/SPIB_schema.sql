

CREATE TABLE Korisnik (
    korisnik_id SERIAL PRIMARY KEY,
    ime VARCHAR(50) NOT NULL,
    prezime VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    lozinka VARCHAR(100) NOT NULL
);

CREATE TABLE Kupac (
    korisnik_id INT PRIMARY KEY,
    CONSTRAINT fk_kupac_korisnik
        FOREIGN KEY (korisnik_id)
        REFERENCES Korisnik(korisnik_id)
        ON DELETE CASCADE
);

CREATE TABLE Djelatnik (
    korisnik_id INT PRIMARY KEY,
    pozicija VARCHAR(50) NOT NULL,
    CONSTRAINT fk_djelatnik_korisnik
        FOREIGN KEY (korisnik_id)
        REFERENCES Korisnik(korisnik_id)
        ON DELETE CASCADE
);

CREATE TABLE Administrator (
    korisnik_id INT PRIMARY KEY,
    CONSTRAINT fk_administrator_korisnik
        FOREIGN KEY (korisnik_id)
        REFERENCES Korisnik(korisnik_id)
        ON DELETE CASCADE
);

CREATE TABLE KategorijaBicikla (
    kategorija_id SERIAL PRIMARY KEY,
    naziv VARCHAR(50) NOT NULL UNIQUE,
    opis TEXT
);


CREATE TABLE Bicikl (
    bicikl_id SERIAL PRIMARY KEY,
    naziv VARCHAR(100) NOT NULL,
    cijena DECIMAL(10,2) NOT NULL CHECK (cijena >= 0),
    kategorija_id INT NOT NULL,
    cijena_najma_po_danu DECIMAL(10,2) CHECK (cijena_najma_po_danu IS NULL OR cijena_najma_po_danu >= 0),
    CONSTRAINT fk_bicikl_kategorija
        FOREIGN KEY (kategorija_id)
        REFERENCES KategorijaBicikla(kategorija_id)
        ON DELETE RESTRICT
);

CREATE TABLE bicikl_jedinica (
    jedinica_id SERIAL PRIMARY KEY,
    bicikl_id INT NOT NULL
        REFERENCES Bicikl(bicikl_id)
        ON DELETE CASCADE,
    inventarni_broj VARCHAR(64) NOT NULL,
    status VARCHAR(30) NOT NULL
        CONSTRAINT chk_jedinica_status
        CHECK (status IN ('DOSTUPAN', 'IZNAJMLJEN', 'PRODAN', 'U_SERVISU', 'NEDOSTUPAN')),
    CONSTRAINT uq_jedinica_inventarni UNIQUE (inventarni_broj)
);

CREATE TABLE Narudzba (
    narudzba_id SERIAL PRIMARY KEY,
    datum TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(30) NOT NULL
        CONSTRAINT chk_narudzba_status
        CHECK (status IN ('NOVA', 'POTVRDJENA', 'U_OBRADI', 'ZAVRSENA', 'OTKAZANA')),
    adresa_dostave VARCHAR(500) NOT NULL DEFAULT '',
    nacin_placanja VARCHAR(30) NOT NULL DEFAULT 'POUZEĆE'
        CONSTRAINT chk_nacin_placanja
        CHECK (nacin_placanja IN ('KARTICA', 'POUZEĆE', 'TRANSAKCIJSKI_RACUN')),
    prodaja_obradena BOOLEAN NOT NULL DEFAULT FALSE,
    datum_zavrsetka TIMESTAMP,
    kupac_korisnik_id INT NOT NULL,
    djelatnik_korisnik_id INT,
    CONSTRAINT fk_narudzba_kupac
        FOREIGN KEY (kupac_korisnik_id)
        REFERENCES Kupac(korisnik_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_narudzba_djelatnik
        FOREIGN KEY (djelatnik_korisnik_id)
        REFERENCES Djelatnik(korisnik_id)
        ON DELETE SET NULL
);

CREATE TABLE StavkaNarudzbe (
    stavka_id SERIAL PRIMARY KEY,
    kolicina INT NOT NULL CHECK (kolicina > 0),
    cijena DECIMAL(10,2) NOT NULL CHECK (cijena >= 0),
    jedinica_id INT NOT NULL,
    narudzba_id INT NOT NULL,
    CONSTRAINT fk_stavka_jedinica
        FOREIGN KEY (jedinica_id)
        REFERENCES bicikl_jedinica(jedinica_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_stavka_narudzba
        FOREIGN KEY (narudzba_id)
        REFERENCES Narudzba(narudzba_id)
        ON DELETE CASCADE
);

CREATE TABLE Najam (
    najam_id SERIAL PRIMARY KEY,
    datum_pocetka DATE NOT NULL,
    datum_zavrsetka DATE NOT NULL,
    status_najma VARCHAR(30) NOT NULL
        CONSTRAINT chk_najam_status
        CHECK (status_najma IN ('AKTIVAN', 'VRACEN')),
    ukupna_cijena DECIMAL(10,2) NOT NULL CHECK (ukupna_cijena >= 0),
    jedinica_id INT NOT NULL,
    djelatnik_korisnik_id INT,
    kupac_korisnik_id INT NOT NULL,
    CONSTRAINT fk_najam_jedinica
        FOREIGN KEY (jedinica_id)
        REFERENCES bicikl_jedinica(jedinica_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_najam_djelatnik
        FOREIGN KEY (djelatnik_korisnik_id)
        REFERENCES Djelatnik(korisnik_id)
        ON DELETE SET NULL,
    CONSTRAINT fk_najam_kupac
        FOREIGN KEY (kupac_korisnik_id)
        REFERENCES Kupac(korisnik_id)
        ON DELETE RESTRICT,
    CONSTRAINT chk_datum_najma
        CHECK (datum_zavrsetka >= datum_pocetka)
);

CREATE TABLE Placanje (
    placanje_id SERIAL PRIMARY KEY,
    iznos DECIMAL(10,2) NOT NULL CHECK (iznos >= 0),
    datum TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metoda VARCHAR(30) NOT NULL,
    status_placanja VARCHAR(30) NOT NULL
);

CREATE TABLE PlacanjeNajma (
    placanje_id INT PRIMARY KEY,
    najam_id INT NOT NULL UNIQUE,
    CONSTRAINT fk_placanje_najma_placanje
        FOREIGN KEY (placanje_id)
        REFERENCES Placanje(placanje_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_placanje_najma_najam
        FOREIGN KEY (najam_id)
        REFERENCES Najam(najam_id)
        ON DELETE CASCADE
);

CREATE TABLE PlacanjeNarudzbe (
    placanje_id INT PRIMARY KEY,
    narudzba_id INT NOT NULL UNIQUE,
    CONSTRAINT fk_placanje_narudzbe_placanje
        FOREIGN KEY (placanje_id)
        REFERENCES Placanje(placanje_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_placanje_narudzbe_narudzba
        FOREIGN KEY (narudzba_id)
        REFERENCES Narudzba(narudzba_id)
        ON DELETE CASCADE
);

CREATE INDEX idx_bicikl_kategorija ON Bicikl (kategorija_id);
CREATE INDEX idx_bicikl_naziv ON Bicikl (naziv);
CREATE INDEX idx_jedinica_bicikl ON bicikl_jedinica (bicikl_id);
CREATE INDEX idx_jedinica_status ON bicikl_jedinica (status);
CREATE INDEX idx_narudzba_kupac ON Narudzba (kupac_korisnik_id);
CREATE INDEX idx_narudzba_datum ON Narudzba (datum DESC);
CREATE INDEX idx_stavka_narudzba ON StavkaNarudzbe (narudzba_id);
CREATE INDEX idx_stavka_jedinica ON StavkaNarudzbe (jedinica_id);
CREATE INDEX idx_najam_jedinica ON Najam (jedinica_id);
CREATE INDEX idx_najam_kupac ON Najam (kupac_korisnik_id);
CREATE INDEX idx_kategorija_naziv ON KategorijaBicikla (naziv);

COMMENT ON TABLE Bicikl IS 'Vrsta/model bicikla (zajednički naziv i cijene).';
COMMENT ON TABLE bicikl_jedinica IS 'Pojedinačna skladišna jedinica (inventar, status).';
COMMENT ON COLUMN StavkaNarudzbe.jedinica_id IS 'Prodana / rezervirana jedinica.';
COMMENT ON COLUMN StavkaNarudzbe.cijena IS 'Cijena u trenutku kupnje (snimak).';
