import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";

export default function Dashboard() {
  const [contas, setContas] = useState<any[]>([]);
  const [entradas, setEntradas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [contasExpandidas, setContasExpandidas] = useState<Record<string, boolean>>({});

  // Estados para Nova Conta
  const [modalNovaConta, setModalNovaConta] = useState(false);
  const [novoNomeConta, setNovoNomeConta] = useState("");
  const [novoSaldoConta, setNovoSaldoConta] = useState(0);

  // Estado para Histórico Completo
  const [modalHistorico, setModalHistorico] = useState(false);
  const [mesFiltroHistorico, setMesFiltroHistorico] = useState(new Date().toISOString().slice(0, 7));

  // Estados dos formulários
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

  // Pagamento Parcial
  const [pagamentoFatura, setPagamentoFatura] = useState<any>(null);
  const [fontesDePagamento, setFontesDePagamento] = useState<any[]>([]);
  const [novoValor, setNovoValor] = useState<number>(0);
  const [novoTipo, setNovoTipo] = useState<'saldo' | 'terceiros'>('saldo');
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novaContaOrigemId, setNovaContaOrigemId] = useState('');
  const [verDetalhes, setVerDetalhes] = useState<any[] | null>(null);

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

  const atualizarFirebase = async (nContas: any[], nEntradas: any[]) => {
    if (!uid) return;
    const save = nContas.map(({ id, ...rest }) => rest);
    await updateDoc(doc(db, "usuarios", uid), { contas: save, entradas: nEntradas });
  };

  const adicionarNovaConta = async () => {
    if (!novoNomeConta) return alert("Informe o nome da conta");
    const novaConta = { nome: novoNomeConta, id: novoNomeConta, saldo: novoSaldoConta, faturas: [] };
    const nContas = [...contas, novaConta];
    setContas(nContas);
    await atualizarFirebase(nContas, entradas);
    setModalNovaConta(false); setNovoNomeConta(""); setNovoSaldoConta(0);
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
    
    const novasMovimentacoes: any[] = [];
    fontesDePagamento.forEach(f => {
      if (f.tipo === 'saldo') {
        const cOrigem = nContas.find(c => c.id === f.contaOrigemId);
        if (cOrigem) cOrigem.saldo = (cOrigem.saldo || 0) - f.valor;
      }
      novasMovimentacoes.push({ 
        valor: -f.valor, 
        descricao: f.tipo === 'terceiros' ? `Terceiro (${f.descricao}) pagou fat. ${fat.mesAno}` : `Pagamento Fat. ${fat.mesAno}`, 
        data: dataAtual, 
        contaId: f.contaOrigemId || nContas[cIdx].id,
        tipo: 'saida'
      });
    });

    const nEntradas = [...novasMovimentacoes, ...entradas];
    setContas(nContas); setEntradas(nEntradas);
    setPagamentoFatura(null); setFontesDePagamento([]);
    await atualizarFirebase(nContas, nEntradas);
  };

  const movimentacoesFiltradas = entradas.filter(m => m.data.startsWith(mesFiltroHistorico));

  if (loading) return <div style={{padding:20}}>Carregando...</div>;

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif", maxWidth: "1000px", margin: "0 auto" }}>
      {/* HEADER */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems: 'center', borderBottom:'2px solid #860204', marginBottom:20, paddingBottom: 10}}>
        <h2 style={{margin: 0}}>Financeiro</h2>
        <button onClick={() => signOut(auth)} style={styles.btnLogout} onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#6e0204')} onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#860204')}>
          <span style={{marginRight: '8px'}}>✕</span> Sair
        </button>
      </div>

      {/* CARDS DE LANÇAMENTO */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:10, marginBottom: 20}}>
        <div style={{...styles.card, borderLeft:'5px solid #28a745'}}>
          <h4>(+) Entrada</h4>
          <input type="number" placeholder="R$" value={valorEntrada || ""} onChange={e => setValorEntrada(Number(e.target.value))} style={styles.input} />
          <input type="text" placeholder="Descrição" value={descricaoEntrada} onChange={e => setDescricaoEntrada(e.target.value)} style={styles.input} />
          <select value={contaEntradaId} onChange={e => setContaEntradaId(e.target.value)} style={styles.input}>
            {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <button onClick={registrarEntrada} style={{...styles.btn, backgroundColor:'#28a745', color:'white'}}>Confirmar</button>
        </div>

        <div style={{...styles.card, borderLeft:'5px solid #dc3545'}}>
          <h4>(-) Saída</h4>
          <input type="number" placeholder="R$" value={valorSaida || ""} onChange={e => setValorSaida(Number(e.target.value))} style={styles.input} />
          <input type="text" placeholder="Descrição" value={descricaoSaida} onChange={e => setDescricaoSaida(e.target.value)} style={styles.input} />
          <select value={contaSaidaId} onChange={e => setContaSaidaId(e.target.value)} style={styles.input}>
            {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <button onClick={registrarSaida} style={{...styles.btn, backgroundColor:'#dc3545', color:'white'}}>Confirmar</button>
        </div>

        <div style={{...styles.card, borderLeft:'5px solid #007bff'}}>
          <h4>(+) Compra Parcelada</h4>
          <input type="text" placeholder="Item" value={compraNome} onChange={e => setCompraNome(e.target.value)} style={styles.input} />
          <input type="number" placeholder="Total R$" value={compraValorTotal || ""} onChange={e => setCompraValorTotal(Number(e.target.value))} style={styles.input} />
          <div style={{display:'flex', gap:5}}>
            <input type="number" placeholder="Parc." value={compraParcelas || ""} onChange={e => setCompraParcelas(Number(e.target.value))} style={styles.input} />
            <input type="number" placeholder="Juros %" value={compraJuros || ""} onChange={e => setCompraJuros(Number(e.target.value))} style={styles.input} />
          </div>
          <input type="month" value={compraDataInicio} onChange={e => setCompraDataInicio(e.target.value)} style={styles.input} />
          <select value={compraContaId} onChange={e => setCompraContaId(e.target.value)} style={styles.input}>
            {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <button onClick={registrarCompraParcelada} style={{...styles.btn, backgroundColor:'#007bff', color:'white'}}>Lançar</button>
        </div>
      </div>

      {/* HISTÓRICO RECENTE */}
      <div style={{...styles.card, marginBottom: 20}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10}}>
          <h4 style={{margin: 0}}>Atividade Recente</h4>
          <button onClick={() => setModalHistorico(true)} style={styles.btnSmall}>Explorar por Mês</button>
        </div>
        <div style={{maxHeight: '200px', overflowY: 'auto'}}>
          {entradas.length === 0 ? (
            <p style={{fontSize: 12, color: '#999'}}>Nenhuma movimentação ainda.</p>
          ) : (
            entradas.slice(0, 10).map((m, i) => (
              <div key={i} style={{display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f9f9f9', fontSize: 13}}>
                <span>
                  <span style={{color: m.valor > 0 ? 'green' : 'red', fontWeight: 'bold', marginRight: 8}}>
                    {m.valor > 0 ? '↑' : '↓'}
                  </span>
                  {m.descricao || (m.valor > 0 ? 'Entrada' : 'Saída')}
                  <small style={{display: 'block', color: '#999', fontSize: 10}}>{m.data} • {m.contaId}</small>
                </span>
                <span style={{fontWeight: 'bold'}}>R$ {Math.abs(m.valor).toFixed(2)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* LISTA DE CONTAS */}
      <div>
        {contas.map((conta) => (
          <div key={conta.id} style={{border:'1px solid #ddd', borderRadius:8, padding:12, marginBottom:10, background:'#fdfdfd'}}>
            <h3 onClick={() => setContasExpandidas({...contasExpandidas, [conta.id]: !contasExpandidas[conta.id]})} style={{cursor:'pointer', margin:0}}>
              {contasExpandidas[conta.id] ? "▼" : "▶"} {conta.nome} — R$ {(conta.saldo || 0).toFixed(2)}
            </h3>
            {contasExpandidas[conta.id] && (
              <div style={{marginTop:15, maxHeight: '350px', overflowY: 'auto', paddingRight: '5px'}}>
                {(!conta.faturas || conta.faturas.length === 0) ? (
                  <p style={{fontSize: 13, color: '#999', textAlign: 'center', padding: '10px 0'}}>Sem faturas por aqui</p>
                ) : (
                  conta.faturas.sort((a:any, b:any) => (a.mesAno || "").localeCompare(b.mesAno || ""))
                    .map((f:any, fIdx:number) => (
                    <div key={f.mesAno} style={{padding:'10px 0', borderBottom:'1px solid #f0f0f0'}}>
                      <div style={{display:'flex', justifyContent:'space-between'}}>
                        <strong>{f.mesAno}</strong>
                        <span style={{color: f.pago ? 'green' : 'red'}}>{f.pago ? "PAGA" : `R$ ${(f.valorTotal || 0).toFixed(2)}`}</span>
                      </div>
                      <div style={{fontSize:11, color:'#666', margin: '4px 0'}}>
                        {(f.itens || []).map((it:any, i:number) => <div key={i}>• {it.nome} ({it.parcelaAtual}/{it.totalParcelas})</div>)}
                      </div>
                      <div style={{display:'flex', gap:10, marginTop:5}}>
                        {!f.pago && <button onClick={() => setPagamentoFatura({cIdx: contas.indexOf(conta), fIdx})} style={styles.btnSmall}>Abater</button>}
                        <button onClick={() => setVerDetalhes(f.detalhesPagamento)} style={{...styles.btnSmall, backgroundColor:'#eee'}}>Histórico Pgto</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ))}
        <button onClick={() => setModalNovaConta(true)} style={{...styles.btn, backgroundColor: '#eee', color: '#333', border: '1px dashed #ccc', marginTop: 10}}>
          + Adicionar Outra Conta
        </button>
      </div>

      {/* MODAL EXPLORAR HISTÓRICO (ROLÁVEL) */}
      {modalHistorico && (
        <div style={styles.overlay} onClick={() => setModalHistorico(false)}>
          <div style={{...styles.modal, width: '450px'}} onClick={e => e.stopPropagation()}>
            <h3 style={{marginTop: 0}}>Explorar Histórico</h3>
            <div style={{marginBottom: 15, background: '#f5f5f5', padding: 10, borderRadius: 5}}>
              <input type="month" value={mesFiltroHistorico} onChange={e => setMesFiltroHistorico(e.target.value)} style={styles.input} />
            </div>
            <div style={{maxHeight: '400px', overflowY: 'auto', paddingRight: '10px'}}>
              {movimentacoesFiltradas.length === 0 ? (
                <p style={{fontSize: 12, color: '#999', textAlign: 'center'}}>Nenhuma movimentação em {mesFiltroHistorico}.</p>
              ) : (
                movimentacoesFiltradas.map((m: any, idx: number) => (
                  <div key={idx} style={{fontSize: 12, padding: '10px 0', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between'}}>
                    <span>
                      <strong>{m.data.slice(8,10)}</strong> - {m.descricao}
                      <br/><small style={{color: '#999'}}>{m.contaId}</small>
                    </span>
                    <span style={{color: m.valor > 0 ? 'green' : 'red', fontWeight: 'bold'}}>R$ {m.valor.toFixed(2)}</span>
                  </div>
                ))
              )}
            </div>
            <button onClick={() => setModalHistorico(false)} style={{...styles.btn, backgroundColor:'#333', color:'white', marginTop:15}}>Fechar</button>
          </div>
        </div>
      )}

      {/* MODAL ABATER FATURA (ROLÁVEL) */}
      {pagamentoFatura && (
        <div style={styles.overlay}>
          <div style={{...styles.modal, width: '400px'}} onClick={e => e.stopPropagation()}>
            <h3 style={{marginTop: 0}}>Abater Fat. {contas[pagamentoFatura.cIdx].faturas[pagamentoFatura.fIdx].mesAno}</h3>
            <p>Restante: <strong>R$ {(contas[pagamentoFatura.cIdx].faturas[pagamentoFatura.fIdx].valorTotal || 0).toFixed(2)}</strong></p>
            
            <div style={{padding: '10px', background: '#f9f9f9', borderRadius: '8px', marginBottom: '15px'}}>
              <input type="number" placeholder="Valor R$" value={novoValor || ""} onChange={e => setNovoValor(Number(e.target.value))} style={styles.input} />
              <select value={novoTipo} onChange={e => setNovoTipo(e.target.value as any)} style={styles.input}>
                <option value="saldo">Meu Saldo</option>
                <option value="terceiros">Terceiros</option>
              </select>
              {novoTipo === 'saldo' ? (
                <select value={novaContaOrigemId} onChange={e => setNovaContaOrigemId(e.target.value)} style={styles.input}>
                  {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              ) : (
                <input type="text" placeholder="Quem pagou?" value={novaDescricao} onChange={e => setNovaDescricao(e.target.value)} style={styles.input} />
              )}
              <button onClick={() => {
                if(novoValor > 0) setFontesDePagamento([...fontesDePagamento, {id: Date.now(), valor: novoValor, tipo: novoTipo, contaOrigemId: novaContaOrigemId, descricao: novaDescricao}]);
                setNovoValor(0); setNovaDescricao('');
              }} style={{...styles.btn, backgroundColor:'#007bff', color:'white'}}>+ Adicionar Pagamento</button>
            </div>

            <div style={{maxHeight: '150px', overflowY: 'auto', marginBottom: '15px', border: '1px solid #eee', borderRadius: '4px', padding: '5px'}}>
              {fontesDePagamento.length === 0 ? <p style={{fontSize: 11, textAlign: 'center', color: '#999'}}>Nenhum pagamento adicionado à lista</p> : 
                fontesDePagamento.map((f, idx) => (
                  <div key={f.id} style={{display:'flex', justifyContent:'space-between', fontSize:11, padding: '5px', borderBottom: '1px solid #f0f0f0'}}>
                    <span>R$ {f.valor.toFixed(2)} ({f.tipo === 'terceiros' ? f.descricao : 'Saldo'})</span>
                    <button onClick={() => setFontesDePagamento(fontesDePagamento.filter((_, i) => i !== idx))} style={{color:'red', border:'none', background:'none', cursor:'pointer'}}>remover</button>
                  </div>
                ))
              }
            </div>
            
            <button onClick={processarPagamento} style={{...styles.btn, backgroundColor:'green', color:'white'}}>Confirmar Tudo</button>
            <button onClick={() => setPagamentoFatura(null)} style={{...styles.btn, backgroundColor:'#666', color:'white', marginTop:5}}>Sair</button>
          </div>
        </div>
      )}

      {/* MODAL EXTRATO DE PAGAMENTOS (ROLÁVEL) */}
      {verDetalhes && (
        <div style={styles.overlay} onClick={() => setVerDetalhes(null)}>
          <div style={{...styles.modal, width: '350px'}} onClick={e => e.stopPropagation()}>
            <h3 style={{marginTop: 0}}>Extrato da Fatura</h3>
            <div style={{maxHeight: '300px', overflowY: 'auto', paddingRight: '5px'}}>
              {(verDetalhes || []).length === 0 ? <p style={{fontSize: 12, color: '#999'}}>Nenhum pagamento registrado.</p> :
                (verDetalhes || []).map((det, i) => (
                  <div key={i} style={{fontSize: 12, padding: '8px 0', borderBottom: '1px solid #eee'}}>
                    <strong>R$ {(det.valor || 0).toFixed(2)}</strong>
                    <br/><small>{det.tipo === 'terceiros' ? `Terceiro (${det.descricao})` : 'Saldo Próprio'}</small>
                  </div>
                ))
              }
            </div>
            <button onClick={() => setVerDetalhes(null)} style={{...styles.btn, backgroundColor:'#333', color:'white', marginTop:15}}>Fechar</button>
          </div>
        </div>
      )}

      {/* MODAL NOVA CONTA */}
      {modalNovaConta && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3>Adicionar Nova Conta</h3>
            <input type="text" placeholder="Nome da Conta" value={novoNomeConta} onChange={e => setNovoNomeConta(e.target.value)} style={styles.input} />
            <input type="number" placeholder="Saldo Inicial" value={novoSaldoConta || ""} onChange={e => setNovoSaldoConta(Number(e.target.value))} style={styles.input} />
            <button onClick={adicionarNovaConta} style={{...styles.btn, backgroundColor:'#28a745', color:'white', marginBottom: 5}}>Criar Conta</button>
            <button onClick={() => setModalNovaConta(false)} style={{...styles.btn, backgroundColor:'#666', color:'white'}}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: any = {
  card: { background: '#fff', padding: 12, borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  input: { width: '100%', padding: 10, marginBottom: 8, boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: 4 },
  btn: { width: '100%', padding: 10, border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' },
  btnLogout: { backgroundColor: '#860204', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', fontSize: '14px' },
  btnSmall: { padding: '4px 10px', fontSize: 11, cursor: 'pointer', border: '1px solid #ccc', borderRadius: 4, background: '#fff' },
  overlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' },
  modal: { background: 'white', padding: '25px', borderRadius: 12, width: '100%', maxWidth: '100%', maxHeight: '90vh', overflowY: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }
};