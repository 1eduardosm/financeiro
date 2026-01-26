import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  setPersistence,
  browserSessionPersistence 
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";

export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [modo, setModo] = useState<"login" | "registro">("login");
  const [carregando, setCarregando] = useState(false);
  const navigate = useNavigate();

  // Função para configurar a persistência e realizar o login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    try {
      // FORÇA O FIREBASE A NÃO GUARDAR CACHE (pede login ao fechar a aba)
      await setPersistence(auth, browserSessionPersistence);
      
      const cred = await signInWithEmailAndPassword(auth, email, senha);
      const user = cred.user;

      // Busca dados no Firestore para decidir a rota
      const ref = doc(db, "usuarios", user.uid);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const dados = snap.data();
        if (dados.jaFezSetup) {
          navigate("/Dashboard");
        } else {
          navigate("/setup");
        }
      } else {
        // Se o usuário existe no Auth mas não no Firestore, manda pro setup
        navigate("/setup");
      }
    } catch (err: any) {
      alert("Erro ao entrar: " + err.message);
    } finally {
      setCarregando(false);
    }
  };

  // Registro de novo usuário
  const handleRegistro = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, senha);
      const user = cred.user;

      await setDoc(doc(db, "usuarios", user.uid), {
        email: user.email,
        criadoEm: new Date().toISOString(),
        jaFezSetup: false,
      });

      alert("Conta criada com sucesso!");
      navigate("/setup");
    } catch (err: any) {
      alert("Erro ao registrar: " + err.message);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>{modo === "login" ? "Login" : "Criar Conta"}</h1>
        
        <form onSubmit={modo === "login" ? handleLogin : handleRegistro}>
          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            required
          />
          <input
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            style={styles.input}
            required
          />
          
          <button
            type="submit"
            disabled={carregando}
            style={{
              ...styles.button,
              backgroundColor: carregando ? "#ccc" : "#860204"
            }}
          >
            {carregando ? "Aguarde..." : modo === "login" ? "Entrar" : "Registrar"}
          </button>
        </form>

        <div style={styles.switchBox}>
          <button
            onClick={() => setModo(modo === "login" ? "registro" : "login")}
            style={styles.switchButton}
          >
            {modo === "login" 
              ? "Não tem uma conta? Registre-se" 
              : "Já possui conta? Faça login"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Estilização básica para a tela ficar apresentável
const styles = {
  container: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100vh",
    backgroundColor: "#f4f4f4",
    fontFamily: "Arial, sans-serif"
  } as React.CSSProperties,
  card: {
    backgroundColor: "#fff",
    padding: "40px",
    borderRadius: "8px",
    boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
    width: "100%",
    maxWidth: "400px"
  } as React.CSSProperties,
  title: {
    textAlign: "center" as const,
    color: "#333",
    marginBottom: "30px"
  },
  input: {
    width: "100%",
    padding: "12px",
    marginBottom: "15px",
    borderRadius: "4px",
    border: "1px solid #ddd",
    boxSizing: "border-box" as const,
    fontSize: "16px"
  },
  button: {
    width: "100%",
    padding: "12px",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    fontSize: "16px",
    fontWeight: "bold" as const,
    cursor: "pointer",
    transition: "0.3s"
  },
  switchBox: {
    marginTop: "20px",
    textAlign: "center" as const
  },
  switchButton: {
    background: "none",
    border: "none",
    color: "#860204",
    textDecoration: "underline",
    cursor: "pointer",
    fontSize: "14px"
  }
};