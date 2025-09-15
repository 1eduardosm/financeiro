import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword 
} from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";

export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [modo, setModo] = useState<"Login" | "Registro">("Registro");
  const [fase, setFase] = useState<"loginRegistro" | "primeiraVez">("loginRegistro");
  const [uidAtual, setUidAtual] = useState<string | null>(null);
  const [parcelamentos, setParcelamentos] = useState<boolean | null>(null);

  const navigate = useNavigate();

  // Função que redireciona o usuário conforme o fluxo correto
  const redirecionarUsuario = async (uid: string) => {
    const userRef = doc(db, "usuarios", uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists() || userSnap.data()?.saldo === undefined) {
      // Usuário precisa configurar saldo inicial
      navigate("/setup");
      return;
    }

    const jaInformou = userSnap.data()?.jaInformouParcelamentos;
    const temParcelamentos = userSnap.data()?.temParcelamentos;

    if (jaInformou === false || jaInformou === undefined) {
      // Usuário nunca informou → mostrar tela de primeira vez
      setUidAtual(uid);
      setFase("primeiraVez");
    } else {
      // Usuário já informou → ir direto para dashboard ou parcelamentos
      if (temParcelamentos) {
        navigate("/parcelamentos");
      } else {
        navigate("/dashboard");
      }
    }
  };

  // Registro
  const handleRegistro = async () => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
      const uid = userCredential.user.uid;

      await setDoc(doc(db, "usuarios", uid), {
        email: email,
        saldo: 0,
        jaInformouParcelamentos: false, // ainda não informou
        temParcelamentos: null,          // null = sem escolha inicial
        criadoEm: new Date()
      });

      localStorage.setItem("userToken", uid);
      setUidAtual(uid);
      setFase("primeiraVez"); // força tela de primeira vez
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

      localStorage.setItem("userToken", uid);
      await redirecionarUsuario(uid);
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

  // Confirmar escolha da primeira vez
  const confirmarParcelamentos = async () => {
    if (parcelamentos === null || !uidAtual) return alert("Selecione uma opção!");

    const userRef = doc(db, "usuarios", uidAtual);
    await updateDoc(userRef, {
      temParcelamentos: parcelamentos,
      jaInformouParcelamentos: true
    });

    // Redireciona após a escolha
    navigate("/dashboard");
  };

  // Tela de primeira vez
  if (fase === "primeiraVez") {
    return (
      <div style={{ display: "flex", flexDirection: "column", width: "300px", margin: "50px auto" }}>
        <h1>Você tem faturas ou compras parceladas pendentes?</h1>

        <button 
          onClick={() => setParcelamentos(true)} 
          style={{ 
            margin: "10px", padding: "10px", 
            backgroundColor: parcelamentos === true ? "#860204" : "#ccc", 
            color: "#fff" 
          }}
        >
          Sim
        </button>

        <button 
          onClick={() => setParcelamentos(false)} 
          style={{ 
            margin: "10px", padding: "10px", 
            backgroundColor: parcelamentos === false ? "#860204" : "#ccc", 
            color: "#fff" 
          }}
        >
          Não tenho faturas ou parcelamentos pendentes
        </button>

        <button onClick={confirmarParcelamentos} style={{ marginTop: "20px", padding: "10px" }}>
          Confirmar
        </button>
      </div>
    );
  }

  // Tela de login/registro
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "300px", margin: "50px auto" }}>
      <h1>{modo === "Registro" ? "Registro" : "Login"}</h1>

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

      {modo === "Registro" ? (
        <button onClick={handleRegistro} style={{ padding: "10px" }}>Registrar</button>
      ) : (
        <button onClick={handleLogin} style={{ padding: "10px" }}>Entrar</button>
      )}

      <button
        onClick={() => setModo(modo === "Registro" ? "Login" : "Registro")}
        style={{ marginTop: "10px", padding: "6px" }}
      >
        {modo === "Registro" ? "Já tem conta? Faça Login" : "Não tem conta? Registre-se"}
      </button>
    </div>
  );
}
