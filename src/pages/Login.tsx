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
  const [modo, setModo] = useState<"Login" | "registro">("registro");
  const navigate = useNavigate();

  // Função para redirecionar conforme estado do usuário
  const redirecionarUsuario = async (uid: string) => {
    const userRef = doc(db, "usuarios", uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists() || userSnap.data()?.saldo === undefined) {
      // Usuário precisa configurar saldo inicial
      navigate("/setup");
    } else if (userSnap.data()?.parcelamentosAtivos) {
      // Usuário possui parcelamentos ativos
      navigate("/parcelamentos");
    } else {
      // Usuário pronto → Dashboard
      navigate("/dashboard");
    }
  };

  // Registro
  const handleRegistro = async () => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
      const uid = userCredential.user.uid;

      // Salva dados adicionais no Firestore
      await setDoc(doc(db, "usuarios", uid), {
        email: email,
        saldo: 0, // saldo inicial
        parcelamentosAtivos: false, // inicialmente sem parcelamentos
        criadoEm: new Date()
      });

      // Salva token/localStorage
      localStorage.setItem("userToken", uid);

      alert("Usuário registrado com sucesso!");
      await redirecionarUsuario(uid); // redireciona conforme fluxo
    } catch (error: any) {
      console.error(error);
      if (error.code === "auth/email-already-in-use") {
        alert("Esse email já está em uso. Tente fazer login.");
        setModo("Login");
      } else if (error.code === "auth/weak-password") {
        alert("Senha muito fraca. Use no mínimo 6 caracteres.");
      } else {
        alert("Erro ao registrar usuário: " + error.message);
      }
    }
  };

  // Login
  const handleLogin = async () => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, senha);
      const uid = userCredential.user.uid;

      // Salva token/localStorage
      localStorage.setItem("userToken", uid);

      alert("Login realizado com sucesso!");
      await redirecionarUsuario(uid); // redireciona conforme fluxo
    } catch (error: any) {
      console.error(error);
      if (error.code === "auth/user-not-found") {
        alert("Usuário não encontrado. Verifique o email ou registre-se.");
      } else if (error.code === "auth/wrong-password") {
        alert("Senha incorreta. Tente novamente.");
      } else {
        alert("Erro ao fazer login: " + error.message);
      }
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "300px", margin: "50px auto" }}>
      <h1>{modo === "registro" ? "Registro" : "Login"}</h1>

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ marginBottom: "10px", padding: "8px" }}
      />
      <input
        type="password"
        placeholder="Senha"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        style={{ marginBottom: "10px", padding: "8px" }}
      />

      {modo === "registro" ? (
        <button onClick={handleRegistro} style={{ padding: "10px" }}>Registrar</button>
      ) : (
        <button onClick={handleLogin} style={{ padding: "10px" }}>Entrar</button>
      )}

      <button
        onClick={() => setModo(modo === "registro" ? "Login" : "registro")}
        style={{ marginTop: "10px", padding: "6px" }}
      >
        {modo === "registro" ? "Já tem conta? Faça Login" : "Não tem conta? Registre-se"}
      </button>
    </div>
  );
}
