import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import { doc, setDoc } from "firebase/firestore";

// Interfaces baseadas no seu código original
interface Parcela { valor: number; vencimento: string; }
interface Compra { nome: string; parcelas: Parcela[]; }
interface FaturaSimples { valor: number; vencimento: string; }
interface Conta {
  nome: string;
  saldo: number;
  temParcelamentos: boolean;
  modo?: "compra" | "fatura";
  compras?: Compra[];
  faturas?: FaturaSimples[];
}

export default function Setup() {
  const navigate = useNavigate();

  // Estados da Conta
  const [contas, setContas] = useState<Conta[]>([]);
  const [contaAtualIndex, setContaAtualIndex] = useState<number | null>(null);
  const [novaContaNome, setNovaContaNome] = useState("");
  const [novoSaldo, setNovoSaldo] = useState<number>(0);
  const [novoTemParcelamentos, setNovoTemParcelamentos] = useState(false);

  // Estados para modo COMPRA
  const [novaCompraNome, setNovaCompraNome] = useState("");
  const [novoValorParcela, setNovoValorParcela] = useState<number>(0);
  const [novaDataParcela, setNovaDataParcela] = useState<string>("");
  const [parcelasCompra, setParcelasCompra] = useState<Parcela[]>([]);

  // Estados para modo FATURA
  const [novoValorFatura, setNovoValorFatura] = useState<number>(0);
  const [novaDataFatura, setNovaDataFatura] = useState<string>("");

  const adicionarConta = () => {
    if (!novaContaNome) return alert("Preencha o nome da conta.");
    const novaConta: Conta = {
      nome: novaContaNome,
      saldo: novoSaldo,
      temParcelamentos: novoTemParcelamentos,
      compras: [],
      faturas: [],
    };
    const novasContas = [...contas, novaConta];
    setContas(novasContas);
    setContaAtualIndex(novasContas.length - 1);
    setNovaContaNome("");
    setNovoSaldo(0);
    setNovoTemParcelamentos(false);
  };

  const selecionarModo = (modo: "compra" | "fatura" | undefined) => {
    if (contaAtualIndex === null) return;
    const novasContas = [...contas];
    novasContas[contaAtualIndex].modo = modo;
    setContas(novasContas);
  };

  const adicionarParcelaManual = () => {
    if (!novoValorParcela || !novaDataParcela) return alert("Preencha valor e data.");
    setParcelasCompra([...parcelasCompra, { valor: novoValorParcela, vencimento: novaDataParcela }]);
    setNovoValorParcela(0);
    setNovaDataParcela("");
  };

  const salvarCompraNaConta = () => {
    if (!novaCompraNome || parcelasCompra.length === 0) return alert("Dados incompletos.");
    if (contaAtualIndex === null) return;
    const novasContas = [...contas];
    novasContas[contaAtualIndex].compras!.push({ nome: novaCompraNome, parcelas: parcelasCompra });
    setContas(novasContas);
    setNovaCompraNome("");
    setParcelasCompra([]);
  };

  const adicionarFaturaNaConta = () => {
    if (!novoValorFatura || !novaDataFatura) return alert("Dados incompletos.");
    if (contaAtualIndex === null) return;
    const novasContas = [...contas];
    novasContas[contaAtualIndex].faturas!.push({ valor: novoValorFatura, vencimento: novaDataFatura });
    setContas(novasContas);
    setNovoValorFatura(0);
    setNovaDataFatura("");
  };

  const finalizarSetup = async () => {
    const user = auth.currentUser;
    if (!user) return navigate("/login");

    try {
      const contasProcessadas = contas.map((conta) => {
        const faturasMapeadas: any[] = [];

        const processarItem = (mesAno: string, valor: number, itemNome: string, pAtual = 1, pTotal = 1) => {
          let f = faturasMapeadas.find((fat) => fat.mesAno === mesAno);
          const novoItem = { nome: itemNome, valorOriginal: valor, parcelaAtual: pAtual, totalParcelas: pTotal };
          if (f) {
            f.valorTotal += valor;
            f.itens.push(novoItem);
          } else {
            faturasMapeadas.push({
              mesAno, valorTotal: valor, pago: false, itens: [novoItem], detalhesPagamento: []
            });
          }
        };

        conta.compras?.forEach((c) => {
          c.parcelas.forEach((p, idx) => {
            processarItem(p.vencimento.slice(0, 7), p.valor, c.nome, idx + 1, c.parcelas.length);
          });
        });

        conta.faturas?.forEach((f) => {
          processarItem(f.vencimento.slice(0, 7), f.valor, "Saldo Anterior / Fatura");
        });

        return { nome: conta.nome, saldo: conta.saldo, faturas: faturasMapeadas };
      });

      await setDoc(doc(db, "usuarios", user.uid), {
        contas: contasProcessadas,
        entradas: [],
        jaFezSetup: true,
        dataSetup: new Date().toISOString()
      }, { merge: true });

      alert("Configuração salva!");
      navigate("/Dashboard");
    } catch (error: any) {
      alert("Erro ao salvar: " + error.message);
    }
  };

  const contaAtual = contaAtualIndex !== null ? contas[contaAtualIndex] : null;

  return (
    <div style={styles.container}>
      <h1>Configuração de Contas</h1>

      {/* 1. CRIAÇÃO DA CONTA */}
      <div style={styles.section}>
        <h2>1. Criar Nova Conta</h2>
        <input type="text" placeholder="Nome da Conta" value={novaContaNome} onChange={(e) => setNovaContaNome(e.target.value)} style={styles.input} />
        <input type="number" placeholder="Saldo Inicial" value={novoSaldo || ""} onChange={(e) => setNovoSaldo(Number(e.target.value))} style={styles.input} />
        <label style={{ display: "block", marginBottom: "10px" }}>
          <input type="checkbox" checked={novoTemParcelamentos} onChange={(e) => setNovoTemParcelamentos(e.target.checked)} /> Possui Fatura/Parcelas?
        </label>
        <button onClick={adicionarConta} style={styles.btnBlue}>Criar Conta</button>
      </div>

      {/* 2. LISTA DE CONTAS PARA SELECIONAR */}
      {contas.length > 0 && (
        <div style={{ marginBottom: "20px" }}>
          <h3>Contas Prontas: {contas.map(c => c.nome).join(", ")}</h3>
          <p>Selecione uma conta abaixo para adicionar gastos:</p>
          <select value={contaAtualIndex ?? ""} onChange={(e) => setContaAtualIndex(Number(e.target.value))} style={styles.input}>
            {contas.map((c, i) => <option key={i} value={i}>{c.nome}</option>)}
          </select>
        </div>
      )}

      {/* 3. ADICIONAR GASTOS À CONTA SELECIONADA */}
      {contaAtual?.temParcelamentos && (
        <div style={styles.section}>
          <h3>Lançamentos para: {contaAtual.nome}</h3>
          {!contaAtual.modo ? (
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => selecionarModo("compra")} style={styles.btn}>Modo Compra</button>
              <button onClick={() => selecionarModo("fatura")} style={styles.btn}>Modo Fatura</button>
            </div>
          ) : (
            <div>
              <p>Modo: <strong>{contaAtual.modo}</strong> <button onClick={() => selecionarModo(undefined)} style={{fontSize:10}}>trocar</button></p>
              
              {contaAtual.modo === "compra" ? (
                <div>
                  <input type="text" placeholder="Item comprado" value={novaCompraNome} onChange={e => setNovaCompraNome(e.target.value)} style={styles.input} />
                  <div style={{ display: "flex", gap: 5 }}>
                    <input type="number" placeholder="Valor" value={novoValorParcela || ""} onChange={e => setNovoValorParcela(Number(e.target.value))} style={styles.input} />
                    <input type="date" value={novaDataParcela} onChange={e => setNovaDataParcela(e.target.value)} style={styles.input} />
                    <button onClick={adicionarParcelaManual}>+</button>
                  </div>
                  <ul>{parcelasCompra.map((p, i) => <li key={i}>R$ {p.valor} - {p.vencimento}</li>)}</ul>
                  <button onClick={salvarCompraNaConta} style={styles.btnBlue}>Confirmar Compra nesta Conta</button>
                </div>
              ) : (
                <div>
                  <input type="number" placeholder="Valor Total Fatura" value={novoValorFatura || ""} onChange={e => setNovoValorFatura(Number(e.target.value))} style={styles.input} />
                  <input type="date" value={novaDataFatura} onChange={e => setNovaDataFatura(e.target.value)} style={styles.input} />
                  <button onClick={adicionarFaturaNaConta} style={styles.btnBlue}>Adicionar Fatura</button>
                  <ul>{contaAtual.faturas?.map((f, i) => <li key={i}>R$ {f.valor} - {f.vencimento}</li>)}</ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {contas.length > 0 && (
        <button onClick={finalizarSetup} style={styles.btnFinalizar}>Finalizar Tudo e ir para Dashboard</button>
      )}
    </div>
  );
}

const styles: any = {
  container: { maxWidth: "600px", margin: "40px auto", padding: "20px", fontFamily: "sans-serif" },
  section: { border: "1px solid #ddd", padding: "15px", borderRadius: "8px", marginBottom: "20px", background: "#f9f9f9" },
  input: { width: "100%", padding: "10px", marginBottom: "10px", boxSizing: "border-box", borderRadius: "4px", border: "1px solid #ccc" },
  btn: { padding: "10px", cursor: "pointer", flex: 1 },
  btnBlue: { width: "100%", padding: "10px", background: "#007bff", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" },
  btnFinalizar: { width: "100%", padding: "15px", background: "#28a745", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "16px", fontWeight: "bold" }
};