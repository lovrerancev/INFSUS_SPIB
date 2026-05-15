import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../lib/api";

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [lozinka, setLozinka] = useState("");
  const [greska, setGreska] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setGreska(null);
    try {
      await login(email, lozinka);
      nav("/");
    } catch (err) {
      setGreska(err instanceof ApiError ? err.message : "Prijava nije uspjela");
    }
  }

  return (
    <div className="panel" style={{ maxWidth: 420 }}>
      <h2>Prijava</h2>
      {greska && <p className="greska">{greska}</p>}
      <form className="forma-blok" onSubmit={submit}>
        <label>
          E-mail
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Lozinka
          <input type="password" autoComplete="current-password" value={lozinka} onChange={(e) => setLozinka(e.target.value)} required />
        </label>
        <button type="submit" className="btn">
          Prijavi se
        </button>
      </form>
      <p className="hint">
        Demo: kupac <code>iva.narucitelj@spi.local</code> / <code>demo</code> · djelatnik{" "}
        <code>petra.djelatnik@spi.local</code> / <code>demo</code> · administrator{" "}
        <code>admin@spi.local</code> / <code>demo</code>
      </p>
      <p>
        <Link to="/registracija">Registracija (novi kupac)</Link>
      </p>
    </div>
  );
}
