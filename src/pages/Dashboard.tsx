import { useEffect, useState, useMemo } from "react";
import { db, auth } from "../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";

export default function Dashboard() {
  const [contas, setContas] = useState<any[]>([]);
  const [entradas, setEntradas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [contasExpandidas, setContasExpandidas] = useState<Record<string, boolean>>({});
  const [cardsExpandidos, setCardsExpandidos] = useState<Record<string, boolean>>({
    entrada: false,
    saida: false,
    compra: false
  });

  // --- ESTADOS PARA O MODAL DE NOVA CONTA (ESTILO SETUP) ---
  const [modalNovaConta, setModalNovaConta] = useState(false);
  const [novaContaNome, setNovaContaNome] = useState("");
  const [novoSaldo, setNovoSaldo] = useState(0);
  const [novaChavePix, setNovaChavePix] = useState("");
  const [novoTemParcelamentos, setNovoTemParcelamentos] = useState(false);

  const [modoSetup, setModoSetup] = useState<"compra" | "fatura" | undefined>(undefined);
  const [comprasTemporarias, setComprasTemporarias] = useState<any[]>([]);
  const [faturasTemporarias, setFaturasTemporarias] = useState<any[]>([]);

  const [setupCompraNome, setSetupCompraNome] = useState("");
  const [setupValorTotal, setSetupValorTotal] = useState(0);
  const [setupQtdParc, setSetupQtdParc] = useState(1);
  const [setupParcPagas, setSetupParcPagas] = useState(0);
  const [setupJuros, setSetupJuros] = useState(0);
  const [setupDataParc, setSetupDataParc] = useState("");
  const [setupValFat, setSetupValFat] = useState(0);
  const [setupDatFat, setSetupDatFat] = useState("");
  // -------------------------------------------------------

  const [editPixInfo, setEditPixInfo] = useState<{ index: number, chave: string } | null>(null);
  const [modalHistorico, setModalHistorico] = useState(false);
  const [mesFiltroHistorico, setMesFiltroHistorico] = useState(new Date().toISOString().slice(0, 7));
  const [verDetalhes, setVerDetalhes] = useState<any[] | null>(null);

  const [valorEntrada, setValorEntrada] = useState<number>(0);
  const [descricaoEntrada, setDescricaoEntrada] = useState<string>("");
  const [contaEntradaId, setContaEntradaId] = useState<string>("");

  const [valorSaida, setValorSaida] = useState<number>(0);
  const [descricaoSaida, setDescricaoSaida] = useState<string>("");
  const [contaSaidaId, setContaSaidaId] = useState<string>("");

  const [compraNome, setCompraNome] = useState("");
  const [compraValorTotal, setCompraValorTotal] = useState(0);
  const [compraParcelas, setCompraParcelas] = useState(1);
  const [compraJuros, setCompraJuros] = useState(0);
  const [compraDataInicio, setCompraDataInicio] = useState(new Date().toISOString().slice(0, 7));
  const [compraContaId, setCompraContaId] = useState("");

  const [pagamentoFatura, setPagamentoFatura] = useState<any>(null);
  const [fontesDePagamento, setFontesDePagamento] = useState<any[]>([]);
  const [novoValor, setNovoValor] = useState<number>(0);
  const [novoTipo, setNovoTipo] = useState<'saldo' | 'terceiros'>('saldo');
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novaContaOrigemId, setNovaContaOrigemId] = useState('');

  const uid = auth.currentUser?.uid;
  const dataAtual = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    const carregar = async () => {
      if (!uid) return;
      try {
        const snap = await getDoc(doc(db, "usuarios", uid));
        if (snap.exists()) {
          const data = snap.data();
          const userContas = (data.contas ?? []).map((c: any) => ({
            ...c,
            id: c.nome,
            faturas: Array.isArray(c.faturas) ? c.faturas : []
          }));
          setContas(userContas);
          setEntradas(data.entradas ?? []);
          if (userContas.length > 0) {
            setContaEntradaId(userContas[0].id);
            setContaSaidaId(userContas[0].id);
            setCompraContaId(userContas[0].id);
            setNovaContaOrigemId(userContas[0].id);
          }
        }
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    carregar();
  }, [uid]);

  // --- LÓGICA DE FILTRAGEM COM useMemo PARA ATUALIZAÇÃO EM TEMPO REAL ---
  const { movimentacoesDoMes, totalEntradas, totalSaidas, saldoTotal } = useMemo(() => {
    const agora = new Date();
    const mesAnoAtual = agora.toISOString().slice(0, 7); // Ex: "2024-05"

    const filtradas = entradas.filter(m => {
      if (typeof m.data === 'string' && m.data.includes('/')) {
        const [, mes, ano] = m.data.split('/');
        return `${ano}-${mes}` === mesAnoAtual;
      }
      return m.data.startsWith(mesAnoAtual);
    });

    const ent = filtradas.filter(m => m.valor > 0).reduce((acc, m) => acc + m.valor, 0);
    const sai = filtradas.filter(m => m.valor < 0).reduce((acc, m) => acc + Math.abs(m.valor), 0);

    return {
      movimentacoesDoMes: filtradas,
      totalEntradas: ent,
      totalSaidas: sai,
      saldoTotal: ent - sai
    };
  }, [entradas]);

  const atualizarFirebase = async (nContas: any[], nEntradas: any[]) => {
    if (!uid) return;
    const save = nContas.map(({ id, ...rest }) => rest);
    await updateDoc(doc(db, "usuarios", uid), { contas: save, entradas: nEntradas });
  };

  const incluirCompraNoSetup = () => {
    if (!setupCompraNome || !setupValorTotal || !setupDataParc) return alert("Preencha os dados da compra");
    const valorComJuros = setupValorTotal * (1 + (setupJuros || 0) / 100);
    const vParc = valorComJuros / setupQtdParc;
    const parcelasGeradas = [];
    for (let i = 0; i < setupQtdParc; i++) {
      const num = i + 1;
      if (num > setupParcPagas) {
        const d = new Date(setupDataParc + "T00:00:00");
        d.setMonth(d.getMonth() + (i - setupParcPagas));
        parcelasGeradas.push({
          valor: vParc,
          vencimento: d.toISOString().slice(0, 10),
          numeroParcela: num,
          totalParcelas: setupQtdParc
        });
      }
    }
    setComprasTemporarias([...comprasTemporarias, { nome: setupCompraNome, parcelas: parcelasGeradas }]);
    setSetupCompraNome(""); setSetupValorTotal(0); setSetupJuros(0);
    alert("Compra adicionada à lista!");
  };

  const incluirFaturaNoSetup = () => {
    if (!setupValFat || !setupDatFat) return alert("Dados incompletos");
    setFaturasTemporarias([...faturasTemporarias, { valor: setupValFat, vencimento: setupDatFat }]);
    setSetupValFat(0); setSetupDatFat("");
    alert("Fatura adicionada!");
  };

  const adicionarContaFinal = async () => {
    const nomeLimpo = novaContaNome.trim();
    const pixLimpo = novaChavePix.trim();
    if (!nomeLimpo) return alert("Informe o nome da conta");
    if (contas.some(c => c.nome.toLowerCase() === nomeLimpo.toLowerCase())) return alert("Nome de conta já existe");
    if (pixLimpo !== "" && contas.some(c => c.pix === pixLimpo)) return alert("Esta chave PIX já está cadastrada em outra conta.");

    const faturasMapeadas: any[] = [];
    const inserirItem = (mesAno: string, valor: number, itemNome: string, pA = 1, pT = 1) => {
      let fat = faturasMapeadas.find(f => f.mesAno === mesAno);
      const novoItem = { nome: itemNome, valorOriginal: valor, parcelaAtual: pA, totalParcelas: pT };
      if (fat) {
        fat.valorTotal += valor;
        fat.itens.push(novoItem);
      } else {
        faturasMapeadas.push({ mesAno, valorTotal: valor, pago: false, itens: [novoItem], detalhesPagamento: [] });
      }
    };

    comprasTemporarias.forEach(c => c.parcelas.forEach((p: any) => inserirItem(p.vencimento.slice(0, 7), p.valor, c.nome, p.numeroParcela, p.totalParcelas)));
    faturasTemporarias.forEach(f => inserirItem(f.vencimento.slice(0, 7), f.valor, "Saldo Anterior / Fatura"));

    const novaConta = { id: nomeLimpo, nome: nomeLimpo, saldo: novoSaldo, pix: novaChavePix.trim(), faturas: faturasMapeadas };
    const novasContas = [...contas, novaConta];

    try {
      await atualizarFirebase(novasContas, entradas);
      setContas(novasContas);
      setModalNovaConta(false);
      setNovaContaNome(""); setNovoSaldo(0); setNovaChavePix(""); setNovoTemParcelamentos(false);
      setComprasTemporarias([]); setFaturasTemporarias([]); setModoSetup(undefined);
      alert("Conta adicionada com sucesso!");
    } catch (e) { alert("Erro ao salvar"); }
  };

  const registrarEntrada = async () => {
    if (!uid || valorEntrada <= 0) return;
    const nContas = contas.map(c => c.id === contaEntradaId ? { ...c, saldo: (c.saldo || 0) + valorEntrada } : c);
    const nEntradas = [{ valor: valorEntrada, descricao: descricaoEntrada, data: dataAtual, contaId: contaEntradaId, tipo: 'entrada' }, ...entradas];
    setContas(nContas); setEntradas(nEntradas);
    await atualizarFirebase(nContas, nEntradas);
    setValorEntrada(0); setDescricaoEntrada("");
  };

  const registrarSaida = async () => {
    if (!uid || valorSaida <= 0) return;
    const nContas = contas.map(c => c.id === contaSaidaId ? { ...c, saldo: (c.saldo || 0) - valorSaida } : c);
    const nEntradas = [{ valor: -valorSaida, descricao: descricaoSaida, data: dataAtual, contaId: contaSaidaId, tipo: 'saida' }, ...entradas];
    setContas(nContas); setEntradas(nEntradas);
    await atualizarFirebase(nContas, nEntradas);
    setValorSaida(0); setDescricaoSaida("");
  };

  const registrarCompraParcelada = async () => {
    if (!uid || compraValorTotal <= 0) return;
    const nContas = [...contas];
    const conta = nContas.find(c => c.id === compraContaId);
    if (!conta) return;
    const vParc = (compraValorTotal / (compraParcelas || 1)) * (1 + (compraJuros || 0) / 100);
    for (let i = 0; i < (compraParcelas || 1); i++) {
      const d = new Date(compraDataInicio + "-05");
      d.setMonth(d.getMonth() + i);
      const mY = d.toISOString().slice(0, 7);
      let fat = conta.faturas.find((f: any) => f.mesAno === mY);
      const item = { nome: compraNome, valorOriginal: vParc, parcelaAtual: i + 1, totalParcelas: compraParcelas };
      if (fat) {
        fat.itens.push(item);
        fat.valorTotal = (fat.valorTotal || 0) + vParc;
      } else {
        conta.faturas.push({ mesAno: mY, valorTotal: vParc, pago: false, itens: [item], detalhesPagamento: [] });
      }
    }
    setContas(nContas); await atualizarFirebase(nContas, entradas);
    setCompraNome(""); setCompraValorTotal(0);
  };

  const processarPagamento = async () => {
    if (!pagamentoFatura) return;
    const { cIdx, fIdx } = pagamentoFatura;
    const nContas = [...contas];
    const fat = nContas[cIdx].faturas[fIdx];
    const totalSessao = fontesDePagamento.reduce((acc, f) => acc + (f.valor || 0), 0);
    fat.valorTotal = (fat.valorTotal || 0) - totalSessao;
    fat.detalhesPagamento = [...(fat.detalhesPagamento || []), ...fontesDePagamento];
    if (fat.valorTotal <= 0.01) { fat.pago = true; fat.valorTotal = 0; }
    fontesDePagamento.forEach(f => {
      if (f.tipo === 'saldo') {
        const cOrigem = nContas.find(c => c.id === f.contaOrigemId);
        if (cOrigem) cOrigem.saldo = (cOrigem.saldo || 0) - f.valor;
      }
    });
    setContas(nContas);
    await atualizarFirebase(nContas, entradas);
    setPagamentoFatura(null); setFontesDePagamento([]);
  };

  const gerenciarPix = async (index: number, novaChave: string | null) => {
    const nContas = [...contas];
    const chaveLimpa = novaChave ? novaChave.trim() : "";
    if (chaveLimpa !== "" && contas.some((c, idx) => c.pix === chaveLimpa && idx !== index)) return alert("Esta chave PIX já pertence a outra conta.");
    nContas[index].pix = chaveLimpa;
    setContas(nContas);
    await atualizarFirebase(nContas, entradas);
    setEditPixInfo(null);
  };

  const copiarPix = (chave: string) => {
    navigator.clipboard.writeText(chave);
    alert("Chave PIX copiada!");
  };

  const styles: any = {
    overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
    modal: { backgroundColor: '#1e1e1e', padding: '20px', borderRadius: '12px', color: '#fff', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', position: 'relative' },
    card: { backgroundColor: '#1e1e1e', padding: '15px', borderRadius: '10px', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' },
    cardHeaderToggle: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' },
    input: { width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '5px', border: '1px solid #333', backgroundColor: '#2a2a2a', color: '#fff', boxSizing: 'border-box' },
    btn: { width: '100%', padding: '10px', borderRadius: '5px', border: 'none', cursor: 'pointer', fontWeight: 'bold' },
    btnSmall: { padding: '5px 10px', fontSize: '11px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#ccc', cursor: 'pointer' },
    btnLogout: { backgroundColor: '#860204', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer' },
    btnBlue: { backgroundColor: '#007bff', color: 'white', border: 'none', padding: '8px', borderRadius: '5px', width: '100%', marginBottom: 10 },
    btnFinalizar: { backgroundColor: '#28a745', color: 'white', border: 'none', padding: '12px', borderRadius: '5px', width: '100%', fontWeight: 'bold', marginTop: 10 }
  };

  if (loading) return <div style={{ padding: 20, backgroundColor: '#121212', color: '#fff', height: '100vh' }}>Carregando...</div>;

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif", maxWidth: "1000px", margin: "0 auto", backgroundColor: "#121212", minHeight: "100vh", color: "#e0e0e0" }}>
      <style>
        {`
          *::-webkit-scrollbar { display: none !important; }
          * { scrollbar-width: none !important; -ms-overflow-style: none !important; }
          input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
          input[type=number] { -moz-appearance: textfield; }
          .no-scroll::-webkit-scrollbar { display: none; }
        `}
      </style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #860204', marginBottom: 20, paddingBottom: 10 }}>
        <h2 style={{ margin: 0, color: "#fff" }}>Financeiro</h2>
        <button onClick={() => signOut(auth)} style={styles.btnLogout}>Sair</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10, marginBottom: 20 }}>
        <div style={{ ...styles.card, borderLeft: '5px solid #00ff3c' }}>
          <div onClick={() => setCardsExpandidos({ ...cardsExpandidos, entrada: !cardsExpandidos.entrada })} style={styles.cardHeaderToggle}>
            <h4 style={{ margin: 0 }}>(+) Entrada</h4>
            <span>{cardsExpandidos.entrada ? "▲" : "▼"}</span>
          </div>
          {cardsExpandidos.entrada && (
            <div style={{ marginTop: 10 }}>
              <input type="number" placeholder="R$" value={valorEntrada || ""} onChange={e => setValorEntrada(Number(e.target.value))} onWheel={(e) => (e.target as HTMLInputElement).blur()} style={styles.input} />
              <input type="text" placeholder="Descrição" value={descricaoEntrada} onChange={e => setDescricaoEntrada(e.target.value)} style={styles.input} />
              <select value={contaEntradaId} onChange={e => setContaEntradaId(e.target.value)} style={styles.input}>
                {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
              <button onClick={registrarEntrada} style={{ ...styles.btn, backgroundColor: '#00ff3c', color: 'white' }}>Confirmar</button>
            </div>
          )}
        </div>

        <div style={{ ...styles.card, borderLeft: '5px solid #ff0019' }}>
          <div onClick={() => setCardsExpandidos({ ...cardsExpandidos, saida: !cardsExpandidos.saida })} style={styles.cardHeaderToggle}>
            <h4 style={{ margin: 0 }}>(-) Saída</h4>
            <span>{cardsExpandidos.saida ? "▲" : "▼"}</span>
          </div>
          {cardsExpandidos.saida && (
            <div style={{ marginTop: 10 }}>
              <input type="number" placeholder="R$" value={valorSaida || ""} onChange={e => setValorSaida(Number(e.target.value))} onWheel={(e) => (e.target as HTMLInputElement).blur()} style={styles.input} />
              <input type="text" placeholder="Descrição" value={descricaoSaida} onChange={e => setDescricaoSaida(e.target.value)} style={styles.input} />
              <select value={contaSaidaId} onChange={e => setContaSaidaId(e.target.value)} style={styles.input}>
                {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
              <button onClick={registrarSaida} style={{ ...styles.btn, backgroundColor: '#ff0019', color: 'white' }}>Confirmar</button>
            </div>
          )}
        </div>

        <div style={{ ...styles.card, borderLeft: '5px solid #007bff' }}>
          <div onClick={() => setCardsExpandidos({ ...cardsExpandidos, compra: !cardsExpandidos.compra })} style={styles.cardHeaderToggle}>
            <h4 style={{ margin: 0 }}>Compra Parcelada</h4>
            <span>{cardsExpandidos.compra ? "▲" : "▼"}</span>
          </div>
          {cardsExpandidos.compra && (
            <div style={{ marginTop: 10 }}>
              <input type="text" placeholder="Item" value={compraNome} onChange={e => setCompraNome(e.target.value)} style={styles.input} />
              <input type="number" placeholder="Total R$" value={compraValorTotal || ""} onChange={e => setCompraValorTotal(Number(e.target.value))} onWheel={(e) => (e.target as HTMLInputElement).blur()} style={styles.input} />
              <div style={{ display: 'flex', gap: 5 }}>
                <input type="number" placeholder="Parc." value={compraParcelas || ""} onChange={e => setCompraParcelas(Number(e.target.value))} onWheel={(e) => (e.target as HTMLInputElement).blur()} style={styles.input} />
                <input type="number" placeholder="Juros %" value={compraJuros || ""} onChange={e => setCompraJuros(Number(e.target.value))} onWheel={(e) => (e.target as HTMLInputElement).blur()} style={styles.input} />
              </div>
              <input type="month" value={compraDataInicio} onChange={e => setCompraDataInicio(e.target.value)} style={styles.input} />
              <select value={compraContaId} onChange={e => setCompraContaId(e.target.value)} style={styles.input}>
                {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
              <button onClick={registrarCompraParcelada} style={{ ...styles.btn, backgroundColor: '#007bff', color: 'white' }}>Lançar</button>
            </div>
          )}
        </div>
      </div>

      <div style={{ ...styles.card, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
          <h4 style={{ margin: 0 }}>Resumo e Atividade</h4>
          <button onClick={() => setModalHistorico(true)} style={styles.btnSmall}>Explorar por Mês</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: 20, padding: '10px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
          <div style={{ textAlign: 'center' }}>
            <small style={{ color: '#777', display: 'block' }}>Entradas</small>
            <span style={{ color: '#00ff08', fontWeight: 'bold', fontSize: 14 }}>R$ {totalEntradas.toFixed(2)}</span>
          </div>
          <div style={{ textAlign: 'center', borderLeft: '1px solid #333', borderRight: '1px solid #333' }}>
            <small style={{ color: '#777', display: 'block' }}>Saídas</small>
            <span style={{ color: '#ff1100', fontWeight: 'bold', fontSize: 14 }}>R$ {totalSaidas.toFixed(2)}</span>
          </div>
          <div style={{ textAlign: 'center' }}>
            <small style={{ color: '#777', display: 'block' }}>Saldo</small>
            <span style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>R$ {saldoTotal.toFixed(2)}</span>
          </div>
        </div>

        <hr style={{ borderColor: '#333', marginBottom: 15 }} />

        <h5 style={{ margin: '0 0 10px 0', fontSize: 12, color: '#aaa', textTransform: 'uppercase' }}>Recentes (Este Mês)</h5>
        <div className="no-scroll" style={{ maxHeight: '200px', overflowY: 'auto' }}>
          {movimentacoesDoMes.length === 0 ? (
            <p style={{ fontSize: 12, color: '#777' }}>Nenhuma movimentação este mês.</p>
          ) : (
            movimentacoesDoMes.slice(0, 10).map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #333', fontSize: 13 }}>
                <span>
                  <span style={{ color: m.valor > 0 ? '#00ff08' : '#ff1100', fontWeight: 'bold', marginRight: 8 }}>{m.valor > 0 ? '↑' : '↓'}</span>
                  {m.descricao || (m.valor > 0 ? 'Entrada' : 'Saída')}
                  <small style={{ display: 'block', color: '#777', fontSize: 10 }}>{m.data} • {contas.find(c => c.id === m.contaId)?.nome}</small>
                </span>
                <span style={{ fontWeight: 'bold' }}>R$ {Math.abs(m.valor).toFixed(2)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        {contas.map((conta, idx) => (
          <div key={conta.id} style={{ border: '1px solid #333', borderRadius: 8, padding: 12, marginBottom: 10, background: '#1e1e1e' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 onClick={() => setContasExpandidas({ ...contasExpandidas, [conta.id]: !contasExpandidas[conta.id] })} style={{ cursor: 'pointer', margin: 0 }}>
                {contasExpandidas[conta.id] ? "▼" : "▶"} {conta.nome} — R$ {(conta.saldo || 0).toFixed(2)}
              </h3>
              <div style={{ display: 'flex', gap: 5 }}>
                {conta.pix ? (
                  <>
                    <button onClick={() => copiarPix(conta.pix)} style={styles.btnSmall}>Copiar PIX</button>
                    <button onClick={() => setEditPixInfo({ index: idx, chave: conta.pix })} style={styles.btnSmall}>Alterar</button>
                    <button onClick={() => { if (window.confirm("Remover PIX?")) gerenciarPix(idx, null) }} style={{ ...styles.btnSmall, color: '#ff1100' }}>Remover</button>
                  </>
                ) : (
                  <button onClick={() => setEditPixInfo({ index: idx, chave: "" })} style={styles.btnSmall}>+ Chave PIX</button>
                )}
              </div>
            </div>
            {contasExpandidas[conta.id] && (
              <div style={{ marginTop: 15, maxHeight: '350px', overflowY: 'auto', paddingRight: '5px' }}>
                {(!conta.faturas || conta.faturas.length === 0) ? (
                  <p style={{ fontSize: 13, color: '#777', textAlign: 'center', padding: '10px 0' }}>Sem faturas por aqui</p>
                ) : (
                  conta.faturas.sort((a: any, b: any) => (a.mesAno || "").localeCompare(b.mesAno || ""))
                    .map((f: any, fIdx: number) => (
                      <div key={f.mesAno} style={{ padding: '10px 0', borderBottom: '1px solid #333' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <strong>{f.mesAno}</strong>
                          <span style={{ color: f.pago ? '#4caf50' : '#f44336' }}>{f.pago ? "PAGA" : `R$ ${(f.valorTotal || 0).toFixed(2)}`}</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#aaa', margin: '4px 0' }}>
                          {(f.itens || []).map((it: any, i: number) => <div key={i}>• {it.nome} ({it.parcelaAtual}/{it.totalParcelas})</div>)}
                        </div>
                        <div style={{ display: 'flex', gap: 10, marginTop: 5 }}>
                          {!f.pago && <button onClick={() => setPagamentoFatura({ cIdx: contas.indexOf(conta), fIdx })} style={styles.btnSmall}>Abater</button>}
                          <button onClick={() => setVerDetalhes(f.detalhesPagamento)} style={{ ...styles.btnSmall, backgroundColor: '#333', color: '#fff', border: 'none' }}>Histórico Pgto</button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <button onClick={() => setModalNovaConta(true)} style={{ ...styles.btn, backgroundColor: '#1e1e1e', color: '#aaa', border: '1px dashed #444', marginTop: 10 }}>
        + Adicionar Nova Conta
      </button>

      {/* --- MODAIS --- */}
      {modalNovaConta && (
        <div style={styles.overlay}>
          <div style={{ ...styles.modal, width: '90%', maxWidth: '450px' }}>
            <h2 style={{ marginTop: 0 }}>Nova Conta</h2>
            <input type="text" placeholder="Nome (Ex: Nubank)" value={novaContaNome} onChange={(e) => setNovaContaNome(e.target.value)} style={styles.input} />
            <input type="number" placeholder="Saldo Atual R$" value={novoSaldo || ""} onChange={(e) => setNovoSaldo(Number(e.target.value))} onWheel={(e) => (e.target as HTMLInputElement).blur()} style={styles.input} />
            <input type="text" placeholder="Chave PIX (Opcional)" value={novaChavePix} onChange={(e) => setNovaChavePix(e.target.value)} style={styles.input} />
            <label style={{ display: "block", marginBottom: "10px" }}>
              <input type="checkbox" checked={novoTemParcelamentos} onChange={(e) => setNovoTemParcelamentos(e.target.checked)} /> Tem parcelamentos/faturas?
            </label>
            {novoTemParcelamentos && (
              <div style={{ ...styles.card, background: '#2a2a2a', marginBottom: 15 }}>
                <h3>Lançamentos Iniciais</h3>
                {!modoSetup ? (
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button onClick={() => setModoSetup("compra")} style={styles.btn}>Lançar Compra</button>
                    <button onClick={() => setModoSetup("fatura")} style={styles.btn}>Lançar Fatura</button>
                  </div>
                ) : (
                  <div>
                    <p>Modo: <strong>{modoSetup}</strong> <button onClick={() => setModoSetup(undefined)} style={{ fontSize: 10, background: '#444', border: 'none', color: '#fff', padding: '2px 5px', borderRadius: 4 }}>trocar</button></p>
                    {modoSetup === "compra" ? (
                      <div>
                        <input type="text" placeholder="Produto/Loja" value={setupCompraNome} onChange={e => setSetupCompraNome(e.target.value)} style={styles.input} />
                        <input type="number" placeholder="Valor Total" value={setupValorTotal || ""} onChange={e => setSetupValorTotal(Number(e.target.value))} style={styles.input} />
                        <input type="number" placeholder="Juros %" value={setupJuros || ""} onChange={e => setSetupJuros(Number(e.target.value))} style={styles.input} />
                        <div style={{ display: "flex", gap: 10 }}>
                          <div style={{ flex: 1 }}><label style={{ fontSize: 10 }}>Total Parc.</label><input type="number" value={setupQtdParc} onChange={e => setSetupQtdParc(Number(e.target.value))} style={styles.input} /></div>
                          <div style={{ flex: 1 }}><label style={{ fontSize: 10 }}>Já pagas</label><input type="number" value={setupParcPagas} onChange={e => setSetupParcPagas(Number(e.target.value))} style={styles.input} /></div>
                        </div>
                        <input type="date" value={setupDataParc} onChange={e => setSetupDataParc(e.target.value)} style={styles.input} />
                        <button onClick={incluirCompraNoSetup} style={styles.btnBlue}>+ Adicionar à Lista</button>
                      </div>
                    ) : (
                      <div>
                        <input type="number" placeholder="Valor Total Fatura" value={setupValFat || ""} onChange={e => setSetupValFat(Number(e.target.value))} style={styles.input} />
                        <input type="date" value={setupDatFat} onChange={e => setSetupDatFat(e.target.value)} style={styles.input} />
                        <button onClick={incluirFaturaNoSetup} style={styles.btnBlue}>+ Adicionar à Lista</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            <button onClick={adicionarContaFinal} style={styles.btnFinalizar}>Salvar e Criar Conta</button>
            <button onClick={() => setModalNovaConta(false)} style={{ ...styles.btn, marginTop: 10, backgroundColor: '#444', color: 'white' }}>Cancelar</button>
          </div>
        </div>
      )}

      {pagamentoFatura && (
        <div style={styles.overlay}>
          <div style={{ ...styles.modal, width: '450px' }}>
            <h3>Abater Valor</h3>
            <div style={{ marginBottom: 15 }}>
              <label style={{ fontSize: 12, display: 'block' }}>Fonte de Pagamento:</label>
              <select value={novoTipo} onChange={e => setNovoTipo(e.target.value as any)} style={styles.input}>
                <option value="saldo">Saldo de uma Conta</option>
                <option value="terceiros">Dinheiro Externo / Terceiros</option>
              </select>
              {novoTipo === 'saldo' ? (
                <select value={novaContaOrigemId} onChange={e => setNovaContaOrigemId(e.target.value)} style={styles.input}>
                  {contas.map(c => <option key={c.id} value={c.id}>{c.nome} (Saldo: R$ {c.saldo.toFixed(2)})</option>)}
                </select>
              ) : (
                <input type="text" placeholder="Quem pagou? (Ex: Mãe)" value={novaDescricao} onChange={e => setNovaDescricao(e.target.value)} style={styles.input} />
              )}
              <input type="number" placeholder="R$ Valor a abater" value={novoValor || ""} onChange={e => setNovoValor(Number(e.target.value))} style={styles.input} />
              <button onClick={() => {
                if (novoValor <= 0) return;
                setFontesDePagamento([...fontesDePagamento, { valor: novoValor, tipo: novoTipo, contaOrigemId: novaContaOrigemId, descricao: novaDescricao }]);
                setNovoValor(0); setNovaDescricao("");
              }} style={styles.btnBlue}>+ Adicionar Pagamento</button>
            </div>
            <div style={{ maxHeight: '150px', overflowY: 'auto', marginBottom: 15, background: '#000', padding: 10, borderRadius: 5 }}>
              {fontesDePagamento.map((f, i) => <div key={i} style={{ fontSize: 12 }}>R$ {f.valor.toFixed(2)} - {f.tipo === 'saldo' ? f.contaOrigemId : f.descricao}</div>)}
            </div>
            <button onClick={processarPagamento} style={styles.btnFinalizar}>Confirmar Abatimento</button>
            <button onClick={() => setPagamentoFatura(null)} style={{ ...styles.btn, marginTop: 10, backgroundColor: '#444' }}>Fechar</button>
          </div>
        </div>
      )}

      {verDetalhes && (
        <div style={styles.overlay}>
          <div style={{ ...styles.modal, width: '400px' }}>
            <h3>Histórico de Abatimentos</h3>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {verDetalhes.length === 0 ? <p style={{ fontSize: 13, color: '#aaa' }}>Nenhum pagamento registrado.</p> :
                verDetalhes.map((detalhe, i) => (
                  <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid #333', fontSize: 13 }}>
                    <strong>Valor:</strong> R$ {detalhe.valor.toFixed(2)} <br />
                    <strong>Tipo:</strong> {detalhe.tipo === 'saldo' ? 'Saldo em Conta' : 'Terceiros'} <br />
                    {detalhe.tipo === 'saldo' ? <span><strong>Origem:</strong> {detalhe.contaOrigemId}</span> : <span><strong>Info:</strong> {detalhe.descricao}</span>}
                  </div>
                ))}
            </div>
            <button onClick={() => setVerDetalhes(null)} style={{ ...styles.btn, marginTop: 15, backgroundColor: '#444' }}>Fechar</button>
          </div>
        </div>
      )}

      {editPixInfo && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3>Gerenciar Chave PIX</h3>
            <input type="text" value={editPixInfo.chave} onChange={e => setEditPixInfo({ ...editPixInfo, chave: e.target.value })} style={styles.input} />
            <button onClick={() => gerenciarPix(editPixInfo.index, editPixInfo.chave)} style={{ ...styles.btn, backgroundColor: '#28a745', color: 'white', marginBottom: 5 }}>Salvar</button>
            <button onClick={() => setEditPixInfo(null)} style={{ ...styles.btn, backgroundColor: '#444' }}>Cancelar</button>
          </div>
        </div>
      )}

      {modalHistorico && (() => {
        const movHistorico = entradas.filter(m => m.data.startsWith(mesFiltroHistorico));
        const entHist = movHistorico.filter(m => m.valor > 0).reduce((acc, m) => acc + m.valor, 0);
        const saiHist = movHistorico.filter(m => m.valor < 0).reduce((acc, m) => acc + Math.abs(m.valor), 0);
        const saldoHist = entHist - saiHist;

        return (
          <div style={styles.overlay}>
            <div style={{ ...styles.modal, width: '650px' }}>
              <h3 style={{ marginTop: 0 }}>Histórico de {mesFiltroHistorico}</h3>
              <input type="month" value={mesFiltroHistorico} onChange={e => setMesFiltroHistorico(e.target.value)} style={styles.input} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: 20, padding: '15px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px solid #333' }}>
                <div style={{ textAlign: 'center' }}>
                  <small style={{ color: '#777', display: 'block' }}>Entradas</small>
                  <span style={{ color: '#00ff08', fontWeight: 'bold' }}>R$ {entHist.toFixed(2)}</span>
                </div>
                <div style={{ textAlign: 'center', borderLeft: '1px solid #333', borderRight: '1px solid #333' }}>
                  <small style={{ color: '#777', display: 'block' }}>Saídas</small>
                  <span style={{ color: '#ff1100', fontWeight: 'bold' }}>R$ {saiHist.toFixed(2)}</span>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <small style={{ color: '#777', display: 'block' }}>Saldo</small>
                  <span style={{ color: '#fff', fontWeight: 'bold' }}>R$ {saldoHist.toFixed(2)}</span>
                </div>
              </div>
              <div className="no-scroll" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {movHistorico.map((m, i) => (
                  <div key={i} style={{ fontSize: 12, padding: '8px 0', borderBottom: '1px solid #333' }}>
                    <strong>{m.data}</strong>: {m.descricao}
                    <span style={{ marginLeft: '10px', color: '#888', fontStyle: 'italic' }}>({contas.find(c => c.id === m.contaId)?.nome})</span>
                    <span style={{ float: 'right', color: m.valor > 0 ? '#4caf50' : '#f44336', fontWeight: 'bold' }}>R$ {m.valor.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => setModalHistorico(false)} style={{ ...styles.btn, marginTop: 15, backgroundColor: '#444' }}>Fechar</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

const styles: any = {
  card: { backgroundColor: '#1e1e1e', padding: '15px', borderRadius: '10px', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' },
  cardHeaderToggle: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' },
  input: { width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '5px', border: '1px solid #333', backgroundColor: '#2a2a2a', color: '#fff', boxSizing: 'border-box' },
  btn: { width: '100%', padding: '10px', borderRadius: '5px', border: 'none', cursor: 'pointer', fontWeight: 'bold' },
  btnSmall: { padding: '5px 10px', fontSize: '11px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#ccc', cursor: 'pointer' },
  btnLogout: { backgroundColor: '#860204', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer' },
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modal: { backgroundColor: '#1e1e1e', padding: '20px', borderRadius: '10px', color: '#fff' },
  btnBlue: { backgroundColor: '#007bff', color: 'white', border: 'none', padding: '8px', borderRadius: '5px', width: '100%', marginBottom: 10 },
  btnFinalizar: { backgroundColor: '#28a745', color: 'white', border: 'none', padding: '12px', borderRadius: '5px', width: '100%', fontWeight: 'bold', marginTop: 10 }
};