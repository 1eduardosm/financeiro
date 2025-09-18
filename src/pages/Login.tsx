import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword 
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";

export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [modo, setModo] = useState<"login" | "registro">("login");
  const navigate = useNavigate();

  // Registro de usuário
  const handleRegistro = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, senha);
      const user = cred.user;

      // Cria doc inicial no Firestore
      await setDoc(doc(db, "usuarios", user.uid), {
        email: user.email,
        criadoEm: new Date().toISOString(),
        jaFezSetup: false,
      });

      alert("Conta registrada com sucesso!");
      navigate("/setup");
    } catch (err: any) {
      alert("Erro ao registrar: " + err.message);
    }
  };

  // Login de usuário
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const cred = await signInWithEmailAndPassword(auth, email, senha);
      const user = cred.user;

      // Verifica se já tem setup feito
      const ref = doc(db, "usuarios", user.uid);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const dados = snap.data();
        console.log("dado: ", dados)
        if (dados.jaFezSetup) {
          navigate("/Dashboard"); // já configurado → Dashboard
        } else {
          navigate("/setup"); // não configurado ainda
        }
      } else {
        navigate("/setup");
      }
    } catch (err: any) {
      alert("Erro ao fazer login: " + err.message);
    }
  };

  return (
    <div style={{ maxWidth: "400px", margin: "50px auto", padding: "20px" }}>
      <h1>{modo === "login" ? "Login" : "Registro"}</h1>
      <form onSubmit={modo === "login" ? handleLogin : handleRegistro}>
        <input
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
        />
        <input
          type="password"
          placeholder="Senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
        />
        <button
          type="submit"
          style={{ width: "100%", padding: "12px", backgroundColor: "#860204", color: "#fff" }}
        >
          {modo === "login" ? "Entrar" : "Registrar"}
        </button>
      </form>

      <div style={{ marginTop: "15px", textAlign: "center" }}>
        {modo === "login" ? (
          <p>
            Não tem conta?{" "}
            <button
              onClick={() => setModo("registro")}
              style={{ border: "none", background: "transparent", color: "#860204", cursor: "pointer" }}
            >
              Registre-se
            </button>
          </p>
        ) : (
          <p>
            Já tem conta?{" "}
            <button
              onClick={() => setModo("login")}
              style={{ border: "none", background: "transparent", color: "#860204", cursor: "pointer" }}
            >
              Faça login
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
