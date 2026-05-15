import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function HomePage() {
  const { user } = useAuth();
  const djelatnik = user?.role === "djelatnik";
  const administrator = user?.role === "administrator";

  return (
    <section className="pocetna">
      <h2>Dobro došli u SPIB</h2>
      <p className="pocetna-uvod">
        Sustav za online pregled kataloga, narudžbe kupnje (s plaćanjem i dostavom), rezervacije najma, upravljanje
        katalogom za djelatnike te izvještaje o prodaji i najmu.
      </p>

      <div className="pocetna-kartice">
        {!administrator && (
          <Link to="/katalog" className="pocetna-karta">
            <span className="pocetna-karta__naslov">Katalog</span>
            <span className="pocetna-karta__opis">Pregled bicikala s filtriranjem po kategoriji, cijeni i dostupnosti.</span>
          </Link>
        )}
        {user?.role === "kupac" && !administrator && (
          <Link to="/kupnja" className="pocetna-karta">
            <span className="pocetna-karta__naslov">Kupnja</span>
            <span className="pocetna-karta__opis">Nova narudžba s biciklom, adresom dostave i načinom plaćanja.</span>
          </Link>
        )}
        {user && !administrator && (
          <>
            <Link to="/najam" className="pocetna-karta">
              <span className="pocetna-karta__naslov">Najam</span>
              <span className="pocetna-karta__opis">Rezervacija datuma i prikaz ukupne cijene najma.</span>
            </Link>
            <Link to="/narudzbe" className="pocetna-karta">
              <span className="pocetna-karta__naslov">Narudžbe</span>
              <span className="pocetna-karta__opis">Pregled narudžbi, stavki, statusa, načina plaćanja i adrese dostave.</span>
            </Link>
          </>
        )}
        {djelatnik && (
          <>
            <Link to="/bicikli-admin" className="pocetna-karta">
              <span className="pocetna-karta__naslov">Bicikli (djelatnik)</span>
              <span className="pocetna-karta__opis">Upravljanje modelima i skladišnim jedinicama; kategorija s popisa.</span>
            </Link>
            <Link to="/najmovi" className="pocetna-karta">
              <span className="pocetna-karta__naslov">Najmovi (djelatnik)</span>
              <span className="pocetna-karta__opis">Pregled najmova, kašnjenja i vraćanja jedinica.</span>
            </Link>
            <Link to="/kategorije" className="pocetna-karta">
              <span className="pocetna-karta__naslov">Kategorije</span>
              <span className="pocetna-karta__opis">Šifrarnik kategorija bicikla.</span>
            </Link>
          </>
        )}
        {administrator && (
          <>
            <Link to="/admin" className="pocetna-karta">
              <span className="pocetna-karta__naslov">Administracija</span>
              <span className="pocetna-karta__opis">Brisanje korisnika i upravljanje djelatnicima.</span>
            </Link>
            <Link to="/izvjestaji" className="pocetna-karta">
              <span className="pocetna-karta__naslov">Izvještaji</span>
              <span className="pocetna-karta__opis">Prodaja i najam u odabranom razdoblju.</span>
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
