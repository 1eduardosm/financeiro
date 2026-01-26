import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase"; 

import Login from "./pages/Login";
import Setup from "./pages/Setup";
import Dashboard from "./pages/Dashboard";

export default function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // Monitora o estado de login em tempo real
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <div style={{ padding: "20px" }}>Carregando...</div>;

  return (
    <Routes>
      <Route 
        path="/login" 
        element={user ? <Navigate to="/Dashboard" /> : <Login />} 
      />
      <Route
        path="/setup"
        element={user ? <Setup /> : <Navigate to="/login" />}
      />
      <Route
        path="/Dashboard"
        element={user ? <Dashboard /> : <Navigate to="/login" />}
      />
      <Route path="/" element={<Navigate to={user ? "/Dashboard" : "/login"} />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}