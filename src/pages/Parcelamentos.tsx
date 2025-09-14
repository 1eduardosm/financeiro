import { useState } from "react";
import { db, auth } from "../firebase";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

interface Parcela {
  valor: number;
  vencimento?: string; // opcional
}

interface Compra {
  nome: string;
  parcelas: Parcela[];
}

interface Fatura {
  valor: number;
  vencimento: string;
}

interface Cartao {
  nome: string;
  faturas: Fatura[];
}

export default function Parcelamentos() {
  const [modo, setModo] = useState<"compra" | "fatura">("compra");

  // Estado para compras
  const [compras, setCompras] = useState<Compra[]>([]);
  const [novaCompraNome, setNovaCompraNome] = useState("");
  const [parcelasCompra, setParcelasCompra] = useState<Parcela[]>([]);
  const [novoValorParcela, setNovoValorParcela] = useState(0);

  // Estado para faturas
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [novoCartaoNome, setNovoCartaoNome] = useState("");
  const [cartaoSelecionado, setCartaoSelecionado] = useState<number | null>(null);
  const [novoValorFatura, setNovoValorFatura] = useState(0);
  const [novaDataFatura, setNovaDataFatura] = useState("");

  const navigate = useNavigate();

  const salvarCompra = async (compra: Compra) => {
    const user = auth.currentUser;
    if (!user) {
      alert("Usuário não logado!");
      navigate("/login");
      return;
    }
    try {
      await updateDoc(doc(db, "usuarios", user.uid), {
        compras: arrayUnion(compra),
        parcelamentosAtivos: true,
      });
    } catch (error: any) {
      alert("Erro ao salvar compra: " + error.message);
    }
  };

  const salvarCartao = async (cartao: Cartao) => {
    const user = auth.currentUser;
    if (!user) {
      alert("Usuário não logado!");
      navigate("/login");
      return;
    }
    try {
      await updateDoc(doc(db, "usuarios", user.uid), {
        parcelamentos: arrayUnion(cartao),
        parcelamentosAtivos: true,
      });
    } catch (error: any) {
      alert("Erro ao salvar cartão: " + error.message);
    }
  };

  // Funções Compras
  const adicionarParcelaCompra = () => {
    if (!novoValorParcela) return;
    setParcelasCompra([...parcelasCompra, { valor: novoValorParcela }]);
    setNovoValorParcela(0);
  };

  const adicionarCompra = () => {
    if (!novaCompraNome || parcelasCompra.length === 0) return;
    const nova = { nome: novaCompraNome, parcelas: parcelasCompra };
    setCompras([...compras, nova]);
    salvarCompra(nova);
    setNovaCompraNome("");
    setParcelasCompra([]);
  };

  // Funções Faturas
  const adicionarCartao = () => {
    if (!novoCartaoNome) return;
    const novo = { nome: novoCartaoNome, faturas: [] };
    setCartoes([...cartoes, novo]);
    setNovoCartaoNome("");
  };

  const adicionarFatura = () => {
    if (cartaoSelecionado === null || !novoValorFatura || !novaDataFatura) return;
    const updatedCartoes = [...cartoes];
    updatedCartoes[cartaoSelecionado].faturas.push({ valor: novoValorFatura, vencimento: novaDataFatura });
    setCartoes(updatedCartoes);
    salvarCartao(updatedCartoes[cartaoSelecionado]);
    setNovoValorFatura(0);
    setNovaDataFatura("");
  };

  const finalizar = () => {
    alert("Parcelamentos salvos!");
    navigate("/dashboard");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "500px", margin: "50px auto" }}>
      <h1>Parcelamentos</h1>

      <div style={{ marginBottom: "20px" }}>
        <button onClick={() => setModo("compra")} style={{ marginRight: "10px" }}>
          Informar por compra
        </button>
        <button onClick={() => setModo("fatura")}>Informar por fatura</button>
      </div>

      {modo === "compra" && (
        <div style={{ border: "1px solid #ccc", padding: "15px", borderRadius: "8px" }}>
          <h2>Nova Compra</h2>
          <label>Nome da compra:</label>
          <input
            type="text"
            value={novaCompraNome}
            onChange={(e) => setNovaCompraNome(e.target.value)}
            style={{ padding: "8px", marginBottom: "10px", width: "100%" }}
          />
          <label>Adicionar parcelas:</label>
          <input
            type="number"
            value={novoValorParcela}
            onChange={(e) => setNovoValorParcela(Number(e.target.value))}
            style={{ padding: "8px", marginBottom: "10px", width: "100%" }}
          />
          <button onClick={adicionarParcelaCompra} style={{ padding: "10px", marginBottom: "10px" }}>
            Adicionar parcela
          </button>
          {parcelasCompra.length > 0 && (
            <ul>
              {parcelasCompra.map((p, i) => (
                <li key={i}>R$ {p.valor.toFixed(2)}</li>
              ))}
            </ul>
          )}
          <button onClick={adicionarCompra} style={{ padding: "10px", marginTop: "10px" }}>
            Salvar compra
          </button>

          {compras.length > 0 && (
            <>
              <h3>Compras adicionadas:</h3>
              <ul>
                {compras.map((c, idx) => (
                  <li key={idx}>
                    {c.nome} - Parcelas: {c.parcelas.map((p) => `R$${p.valor.toFixed(2)}`).join(", ")}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {modo === "fatura" && (
        <div style={{ border: "1px solid #ccc", padding: "15px", borderRadius: "8px" }}>
          <h2>Adicionar Cartão</h2>
          <input
            type="text"
            placeholder="Nome do cartão"
            value={novoCartaoNome}
            onChange={(e) => setNovoCartaoNome(e.target.value)}
            style={{ padding: "8px", marginBottom: "10px", width: "100%" }}
          />
          <button onClick={adicionarCartao} style={{ padding: "10px", marginBottom: "10px" }}>
            Adicionar cartão
          </button>

          {cartoes.length > 0 && (
            <>
              <label>Selecionar cartão:</label>
              <select
                value={cartaoSelecionado ?? ""}
                onChange={(e) => setCartaoSelecionado(Number(e.target.value))}
                style={{ padding: "8px", marginBottom: "10px", width: "100%" }}
              >
                <option value="" disabled>
                  -- Escolha um cartão --
                </option>
                {cartoes.map((c, i) => (
                  <option key={i} value={i}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </>
          )}

          {cartaoSelecionado !== null && (
            <div>
              <label>Valor da fatura:</label>
              <input
                type="number"
                value={novoValorFatura}
                onChange={(e) => setNovoValorFatura(Number(e.target.value))}
                style={{ padding: "8px", marginBottom: "10px", width: "100%" }}
              />
              <label>Data de vencimento:</label>
              <input
                type="date"
                value={novaDataFatura}
                onChange={(e) => setNovaDataFatura(e.target.value)}
                style={{ padding: "8px", marginBottom: "10px", width: "100%" }}
              />
              <button onClick={adicionarFatura} style={{ padding: "10px", marginBottom: "10px" }}>
                Adicionar fatura
              </button>

              <ul>
                {cartoes[cartaoSelecionado].faturas.map((f, idx) => (
                  <li key={idx}>
                    R$ {f.valor.toFixed(2)} - Vencimento: {f.vencimento}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {cartoes.length > 0 && (
            <>
              <h3>Cartões adicionados:</h3>
              <ul>
                {cartoes.map((c, idx) => (
                  <li key={idx}>
                    {c.nome} - Faturas:{" "}
                    {c.faturas.map((f) => `R$${f.valor.toFixed(2)} (${f.vencimento})`).join(", ")}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <button onClick={finalizar} style={{ padding: "10px", marginTop: "20px" }}>
        Finalizar
      </button>
    </div>
  );
}
