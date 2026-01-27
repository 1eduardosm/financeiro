import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

export default function Compras() {
  const navigate = useNavigate();

  // Estados de Controle
  const [contasDisponiveis, setContasDisponiveis] = useState<any[]>([]);
  const [contaSelecionada, setContaSelecionada] = useState("");
  const [modo, setModo] = useState<"compra" | "fatura" | null>(null);

  // Estados para Modo COMPRA
  const [nomeCompra, setNomeCompra] = useState("");
  const [valorTotal, setValorTotal] = useState<number>(0);
  const [qtdParcelas, setQtdParcelas] = useState<number>(1);
  const [dataPrimeira, setDataPrimeira] = useState("");

  // Estados para Modo FATURA
  const [valorFatura, setValorFatura] = useState<number>(0);
  const [dataFatura, setDataFatura] = useState("");

  // Carregar contas do usuário
  useEffect(() => {
    const carregarData = async () => {
      const user = auth.currentUser;
      if (!user) return navigate("/login");
      const docSnap = await getDoc(doc(db, "usuarios", user.uid));
      if (docSnap.exists()) setContasDisponiveis(docSnap.data().contas || []);
    };
    carregarData();
  }, [navigate]);

  const processarLançamento = async () => {
    const user = auth.currentUser;
    if (!user || !contaSelecionada || !modo) return alert("Selecione a conta e o modo.");

    try {
      const novasContas = [...contasDisponiveis];
      const idx = novasContas.findIndex(c => c.nome === contaSelecionada);
      if (idx === -1) return;

      if (modo === "compra") {
        if (!nomeCompra || !valorTotal || !dataPrimeira) return alert("Preencha os dados da compra.");
        const valorParcela = valorTotal / qtdParcelas;

        for (let i = 0; i < qtdParcelas; i++) {
          const data = new Date(dataPrimeira + "T00:00:00");
          data.setMonth(data.getMonth() + i);
          const mesAno = data.toISOString().slice(0, 7);
          
          adicionarOuAtualizarFatura(novasContas[idx], mesAno, valorParcela, nomeCompra, i + 1, qtdParcelas);
        }
      } else {
        if (!valorFatura || !dataFatura) return alert("Preencha os dados da fatura.");
        const mesAno = dataFatura.slice(0, 7);
        adicionarOuAtualizarFatura(novasContas[idx], mesAno, valorFatura, "Saldo Anterior / Fatura");
      }

      await updateDoc(doc(db, "usuarios", user.uid), { contas: novasContas });
      alert("Lançamento realizado!");
      navigate("/Dashboard");
    } catch (e: any) {
      alert("Erro: " + e.message);
    }
  };

  // Função auxiliar para manter o padrão de dados da sua Dashboard
  const adicionarOuAtualizarFatura = (conta: any, mesAno: string, valor: number, nome: string, pAtual = 1, pTotal = 1) => {
    let f = conta.faturas.find((fat: any) => fat.mesAno === mesAno);
    const novoItem = { nome, valorOriginal: valor, parcelaAtual: pAtual, totalParcelas: pTotal };

    if (f) {
      f.valorTotal += valor;
      f.itens.push(novoItem);
    } else {
      conta.faturas.push({
        mesAno,
        valorTotal: valor,
        pago: false,
        itens: [novoItem],
        detalhesPagamento: []
      });
    }
  };

  return (
    <div style={styles.container}>
      <h1>Novo Lançamento</h1>
      
      <div style={styles.card}>
        <label>Selecione a Conta</label>
        <select value={contaSelecionada} onChange={e => setContaSelecionada(e.target.value)} style={styles.input}>
          <option value="">Escolha...</option>
          {contasDisponiveis.map((c, i) => <option key={i} value={c.nome}>{c.nome}</option>)}
        </select>

        {contaSelecionada && !modo && (
          <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
            <button onClick={() => setModo("compra")} style={styles.btn}>Lançar Compra</button>
            <button onClick={() => setModo("fatura")} style={styles.btn}>Lançar Fatura</button>
          </div>
        )}

        {modo === "compra" && (
          <div style={{ marginTop: "20px" }}>
            <h3>Nova Compra Parcelada</h3>
            <input type="text" placeholder="Nome" value={nomeCompra} onChange={e => setNomeCompra(e.target.value)} style={styles.input} />
            <input type="number" placeholder="Valor Total" value={valorTotal || ""} onChange={e => setValorTotal(Number(e.target.value))} style={styles.input} />
            <input type="number" placeholder="Parcelas" value={qtdParcelas} onChange={e => setQtdParcelas(Number(e.target.value))} style={styles.input} />
            <input type="date" value={dataPrimeira} onChange={e => setDataPrimeira(e.target.value)} style={styles.input} />
          </div>
        )}

        {modo === "fatura" && (
          <div style={{ marginTop: "20px" }}>
            <h3>Lançar Fatura Fechada</h3>
            <input type="number" placeholder="Valor Total" value={valorFatura || ""} onChange={e => setValorFatura(Number(e.target.value))} style={styles.input} />
            <input type="date" value={dataFatura} onChange={e => setDataFatura(e.target.value)} style={styles.input} />
          </div>
        )}

        {modo && (
          <>
            <button onClick={processarLançamento} style={styles.btnBlue}>Salvar Lançamento</button>
            <button onClick={() => setModo(null)} style={styles.btnGhost}>Trocar Modo</button>
          </>
        )}
      </div>
    </div>
  );
}

const styles: any = {
  container: { maxWidth: "500px", margin: "40px auto", padding: "20px", fontFamily: "sans-serif" },
  card: { border: "1px solid #ddd", padding: "20px", borderRadius: "12px", background: "#fff" },
  input: { width: "100%", padding: "10px", marginBottom: "15px", borderRadius: "6px", border: "1px solid #ccc", boxSizing: "border-box" },
  btn: { flex: 1, padding: "10px", cursor: "pointer", borderRadius: "6px", border: "1px solid #007bff", background: "#fff", color: "#007bff" },
  btnBlue: { width: "100%", padding: "12px", background: "#007bff", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" },
  btnGhost: { width: "100%", padding: "10px", background: "transparent", color: "#666", border: "none", cursor: "pointer", fontSize: "12px" }
};