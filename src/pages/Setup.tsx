import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import { doc, setDoc } from "firebase/firestore";

export default function Setup() {
  const [saldoInicial, setSaldoInicial] = useState<number>(0);
  const [temParcelamentos, setTemParcelamentos] = useState(false);
  const navigate = useNavigate();

  const salvarSetup = async () => {
    const user = auth.currentUser;
    if (!user) {
      alert("Usuário não logado!");
      navigate("/login");
      return;
    }

    const uid = user.uid;

    try {
      await setDoc(
        doc(db, "usuarios", uid),
        {
          saldo: saldoInicial,
          parcelamentosAtivos: temParcelamentos,
          parcelamentos: temParcelamentos
            ? [
                {
                  valor: 0, // placeholder
                  tipo: "não definido", // placeholder
                  vencimento: new Date().toISOString(), // placeholder
                },
              ]
            : [],
          dataInicio: new Date().toISOString(),
        },
        { merge: true } // não sobrescreve outros campos existentes
      );

      alert("Configuração salva com sucesso!");
      navigate("/dashboard"); // redireciona para Dashboard
    } catch (error: any) {
      console.error(error);
      if (error.code === "permission-denied") {
        alert("Erro: sem permissão para salvar os dados. Verifique suas regras do Firestore.");
      } else {
        alert("Erro ao salvar configuração: " + error.message);
      }
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "300px", margin: "50px auto" }}>
      <h1>Configuração Inicial</h1>

      <input
        type="number"
        placeholder="Saldo Inicial"
        value={saldoInicial}
        onChange={(e) => setSaldoInicial(Number(e.target.value))}
        style={{ marginBottom: "10px", padding: "8px" }}
      />

      <label style={{ marginBottom: "10px" }}>
        <input
          type="checkbox"
          checked={temParcelamentos}
          onChange={(e) => setTemParcelamentos(e.target.checked)}
          style={{ marginRight: "5px" }}
        />
        Tenho parcelamentos ativos
      </label>

      <button onClick={salvarSetup} style={{ padding: "10px" }}>
        Salvar
      </button>
    </div>
  );
}
