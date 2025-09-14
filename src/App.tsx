import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Setup from "./pages/Setup";
import Parcelamentos from "./pages/Parcelamentos";
import Dashboard from "./pages/Dashboard";

export default function App() {
  // Aqui você verifica se o usuário está logado (ex: localStorage ou estado global)
  const isLoggedIn = !!localStorage.getItem("userToken"); 

  return (
    <Routes>
      {/* Rota de login sempre acessível */}
      <Route path="/login" element={<Login />} />

      {/* Rotas protegidas: só acessíveis se estiver logado */}
      <Route
        path="/setup"
        element={isLoggedIn ? <Setup /> : <Navigate to="/login" />}
      />
      <Route
        path="/parcelamentos"
        element={isLoggedIn ? <Parcelamentos /> : <Navigate to="/login" />}
      />
      <Route
        path="/dashboard"
        element={isLoggedIn ? <Dashboard /> : <Navigate to="/login" />}
      />

      {/* Redireciona qualquer rota desconhecida */}
      <Route
        path="*"
        element={<Navigate to={isLoggedIn ? "/dashboard" : "/login"} />}
      />
    </Routes>
  );
}
