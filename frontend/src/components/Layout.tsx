import { NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";


const GOST_PUTEVI = new Set(["/katalog", "/prijava", "/registracija"]);

export default function Layout() {
  const { user, logout, loading } = useAuth();
  const location = useLocation();
  const djelatnik = user?.role === "djelatnik";
  const administrator = user?.role === "administrator";

  const mainSadrzaj =
    loading ? (
      <p className="hint">Učitavanje…</p>
    ) : !user && !GOST_PUTEVI.has(location.pathname) ? (
      <Navigate to="/katalog" replace />
    ) : (
      <Outlet />
    );

  return (
    <div className="spib spib-layout">
      <header className="spib-header">
        <div className="spib-header-card">
          <h1>SPIB</h1>
          <p className="podnaslov">
            Neprijavljeni vide samo katalog; kupnja, najam i ostalo nakon prijave.
          </p>
          <div className="spib-userbar">
            {user ? (
              <>
                <span>
                  {user.prezime}, {user.ime} ({user.role})
                </span>
                <button type="button" className="btn btn-sekundarni btn-mali" onClick={logout}>
                  Odjava
                </button>
              </>
            ) : (
              <span className="spib-userbar-gost">
                <NavLink to="/prijava" className="nav-a">
                  Prijava
                </NavLink>
                <NavLink to="/registracija" className="nav-a">
                  Registracija
                </NavLink>
              </span>
            )}
          </div>
        </div>
      </header>
      <nav className="nav-glava" aria-label="Glavna navigacija">
        {user && (
          <NavLink to="/" end className={({ isActive }) => (isActive ? "nav-a nav-a--aktivno" : "nav-a")}>
            Početna
          </NavLink>
        )}
        {!administrator && (
          <NavLink to="/katalog" className={({ isActive }) => (isActive ? "nav-a nav-a--aktivno" : "nav-a")}>
            Katalog
          </NavLink>
        )}
        {user?.role === "kupac" && (
          <NavLink to="/kupnja" className={({ isActive }) => (isActive ? "nav-a nav-a--aktivno" : "nav-a")}>
            Kupnja
          </NavLink>
        )}
        {user && !administrator && (
          <>
            <NavLink to="/najam" className={({ isActive }) => (isActive ? "nav-a nav-a--aktivno" : "nav-a")}>
              Najam
            </NavLink>
            <NavLink to="/narudzbe" className={({ isActive }) => (isActive ? "nav-a nav-a--aktivno" : "nav-a")}>
              Narudžbe
            </NavLink>
          </>
        )}
        {administrator && (
          <>
            <NavLink to="/admin" className={({ isActive }) => (isActive ? "nav-a nav-a--aktivno" : "nav-a")}>
              Administracija
            </NavLink>
            <NavLink to="/izvjestaji" className={({ isActive }) => (isActive ? "nav-a nav-a--aktivno" : "nav-a")}>
              Izvještaji
            </NavLink>
          </>
        )}
        {djelatnik && (
          <>
            <NavLink to="/bicikli-admin" className={({ isActive }) => (isActive ? "nav-a nav-a--aktivno" : "nav-a")}>
              Bicikli
            </NavLink>
            <NavLink to="/najmovi" className={({ isActive }) => (isActive ? "nav-a nav-a--aktivno" : "nav-a")}>
              Najmovi
            </NavLink>
            <NavLink to="/kategorije" className={({ isActive }) => (isActive ? "nav-a nav-a--aktivno" : "nav-a")}>
              Kategorije
            </NavLink>
          </>
        )}
      </nav>
      <main className="spib-main">{mainSadrzaj}</main>
    </div>
  );
}
