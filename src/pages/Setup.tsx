import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import { doc, setDoc } from "firebase/firestore";

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

interface Conta {
  nome: string;
  saldo: number;
  temParcelamentos: boolean;
  modo?: "compra" | "fatura"; // definido apenas se temParcelamentos = true
  compras?: Compra[];
  faturas?: Fatura[];
}

export default function Setup() {
  const navigate = useNavigate();

  const [contas, setContas] = useState<Conta[]>([]);
  const [contaAtualIndex, setContaAtualIndex] = useState<number | null>(null);

  // Campos para criar nova conta
  const [novaContaNome, setNovaContaNome] = useState("");
  const [novoSaldo, setNovoSaldo] = useState<number>(0);
  const [novoTemParcelamentos, setNovoTemParcelamentos] = useState(false);

  // Campos para compras
  const [novaCompraNome, setNovaCompraNome] = useState("");
  const [novoValorParcela, setNovoValorParcela] = useState<number>(0);
  const [novaDataParcela, setNovaDataParcela] = useState<string>("");
  const [parcelasCompra, setParcelasCompra] = useState<Parcela[]>([]);

  // Campos para faturas
  const [novoValorFatura, setNovoValorFatura] = useState<number>(0);
  const [novaDataFatura, setNovaDataFatura] = useState<string>("");

  const adicionarConta = () => {
    if (!novaContaNome || novoSaldo === undefined) {
      return alert("Preencha o nome e saldo da conta.");
    }
    const novaConta: Conta = {
      nome: novaContaNome,
      saldo: novoSaldo,
      temParcelamentos: novoTemParcelamentos,
      compras: [],
      faturas: [],
    };
    setContas([...contas, novaConta]);
    setContaAtualIndex(contas.length);

    // reset campos
    setNovaContaNome("");
    setNovoSaldo(0);
    setNovoTemParcelamentos(false);
    setParcelasCompra([]);
    setNovaCompraNome("");
    setNovoValorFatura(0);
    setNovaDataFatura("");
  };

  const selecionarModo = (modo: "compra" | "fatura") => {
    if (contaAtualIndex === null) return;
    const novasContas = [...contas];
    novasContas[contaAtualIndex].modo = modo;
    setContas(novasContas);
  };

  // Funções compras
  const adicionarParcela = () => {
    if (!novoValorParcela || !novaDataParcela) {
      return alert("Preencha valor e data da parcela.");
    }
    setParcelasCompra([...parcelasCompra, { valor: novoValorParcela, vencimento: novaDataParcela }]);
    setNovoValorParcela(0);
    setNovaDataParcela("");
  };

  const salvarCompra = () => {
    if (!novaCompraNome || parcelasCompra.length === 0) {
      return alert("Preencha nome e parcelas da compra.");
    }
    if (contaAtualIndex === null) return;
    const novasContas = [...contas];
    const compra: Compra = { nome: novaCompraNome, parcelas: parcelasCompra };
    novasContas[contaAtualIndex].compras!.push(compra);
    setContas(novasContas);

    // reset campos
    setNovaCompraNome("");
    setParcelasCompra([]);
  };

  // Funções faturas
  const adicionarFatura = () => {
    if (!novoValorFatura || !novaDataFatura) {
      return alert("Preencha valor e data da fatura.");
    }
    if (contaAtualIndex === null) return;
    const novasContas = [...contas];
    novasContas[contaAtualIndex].faturas!.push({ valor: novoValorFatura, vencimento: novaDataFatura });
    setContas(novasContas);

    setNovoValorFatura(0);
    setNovaDataFatura("");
  };

  const finalizarSetup = async () => {
    const user = auth.currentUser;
    if (!user) {
      alert("Usuário não logado!");
      navigate("/login");
      return;
    }
    try {
      await setDoc(
        doc(db, "usuarios", user.uid),
        {
          contas,
          dataInicio: new Date().toISOString(),
        },
        { merge: true }
      );
      alert("Configuração salva com sucesso!");
      navigate("/dashboard");
    } catch (error: any) {
      console.error(error);
      alert("Erro ao salvar configuração: " + error.message);
    }
  };

  const contaAtual = contaAtualIndex !== null ? contas[contaAtualIndex] : null;

  return (
    <div style={{ maxWidth: "600px", margin: "50px auto", padding: "20px", display: "flex", flexDirection: "column" }}>
      <h1>Configuração Inicial</h1>

      {/* Criar nova conta */}
      <div style={{ border: "1px solid #ccc", padding: "15px", borderRadius: "8px", marginBottom: "20px" }}>
        <h2>Adicionar Conta</h2>
        <input
          type="text"
          placeholder="Nome da conta"
          value={novaContaNome}
          onChange={(e) => setNovaContaNome(e.target.value)}
          style={{ width: "100%", padding: "8px", marginBottom: "10px" }}
        />
        <input
          type="number"
          placeholder="Saldo inicial"
          value={novoSaldo}
          onChange={(e) => setNovoSaldo(Number(e.target.value))}
          style={{ width: "100%", padding: "8px", marginBottom: "10px" }}
        />
        <label style={{ marginBottom: "10px", display: "flex", alignItems: "center" }}>
          <input
            type="checkbox"
            checked={novoTemParcelamentos}
            onChange={(e) => setNovoTemParcelamentos(e.target.checked)}
            style={{ marginRight: "5px" }}
          />
          Tem parcelamentos ativos
        </label>
        <button onClick={adicionarConta} style={{ padding: "10px" }}>
          Salvar conta
        </button>
      </div>

      {/* Selecionar conta atual */}
      {contas.length > 0 && (
        <div style={{ marginBottom: "20px" }}>
          <h3>Contas criadas:</h3>
          <select
            value={contaAtualIndex ?? ""}
            onChange={(e) => setContaAtualIndex(Number(e.target.value))}
            style={{ padding: "8px", width: "100%" }}
          >
            <option value="" disabled>
              -- Selecione uma conta --
            </option>
            {contas.map((c, i) => (
              <option key={i} value={i}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Se conta selecionada tem parcelamentos, escolher modo */}
      {contaAtual && contaAtual.temParcelamentos && !contaAtual.modo && (
        <div style={{ marginBottom: "20px" }}>
          <h3>Como deseja informar os parcelamentos?</h3>
          <button onClick={() => selecionarModo("compra")} style={{ marginRight: "10px", padding: "10px" }}>
            Por compra
          </button>
          <button onClick={() => selecionarModo("fatura")} style={{ padding: "10px" }}>
            Por fatura
          </button>
        </div>
      )}

      {/* Formulário modo compra */}
      {contaAtual && contaAtual.modo === "compra" && (
        <div style={{ border: "1px solid #ccc", padding: "15px", borderRadius: "8px", marginBottom: "20px" }}>
          <h3>Adicionar Compra</h3>
          <input
            type="text"
            placeholder="Nome da compra"
            value={novaCompraNome}
            onChange={(e) => setNovaCompraNome(e.target.value)}
            style={{ width: "100%", padding: "8px", marginBottom: "10px" }}
          />
          <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
            <input
              type="number"
              placeholder="Valor da parcela"
              value={novoValorParcela}
              onChange={(e) => setNovoValorParcela(Number(e.target.value))}
              style={{ flex: 1, padding: "8px" }}
            />
            <input
              type="date"
              value={novaDataParcela}
              onChange={(e) => setNovaDataParcela(e.target.value)}
              style={{ flex: 1, padding: "8px" }}
            />
            <button onClick={adicionarParcela} style={{ padding: "8px" }}>
              Adicionar parcela
            </button>
          </div>
          {parcelasCompra.length > 0 && (
            <ul style={{ marginBottom: "10px" }}>
              {parcelasCompra.map((p, i) => (
                <li key={i}>
                  R$ {p.valor.toFixed(2)} - {p.vencimento}
                </li>
              ))}
            </ul>
          )}
          <button onClick={salvarCompra} style={{ padding: "10px" }}>
            Salvar compra
          </button>

          {contaAtual.compras && contaAtual.compras.length > 0 && (
            <>
              <h4>Compras adicionadas:</h4>
              <ul>
                {contaAtual.compras.map((c, i) => (
                  <li key={i}>
                    {c.nome} - Parcelas: {c.parcelas.map((p) => `R$${p.valor.toFixed(2)} (${p.vencimento})`).join(", ")}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {/* Formulário modo fatura */}
      {contaAtual && contaAtual.modo === "fatura" && (
        <div style={{ border: "1px solid #ccc", padding: "15px", borderRadius: "8px", marginBottom: "20px" }}>
          <h3>Adicionar Fatura</h3>
          <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
            <input
              type="number"
              placeholder="Valor da fatura"
              value={novoValorFatura}
              onChange={(e) => setNovoValorFatura(Number(e.target.value))}
              style={{ flex: 1, padding: "8px" }}
            />
            <input
              type="date"
              value={novaDataFatura}
              onChange={(e) => setNovaDataFatura(e.target.value)}
              style={{ flex: 1, padding: "8px" }}
            />
            <button onClick={adicionarFatura} style={{ padding: "8px" }}>
              Adicionar fatura
            </button>
          </div>
          {contaAtual.faturas && contaAtual.faturas.length > 0 && (
            <>
              <h4>Faturas adicionadas:</h4>
              <ul>
                {contaAtual.faturas.map((f, i) => (
                  <li key={i}>
                    R$ {f.valor.toFixed(2)} - Vencimento: {f.vencimento}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {contas.length > 0 && (
        <button onClick={finalizarSetup} style={{ padding: "12px", marginTop: "20px" }}>
          Finalizar Configuração
        </button>
      )}
    </div>
  );
}
