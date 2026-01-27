import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

export default function Compras() {
  const navigate = useNavigate();

  // Estados para a nova compra
  const [nomeCompra, setNomeCompra] = useState("");
  const [valorTotal, setValorTotal] = useState<number>(0);
  const [qtdParcelas, setQtdParcelas] = useState<number>(1);
  const [dataPrimeira, setDataPrimeira] = useState("");
  const [contaSelecionada, setContaSelecionada] = useState("");
  
  // Estado para carregar as contas do usuário
  const [contasDisponiveis, setContasDisponiveis] = useState<any[]>([]);

  // Carregar contas ao abrir a página
  useState(() => {
    const carregarContas = async () => {
      const user = auth.currentUser;
      if (!user) return navigate("/login");
      const docRef = doc(db, "usuarios", user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setContasDisponiveis(docSnap.data().contas || []);
      }
    };
    carregarContas();
  });

  const salvarCompraParcelada = async () => {
    const user = auth.currentUser;
    if (!user || !nomeCompra || !valorTotal || !dataPrimeira || !contaSelecionada) {
      return alert("Preencha todos os campos!");
    }

    try {
      const valorParcela = valorTotal / qtdParcelas;
      const novasContas = [...contasDisponiveis];
      const indexConta = novasContas.findIndex(c => c.nome === contaSelecionada);

      if (indexConta === -1) return;

      // Gerar as parcelas automaticamente (Lógica Dashboard)
      for (let i = 0; i < qtdParcelas; i++) {
        const data = new Date(dataPrimeira + "T00:00:00");
        data.setMonth(data.getMonth() + i);
        const mesAno = data.toISOString().slice(0, 7); // Formato YYYY-MM

        // Encontrar ou criar a fatura para aquele mês
        let fatura = novasContas[indexConta].faturas.find((f: any) => f.mesAno === mesAno);
        
        const novoItem = {
          nome: nomeCompra,
          valorOriginal: valorParcela,
          parcelaAtual: i + 1,
          totalParcelas: qtdParcelas
        };

        if (fatura) {
          fatura.valorTotal += valorParcela;
          fatura.itens.push(novoItem);
        } else {
          novasContas[indexConta].faturas.push({
            mesAno,
            valorTotal: valorParcela,
            pago: false,
            itens: [novoItem],
            detalhesPagamento: []
          });
        }
      }

      // Atualizar no Firebase
      await updateDoc(doc(db, "usuarios", user.uid), {
        contas: novasContas
      });

      alert("Compra parcelada lançada com sucesso!");
      navigate("/Dashboard");
    } catch (error: any) {
      alert("Erro ao salvar: " + error.message);
    }
  };

  return (
    <div style={styles.container}>
      <h1>Lançar Compra Parcelada</h1>
      
      <div style={styles.card}>
        <label>Nome da Compra</label>
        <input type="text" placeholder="Ex: Supermercado" value={nomeCompra} onChange={e => setNomeCompra(e.target.value)} style={styles.input} />

        <label>Valor Total</label>
        <input type="number" placeholder="R$ 0,00" value={valorTotal || ""} onChange={e => setValorTotal(Number(e.target.value))} style={styles.input} />

        <label>Quantidade de Parcelas</label>
        <input type="number" value={qtdParcelas} onChange={e => setQtdParcelas(Number(e.target.value))} style={styles.input} />

        <label>Data da 1ª Parcela</label>
        <input type="date" value={dataPrimeira} onChange={e => setDataPrimeira(e.target.value)} style={styles.input} />

        <label>Selecionar Conta/Cartão</label>
        <select value={contaSelecionada} onChange={e => setContaSelecionada(e.target.value)} style={styles.input}>
          <option value="">Selecione uma conta...</option>
          {contasDisponiveis.map((c, i) => (
            <option key={i} value={c.nome}>{c.nome}</option>
          ))}
        </select>

        <button onClick={salvarCompraParcelada} style={styles.btnBlue}>Confirmar Compra</button>
        <button onClick={() => navigate("/Dashboard")} style={styles.btnGhost}>Cancelar</button>
      </div>
    </div>
  );
}

const styles: any = {
  container: { maxWidth: "500px", margin: "40px auto", padding: "20px", fontFamily: "sans-serif" },
  card: { border: "1px solid #ddd", padding: "20px", borderRadius: "12px", background: "#fff", boxShadow: "0 4px 6px rgba(0,0,0,0.1)" },
  input: { width: "100%", padding: "12px", marginBottom: "15px", boxSizing: "border-box", borderRadius: "6px", border: "1px solid #ccc" },
  btnBlue: { width: "100%", padding: "12px", background: "#007bff", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "16px", fontWeight: "bold" },
  btnGhost: { width: "100%", padding: "10px", background: "transparent", color: "#666", border: "none", marginTop: "10px", cursor: "pointer" }
};