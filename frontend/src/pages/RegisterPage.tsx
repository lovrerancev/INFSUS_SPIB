import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../lib/api";

export default function RegisterPage() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [ime, setIme] = useState("");
  const [prezime, setPrezime] = useState("");
  const [email, setEmail] = useState("");
  const [lozinka, setLozinka] = useState("");
  const [greska, setGreska] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setGreska(null);
    try {
      await register(ime, prezime, email, lozinka);
      nav("/");
    } catch (err) {
      setGreska(err instanceof ApiError ? err.message : "Registracija nije uspjela");
    }
  }

  return (
    <div className="panel" style={{ maxWidth: 420 }}>
      <h2>Registracija (kupac)</h2>
      {greska && <p className="greska">{greska}</p>}
      <form className="forma-blok" onSubmit={submit}>
        <label>
          Ime
          <input value={ime} onChange={(e) => setIme(e.target.value)} required />
        </label>
        <label>
          Prezime
          <input value={prezime} onChange={(e) => setPrezime(e.target.value)} required />
        </label>
        <label>
          E-mail
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Lozinka (min. 8 znakova)
          <input type="password" value={lozinka} onChange={(e) => setLozinka(e.target.value)} minLength={8} required />
        </label>
        <button type="submit" className="btn">
          Registriraj se
        </button>
      </form>
      <p>
        <Link to="/prijava">Već imam račun</Link>
      </p>
    </div>
  );
}
