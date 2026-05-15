# SPIB DZ3

Ovaj repozitorij sadrzi backend API, frontend aplikaciju i PostgreSQL bazu za sustav prodaje i iznajmljivanja bicikala.

## Preduvjeti

- Node.js 20.19+ ili Node.js 22 LTS
- npm
- Docker Desktop ili lokalni PostgreSQL 16
- PowerShell na Windowsu

Ako PowerShell blokira `npm` zbog execution policyja, koristi `npm.cmd`:

```powershell
npm.cmd install
npm.cmd run dev
```

## Struktura projekta

```text
backend/   Fastify API, poslovna logika, repozitoriji i testovi
frontend/  React + Vite korisnicko sucelje
database/  SQL shema, seed podaci i migracijske/patch skripte
```

## Pokretanje baze

Iz korijena repozitorija pokreni PostgreSQL preko Dockera:

```powershell
docker compose up -d
```

Compose pokrece bazu `spib` na portu `5432` i pri prvom pokretanju ucitava SQL skripte iz mape `database`.

Ako zelis ponovo ucitati shemu i seed podatke od nule:

```powershell
docker compose down -v
docker compose up -d
```

Opcionalno se moze kopirati `.env.example` u `.env` u korijenu projekta i promijeniti PostgreSQL postavke.

## Pokretanje backenda

U drugom terminalu:

```powershell
cd backend
npm.cmd install
```

Provjeri ili napravi `backend/.env` prema `backend/.env.example`:

```text
DATABASE_URL=postgresql://spib:spib_dev_promijeni_me@localhost:5432/spib
PORT=3000
JWT_SECRET=postavi-dugi-slucajni-string-za-produkciju
```

Pokreni razvojni backend:

```powershell
npm.cmd run dev
```

API je dostupan na:

```text
http://localhost:3000/api
```

Brza provjera:

```text
http://localhost:3000/api/health
```

## Pokretanje frontenda

U novom terminalu:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Vite ispisuje lokalni URL, najcesce:

```text
http://localhost:5173
```

Frontend proxy prosljeduje `/api` zahtjeve na backend `http://localhost:3000`, pa backend mora biti pokrenut.

## Build provjera

Backend:

```powershell
cd backend
npm.cmd run typecheck
npm.cmd run build
```

Frontend:

```powershell
cd frontend
npm.cmd run build
```

## Testiranje sustava

Testovi su u mapi `backend/tests` i koriste Vitest.

### Unit testovi

Pokretanje:

```powershell
cd backend
npm.cmd run test:unit
```

Isto se moze pokrenuti i kracom naredbom:

```powershell
npm.cmd test
```

Unit testovi provjeravaju pojedine dijelove sustava izolirano, bez pokretanja stvarnog HTTP servera i bez stvarne baze gdje se repozitoriji mockaju.

Specifikacija unit testova:

- `backend/tests/unit/authService.test.ts` provjerava registraciju, prijavu, validaciju lozinke i izdavanje JWT tokena.
- `backend/tests/unit/requestAuth.test.ts` provjerava citanje Bearer tokena, obaveznu prijavu i provjeru korisnickih uloga.
- `backend/tests/unit/application/narudzbaService.test.ts` provjerava poslovna pravila narudzbi: validaciju statusa, prava kupca/djelatnika, dohvat narudzbi po ulozi, zabrane izmjene stavki i prijelaze statusa.
- `backend/tests/unit/application/kategorijaService.test.ts` provjerava validaciju kategorija, update, delete i pravila brisanja kada postoje povezani bicikli.
- `backend/tests/unit/infrastructure/narudzbaRepository.test.ts` provjerava SQL pozive za narudzbe, dohvat liste, detalja i ponasanje kada zapis ne postoji.
- `backend/tests/unit/infrastructure/kategorijaRepository.test.ts` provjerava SQL pozive za kategorije, pretragu, insert/update/delete i broj povezanih bicikala.
- `backend/tests/unit/presentation/narudzbeRoutes.test.ts` provjerava HTTP rute narudzbi, status kodove, autorizaciju i prosljedivanje prema servisu.
- `backend/tests/unit/presentation/kategorijeRoutes.test.ts` provjerava rute kategorija, validacije i odgovore za uspjeh/greske.
- `backend/tests/unit/presentation/izvjestajiRoutes.test.ts` provjerava rute izvjestaja i pristup prema ulozi.

### Integracijski testovi

Prije integracijskih testova moraju raditi baza i backend:

```powershell
docker compose up -d
cd backend
npm.cmd run dev
```

U drugom terminalu pokreni:

```powershell
cd backend
npm.cmd run test:integration
```

Integracijski test koristi `API_BASE_URL`, a ako varijabla nije postavljena koristi:

```text
http://localhost:3000
```

Specifikacija integracijskog testa `backend/tests/integration/currentBackendApi.integration.test.ts`:

- provjerava `/api/health`
- provjerava javni dohvat kategorija
- provjerava javni katalog bicikala
- provjerava registraciju kupca
- provjerava prijavu kupca
- provjerava `/api/auth/ja` s Bearer tokenom
- provjerava da zasticene narudzbe traze prijavu
- provjerava da direktni `POST /api/narudzbe` nije dozvoljen kupcu
- provjerava kupnju preko `POST /api/kupnja`
- provjerava dohvat narudzbi i detalja narudzbe nakon kupnje
- provjerava zabranu administratoru za javni katalog
- provjerava dopusten pristup administratoru na `/api/admin/korisnici`

Integracijski test sam kreira privremenog kupca i privremenu narudzbu, a na kraju cisti testne podatke i vraca status koristenih jedinica bicikla.

### Watch mode

Za razvojno pokretanje testova u watch nacinu:

```powershell
cd backend
npm.cmd run test:watch
```

## Korisne naredbe

```powershell
# baza
docker compose up -d
docker compose down -v

# backend
cd backend
npm.cmd install
npm.cmd run dev
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:unit
npm.cmd run test:integration

# frontend
cd frontend
npm.cmd install
npm.cmd run dev
npm.cmd run build
```

## Napomene

- Frontend zahtijeva noviji Node zbog Vite verzije. Ako dobijes poruku da Vite zahtijeva Node 20.19+ ili 22.12+, potrebno je nadograditi Node.
- Backend po defaultu koristi `postgresql://spib:spib_dev_promijeni_me@localhost:5432/spib` ako `DATABASE_URL` nije postavljen.
- Integracijski testovi ovise o aktualnoj shemi baze. Ako test javi da nedostaju tablice, ponovno ucitaj bazu naredbama `docker compose down -v` i `docker compose up -d`.
