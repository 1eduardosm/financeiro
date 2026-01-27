import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import { doc, setDoc } from "firebase/firestore";

interface Parcela {
  valor: number;
  vencimento: string;
  numeroParcela: number; // Adicionado para controle
  totalParcelas: number;  // Adicionado para controle
}

interface Compra {
  nome: string;
  parcelas: Parcela[];
}

interface FaturaSimples {
  valor: number;
  vencimento: string;
}

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

  const [contas, setContas] = useState<Conta[]>([]);
  const [contaAtualIndex, setContaAtualIndex] = useState<number | null>(null);

  const [novaContaNome, setNovaContaNome] = useState("");
  const [novoSaldo, setNovoSaldo] = useState<number>(0);
  const [novoTemParcelamentos, setNovoTemParcelamentos] = useState(false);

  // Estados para Modo Compra (Atualizados)
  const [novaCompraNome, setNovaCompraNome] = useState("");
  const [valorTotalCompra, setValorTotalCompra] = useState<number>(0);
  const [qtdParcelas, setQtdParcelas] = useState<number>(1);
  const [parcelasPagas, setParcelasPagas] = useState<number>(0);
  const [jurosPorcento, setJurosPorcento] = useState<number>(0);
  const [novaDataParcela, setNovaDataParcela] = useState<string>("");

  // Estados para Modo Fatura
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

  const selecionarModo = (modo: "compra" | "fatura") => {
    if (contaAtualIndex === null) return;
    const novasContas = [...contas];
    novasContas[contaAtualIndex].modo = modo;
    setContas(novasContas);
  };

  const gerarParcelasAutomaticas = () => {
    if (!valorTotalCompra || !novaDataParcela || qtdParcelas <= 0) {
      return alert("Preencha valor total, data e parcelas.");
    }

    const valorComJuros = valorTotalCompra * (1 + jurosPorcento / 100);
    const valorDaParcela = valorComJuros / qtdParcelas;
    const novasParcelas: Parcela[] = [];

    // Começa a gerar a partir da primeira parcela que NÃO está paga
    for (let i = 0; i < qtdParcelas; i++) {
      const numeroAtual = i + 1;

      if (numeroAtual > parcelasPagas) {
        const dataRef = new Date(novaDataParcela + "T00:00:00");
        dataRef.setMonth(dataRef.getMonth() + (i - parcelasPagas));
        
        novasParcelas.push({
          valor: valorDaParcela,
          vencimento: dataRef.toISOString().slice(0, 10),
          numeroParcela: numeroAtual,
          totalParcelas: qtdParcelas
        });
      }
    }

    if (contaAtualIndex === null) return;
    const novasContas = [...contas];
    novasContas[contaAtualIndex].compras!.push({ 
      nome: novaCompraNome, 
      parcelas: novasParcelas 
    });

    setContas(novasContas);
    setNovaCompraNome("");
    setValorTotalCompra(0);
    setQtdParcelas(1);
    setParcelasPagas(0);
    setJurosPorcento(0);
    setNovaDataParcela("");
    alert("Compra parcelada adicionada!");
  };

  const adicionarFatura = () => {
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
              mesAno,
              valorTotal: valor,
              pago: false,
              itens: [novoItem],
              detalhesPagamento: []
            });
          }
        };

        conta.compras?.forEach((c) => {
          c.parcelas.forEach((p) => {
            const mesAno = p.vencimento.slice(0, 7);
            processarItem(mesAno, p.valor, c.nome, p.numeroParcela, p.totalParcelas);
          });
        });

        conta.faturas?.forEach((f) => {
          const mesAno = f.vencimento.slice(0, 7);
          processarItem(mesAno, f.valor, "Saldo Anterior / Fatura");
        });

        return { nome: conta.nome, saldo: conta.saldo, faturas: faturasMapeadas };
      });

      await setDoc(doc(db, "usuarios", user.uid), {
        contas: contasProcessadas,
        entradas: [],
        jaFezSetup: true,
        dataSetup: new Date().toISOString()
      }, { merge: true });

      alert("Configuração finalizada!");
      navigate("/Dashboard");
    } catch (error: any) {
      alert("Erro ao salvar: " + error.message);
    }
  };

  const contaAtual = contaAtualIndex !== null ? contas[contaAtualIndex] : null;

  return (
    <div style={{ maxWidth: "600px", margin: "40px auto", padding: "20px", fontFamily: "sans-serif" }}>
      <h1>Configuração Inicial</h1>

      <div style={styles.card}>
        <h2>1. Adicionar Conta</h2>
        <input type="text" placeholder="Nome (Ex: Nubank)" value={novaContaNome} onChange={(e) => setNovaContaNome(e.target.value)} style={styles.input} />
        <input type="number" placeholder="Saldo Atual R$" value={novoSaldo || ""} onChange={(e) => setNovoSaldo(Number(e.target.value))} style={styles.input} />
        <label style={{ display: "block", marginBottom: "10px" }}>
          <input type="checkbox" checked={novoTemParcelamentos} onChange={(e) => setNovoTemParcelamentos(e.target.checked)} /> Tem parcelamentos/faturas?
        </label>
        <button onClick={adicionarConta} style={styles.btnBlue}>Salvar Conta</button>
      </div>

      {contas.length > 0 && (
        <div style={{ marginBottom: "20px" }}>
          <h3>Contas cadastradas: {contas.map(c => c.nome).join(", ")}</h3>
          <select value={contaAtualIndex ?? ""} onChange={(e) => setContaAtualIndex(Number(e.target.value))} style={styles.input}>
            {contas.map((c, i) => <option key={i} value={i}>{c.nome}</option>)}
          </select>
        </div>
      )}

      {contaAtual?.temParcelamentos && (
        <div style={styles.card}>
          <h3>Lançamentos: {contaAtual.nome}</h3>
          {!contaAtual.modo ? (
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => selecionarModo("compra")} style={styles.btn}>Lançar Compra</button>
              <button onClick={() => selecionarModo("fatura")} style={styles.btn}>Lançar Fatura</button>
            </div>
          ) : (
            <div>
              <p>Modo: <strong>{contaAtual.modo}</strong> <button onClick={() => selecionarModo(undefined as any)} style={{fontSize:10}}>trocar</button></p>
              
              {contaAtual.modo === "compra" ? (
                <div>
                  <input type="text" placeholder="Produto/Loja" value={novaCompraNome} onChange={e => setNovaCompraNome(e.target.value)} style={styles.input} />
                  <input type="number" placeholder="Valor Total da Compra" value={valorTotalCompra || ""} onChange={e => setValorTotalCompra(Number(e.target.value))} style={styles.input} />
                  <input type="number" placeholder="Juros Total %" value={jurosPorcento || ""} onChange={e => setJurosPorcento(Number(e.target.value))} style={styles.input} />
                  <div style={{ display: "flex", gap: 10 }}>
                    <div style={{flex: 1}}><label style={{fontSize: 12}}>Total Parcelas</label><input type="number" value={qtdParcelas} onChange={e => setQtdParcelas(Number(e.target.value))} style={styles.input} /></div>
                    <div style={{flex: 1}}><label style={{fontSize: 12}}>Já pagas</label><input type="number" value={parcelasPagas} onChange={e => setParcelasPagas(Number(e.target.value))} style={styles.input} /></div>
                  </div>
                  <label style={{fontSize: 12}}>Vencimento da Próxima Parcela</label>
                  <input type="date" value={novaDataParcela} onChange={e => setNovaDataParcela(e.target.value)} style={styles.input} />
                  
                  <button onClick={gerarParcelasAutomaticas} style={styles.btnBlue}>Confirmar Compra Parcelada</button>
                  <ul style={{marginTop: 10}}>
                    {contaAtual.compras?.map((c, i) => (
                      <li key={i}>{c.nome}: {c.parcelas.length} parcelas restantes</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div>
                  <input type="number" placeholder="Valor Total Fatura" value={novoValorFatura || ""} onChange={e => setNovoValorFatura(Number(e.target.value))} style={styles.input} />
                  <input type="date" value={novaDataFatura} onChange={e => setNovaDataFatura(e.target.value)} style={styles.input} />
                  <button onClick={adicionarFatura} style={styles.btnBlue}>Add Fatura</button>
                  <ul>{contaAtual.faturas?.map((f, i) => <li key={i}>R$ {f.valor} - {f.vencimento}</li>)}</ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {contas.length > 0 && (
        <button onClick={finalizarSetup} style={styles.btnFinalizar}>Finalizar e ir para Dashboard</button>
      )}
    </div>
  );
}

const styles: any = {
  card: { border: "1px solid #ddd", padding: "15px", borderRadius: "8px", marginBottom: "20px", background: "#fff" },
  input: { width: "100%", padding: "10px", marginBottom: "10px", boxSizing: "border-box", borderRadius: "4px", border: "1px solid #ccc" },
  btn: { padding: "10px", cursor: "pointer", flex: 1 },
  btnBlue: { width: "100%", padding: "10px", background: "#007bff", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" },
  btnFinalizar: { width: "100%", padding: "15px", background: "#28a745", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "16px", fontWeight: "bold" }
};