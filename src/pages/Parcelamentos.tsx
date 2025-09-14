import { useState } from "react";
import { db, auth } from "../firebase";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function Parcelamentos() {
  const [modo, setModo] = useState<"quantidade" | "faturas">("quantidade");
  const [quantidade, setQuantidade] = useState(0);
  const [faturas, setFaturas] = useState<{ valor: number; vencimento: string }[]>([]);
  const [novoValor, setNovoValor] = useState(0);
  const [novaData, setNovaData] = useState("");
  const navigate = useNavigate();

  const salvarParcelamento = async (parcelamento: any) => {
    const user = auth.currentUser;
    if (!user) {
      alert("Usuário não logado!");
      navigate("/login");
      return;
    }

    const uid = user.uid;

    try {
      await updateDoc(doc(db, "usuarios", uid), {
        parcelamentos: arrayUnion(parcelamento),
        parcelamentosAtivos: true,
      });
    } catch (error: any) {
      console.error(error);
      alert("Erro ao salvar parcelamento: " + error.message);
    }
  };

  const adicionarFatura = () => {
    if (!novoValor || !novaData) return;
    const fatura = { valor: novoValor, vencimento: novaData };
    setFaturas([...faturas, fatura]);
    setNovoValor(0);
    setNovaData("");
    salvarParcelamento(fatura);
  };

  const finalizar = () => {
    navigate("/dashboard");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "400px", margin: "50px auto" }}>
      <h1>Parcelamentos</h1>

      <div style={{ marginBottom: "20px" }}>
        <button onClick={() => setModo("quantidade")}>Quantos parcelamentos tenho?</button>
        <button onClick={() => setModo("faturas")}>Informar próximas faturas</button>
      </div>

      {modo === "quantidade" && (
        <div>
          <label>Quantidade de compras parceladas ativas:</label>
          <input
            type="number"
            value={quantidade}
            onChange={(e) => setQuantidade(Number(e.target.value))}
            style={{ padding: "8px", marginTop: "5px", marginBottom: "10px" }}
          />
          <button
            onClick={() => {
              for (let i = 0; i < quantidade; i++) {
                salvarParcelamento({ descricao: `Compra parcelada ${i + 1}`, valorTotal: 0, parcelasTotais: 1, parcelasPagas: 0, valorParcela: 0, dataInicio: new Date().toISOString() });
              }
              alert("Parcelamentos adicionados!");
            }}
            style={{ padding: "10px" }}
          >
            Salvar quantidade
          </button>
        </div>
      )}

      {modo === "faturas" && (
        <div>
          <label>Valor da fatura:</label>
          <input
            type="number"
            value={novoValor}
            onChange={(e) => setNovoValor(Number(e.target.value))}
            style={{ padding: "8px", marginBottom: "10px" }}
          />
          <label>Data de vencimento:</label>
          <input
            type="date"
            value={novaData}
            onChange={(e) => setNovaData(e.target.value)}
            style={{ padding: "8px", marginBottom: "10px" }}
          />
          <button onClick={adicionarFatura} style={{ padding: "10px", marginBottom: "10px" }}>
            Adicionar fatura
          </button>

          {faturas.length > 0 && (
            <ul>
              {faturas.map((f, index) => (
                <li key={index}>
                  R$ {f.valor.toFixed(2)} - Vencimento: {f.vencimento}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <button onClick={finalizar} style={{ padding: "10px", marginTop: "20px" }}>
        Finalizar
      </button>
    </div>
  );
}
