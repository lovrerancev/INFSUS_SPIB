# Camunda — SPIB obrada narudžbe (DZ4)

## Brzo pokretanje

```powershell
# 1. Camunda (ako već postoji kontejner)
docker start camunda

# 2. Deploy BPMN + korisnici/grupe
.\camunda\setup.ps1

# 3. SPIB frontend (u drugom terminalu)
cd frontend
npm.cmd run dev
```

Otvori: **http://localhost:5173/proces-narudzbe**

Camunda Tasklist (opcionalno): http://localhost:8080/camunda/app/tasklist/  
Login: `demo` / `demo` ili Camunda useri `kupac1`, `djelatnik1`, `admin1` (lozinka `demo`).

## Camunda korisnici (setup.ps1)

| ID | Grupa | Uloga u procesu |
|----|-------|-----------------|
| kupac1 | — | Nova narudžba, Ispravak adrese |
| djelatnik1 | djelatnik | Pregled narudzbe |
| admin1 | administrator | Odluka administratora |

SPIB prijava (email) i Camunda user id su **odvojeni** — stranica `/proces-narudzbe` mapira ulogu na Camunda id.

## Demo scenarij

1. **Start procesa** → `kupacUsername` = `kupac1`
2. Task **Nova narudzba** (SPIB stranica kao kupac ili Tasklist kao kupac1)
3. **Pregled** → Eskaliraj (djelatnik1)
4. **Odluka admina** → Vrati kupcu (admin1)
5. **Ispravak adrese** → petlja na pregled (kupac1)

Proces key: `SPIB_ObradaNarudzbe`

## Datoteke

- `SPIB_ObradaNarudzbe.bpmn` — model procesa
- `setup.ps1` — deploy + identity
- Frontend: `frontend/src/pages/ProcesNarudzbePage.tsx`
