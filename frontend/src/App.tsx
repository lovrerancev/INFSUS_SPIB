import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import AdminPage from "./pages/AdminPage";
import BicikliAdminPage from "./pages/BicikliAdminPage";
import HomePage from "./pages/HomePage";
import IzvjestajiPage from "./pages/IzvjestajiPage";
import KatalogPage from "./pages/KatalogPage";
import KupnjaPage from "./pages/KupnjaPage";
import KategorijePage from "./pages/KategorijePage";
import LoginPage from "./pages/LoginPage";
import NajamPage from "./pages/NajamPage";
import NajmoviPage from "./pages/NajmoviPage";
import NarudzbePage from "./pages/NarudzbePage";
import RegisterPage from "./pages/RegisterPage";
import "./App.css";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="katalog" element={<KatalogPage />} />
          <Route path="kupnja" element={<KupnjaPage />} />
          <Route path="najam" element={<NajamPage />} />
          <Route path="narudzbe" element={<NarudzbePage />} />
          <Route path="bicikli-admin" element={<BicikliAdminPage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="najmovi" element={<NajmoviPage />} />
          <Route path="izvjestaji" element={<IzvjestajiPage />} />
          <Route path="kategorije" element={<KategorijePage />} />
          <Route path="prijava" element={<LoginPage />} />
          <Route path="registracija" element={<RegisterPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
