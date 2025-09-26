import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

type Parcela = {
  valor: number; // Valor pendente
  vencimento?: string;
  pago?: boolean;
};

type Compra = {
  nome: string;
  parcelas: Parcela[];
};

type Fatura = {
  valor: number; // Valor pendente
  vencimento: string;
  pago?: boolean;
};

type Conta = {
  id: string;
  nome: string;
  saldo: number;
  temParcelamentos: boolean;
  modo?: "compra" | "fatura";
  compras?: Compra[];
  faturas?: Fatura[];
};

type Entrada = {
  valor: number;
  descricao: string;
  data: string;
  contaId: string;
};

type PagamentoEmAberto = {
  contaIdx: number;
  itemValor: number; // Valor da dívida pendente
  compraIdx?: number;
  parcelaIdx?: number;
  faturaIdx?: number;
  contaId: string;
};

// Estrutura para cada fonte de pagamento parcial
type FontePagamento = {
    id: number;
    valor: number;
    tipo: 'saldo' | 'terceiros';
    descricao?: string; 
    contaOrigemId?: string; 
};

export default function Dashboard() {
  const [contas, setContas] = useState<Conta[]>([]);
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [historicoDescricoes, setHistoricoDescricoes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados do formulário de entrada
  const [valorEntrada, setValorEntrada] = useState<number>(0);
  const [descricaoEntrada, setDescricaoEntrada] = useState<string>("");
  const [dataEntrada, setDataEntrada] = useState<string>("");
  const [contaEntradaId, setContaEntradaId] = useState<string>("");

  // ESTADO CHAVE PARA O NOVO RECURSO DE PAGAMENTO DIVIDIDO
  const [pagamentoEmAberto, setPagamentoEmAberto] = useState<PagamentoEmAberto | null>(null);

  // NOVO ESTADO CHAVE: Array de fontes de pagamento
  const [fontesDePagamento, setFontesDePagamento] = useState<FontePagamento[]>([]);
  
  // Estados temporários para adicionar nova fonte
  const [novoValor, setNovoValor] = useState<number>(0);
  const [novoTipo, setNovoTipo] = useState<'saldo' | 'terceiros'>('saldo');
  const [novaDescricao, setNovaDescricao] = useState<string>('');
  const [novaContaOrigemId, setNovaContaOrigemId] = useState<string>('');
  
  const uid = auth.currentUser?.uid;
  const dataAtual = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    // ... (Lógica de Carregamento permanece igual)
    const carregar = async () => {
      if (!uid) return;

      try {
        const snap = await getDoc(doc(db, "usuarios", uid));
        if (!snap.exists()) return;

        const data = snap.data();

        // Contas
        const userContas: Conta[] = (data.contas ?? []).map((c: any) => ({
          id: c.nome, 
          nome: c.nome,
          saldo: c.saldo,
          temParcelamentos: c.temParcelamentos,
          modo: c.modo,
          compras: c.compras?.map((comp: any) => ({
            nome: comp.nome,
            parcelas: comp.parcelas?.map((p: any) => ({
              valor: Number(p.valor) ?? 0,
              vencimento: p.vencimento ?? "",
              pago: p.pago ?? false,
            })) ?? [],
          })) ?? [],
          faturas: c.faturas?.map((f: any) => ({
            valor: Number(f.valor) ?? 0,
            vencimento: f.vencimento ?? "",
            pago: f.pago ?? false,
          })) ?? [],
        }));
        setContas(userContas);
        
        if (userContas.length > 0) {
            setContaEntradaId(userContas[0].id);
            setNovaContaOrigemId(userContas[0].id); // Pre-seleciona a conta de origem
        }

        // Entradas
        const entradasExistentes: Entrada[] = (data.entradas ?? []).map((e: any) => ({
          valor: Number(e.valor) ?? 0,
          descricao: e.descricao ?? "",
          data: e.data ?? "",
          contaId: e.contaId ?? "", 
        }));
        setEntradas(entradasExistentes);

        // Histórico de descrições
        setHistoricoDescricoes(Array.from(new Set(entradasExistentes.map(e => e.descricao))));
      } catch (err) {
        console.error("Erro ao carregar:", err);
      } finally {
        setLoading(false);
      }
    };

    carregar();
  }, [uid]);

  // Função para abrir o formulário de pagamento
  const abrirFormularioPagamento = (contaIdx: number, itemValor: number, contaId: string, compraIdx?: number, parcelaIdx?: number, faturaIdx?: number) => {
    // Se o valor pendente for zero, não abre o formulário
    if (itemValor <= 0) {
        return alert("Esta fatura/parcela já foi totalmente paga ou seu valor é zero.");
    }

    setPagamentoEmAberto({ contaIdx, itemValor, compraIdx, parcelaIdx, faturaIdx, contaId });
    setFontesDePagamento([]); 
    
    // Valor inicial do campo Novo Pagamento deve ser o valor restante
    setNovoValor(itemValor > 0 ? itemValor : 0); 
    setNovoTipo('saldo');
    setNovaDescricao('');
    setNovaContaOrigemId(contas.length > 0 ? contas[0].id : '');
  };

  // Função para fechar o formulário de pagamento
  const fecharFormularioPagamento = () => {
    setPagamentoEmAberto(null);
    setFontesDePagamento([]);
  };
  
  // Registrar entrada (permanece igual)
  const registrarEntrada = async () => {
    if (!uid || valorEntrada <= 0 || !descricaoEntrada || !dataEntrada || !contaEntradaId) {
      return alert("Preencha todos os campos corretamente e selecione a conta!");
    }

    const novaEntrada: Entrada = { valor: valorEntrada, descricao: descricaoEntrada, data: dataEntrada, contaId: contaEntradaId };

    const novasContas = contas.map(conta => {
        if (conta.id === contaEntradaId) {
            return { ...conta, saldo: conta.saldo + valorEntrada };
        }
        return conta;
    });
    setContas(novasContas);

    setEntradas(prev => [...prev, novaEntrada]);
    if (!historicoDescricoes.includes(descricaoEntrada)) setHistoricoDescricoes(prev => [...prev, descricaoEntrada]);

    await updateDoc(doc(db, "usuarios", uid), {
      contas: novasContas.map(c => {
          const { id, ...rest } = c;
          return rest;
      }),
      entradas: [...entradas, novaEntrada],
    });

    setValorEntrada(0);
    setDescricaoEntrada("");
    setDataEntrada("");
  };

  // ADICIONAR NOVA FONTE DE PAGAMENTO
  const adicionarFontePagamento = () => {
    if (!pagamentoEmAberto) return;

    const valorRestanteDaDivida = pagamentoEmAberto.itemValor; // Valor total da dívida
    const totalPagoAtual = fontesDePagamento.reduce((sum, f) => sum + f.valor, 0);
    const limiteNovoValor = valorRestanteDaDivida - totalPagoAtual; // O novo valor não pode ultrapassar o que falta

    if (novoValor <= 0) {
        return alert("O valor do pagamento deve ser maior que zero.");
    }
    
    // AQUI ESTÁ A MUDANÇA: Permitimos o adiantamento, mas o valor do pagamento não deve ser maior que o valor TOTAL da dívida pendente.
    // E o valor a ser adicionado agora não pode ser maior que o limite.
    if (novoValor > limiteNovoValor && limiteNovoValor >= 0.01) {
         return alert(`O valor (R$ ${novoValor.toFixed(2)}) excede o restante a pagar (R$ ${limiteNovoValor.toFixed(2)}). Ajuste o valor.`);
    }

    if (novoTipo === 'saldo' && !novaContaOrigemId) {
        return alert("Selecione a conta de origem do saldo.");
    }

    if (novoTipo === 'terceiros' && !novaDescricao.trim()) {
        return alert("A descrição é obrigatória para pagamento de terceiros/outras contas.");
    }
    
    const novaFonte: FontePagamento = {
        id: Date.now(), 
        valor: novoValor,
        tipo: novoTipo,
        descricao: novaDescricao.trim() || undefined,
        contaOrigemId: novoTipo === 'saldo' ? novaContaOrigemId : undefined
    };

    setFontesDePagamento(prev => [...prev, novaFonte]);
    
    // Limpar e preparar para o próximo pagamento
    const novoValorRestante = valorRestanteDaDivida - (totalPagoAtual + novoValor);
    setNovoValor(novoValorRestante > 0 ? novoValorRestante : 0);
    setNovoTipo('saldo');
    setNovaDescricao('');
    setNovaContaOrigemId(contas.length > 0 ? contas[0].id : '');
  };
  
  // Lógica principal de pagamento (Executada ao clicar em "Confirmar Pagamento")
  const processarPagamento = async () => {
    if (!pagamentoEmAberto || !uid || fontesDePagamento.length === 0) {
        return alert("Nenhuma fonte de pagamento adicionada.");
    }
    
    const totalPagoNestaSessao = fontesDePagamento.reduce((sum, f) => sum + f.valor, 0);

    // 1. VALIDAÇÕES FINAIS (O total pago não pode exceder o valor total da dívida)
    if (totalPagoNestaSessao > pagamentoEmAberto.itemValor) {
        return alert(`O total pago (R$ ${totalPagoNestaSessao.toFixed(2)}) não pode exceder o valor pendente (R$ ${pagamentoEmAberto.itemValor.toFixed(2)}).`);
    }

    const { contaIdx, compraIdx, parcelaIdx, faturaIdx, contaId } = pagamentoEmAberto;
    const novasContas = [...contas];
    
    // 2. Pré-validação de Saldo
    const saldosNecessarios: { [key: string]: number } = {};
    fontesDePagamento.filter(f => f.tipo === 'saldo').forEach(f => {
        saldosNecessarios[f.contaOrigemId!] = (saldosNecessarios[f.contaOrigemId!] || 0) + f.valor;
    });

    for (const id in saldosNecessarios) {
        const contaOrigem = novasContas.find(c => c.id === id);
        if (contaOrigem && saldosNecessarios[id] > contaOrigem.saldo) {
            return alert(`Saldo insuficiente na conta de origem ${contaOrigem.nome}. Saldo atual: R$ ${contaOrigem.saldo.toFixed(2)}. Necessário: R$ ${saldosNecessarios[id].toFixed(2)}.`);
        }
    }

    // 3. Obter Descrição do Item
    let itemDescricao = '';
    let item: Fatura | Parcela | undefined;

    if (novasContas[contaIdx].modo === "compra" && compraIdx !== undefined && parcelaIdx !== undefined) {
      item = novasContas[contaIdx].compras![compraIdx].parcelas[parcelaIdx];
      itemDescricao = `Pgto Parcela (Conta: ${novasContas[contaIdx].nome}, Compra: ${novasContas[contaIdx].compras![compraIdx].nome})`;
    } else if (novasContas[contaIdx].modo === "fatura" && faturaIdx !== undefined) {
      item = novasContas[contaIdx].faturas![faturaIdx];
      itemDescricao = `Pgto Fatura ${novasContas[contaIdx].nome}`;
    }

    if (!item) return;

    // 4. ATUALIZAÇÃO CHAVE: Reduzir o valor pendente do item
    item.valor -= totalPagoNestaSessao;
    
    // 5. Marcar como pago se o valor restante for zero ou negativo
    if (item.valor <= 0) {
        item.pago = true;
        item.valor = 0; // Garante que o valor pendente não seja negativo
    }


    // 6. Processar Pagamentos e Registrar Entradas (Saídas)
    const novasEntradas: Entrada[] = [];
    
    // Atualiza saldo e registra saída para pagamentos com Saldo da Conta
    novasContas.forEach(conta => {
        const valorSaida = saldosNecessarios[conta.id] || 0;

        if (valorSaida > 0) {
            conta.saldo -= valorSaida;
            
            novasEntradas.push({
                valor: -valorSaida,
                descricao: `${itemDescricao} (via Saldo da Conta ${conta.nome})`,
                data: dataAtual,
                contaId: conta.id
            });
        }
    });

    // Registra saídas para Terceiros/Outras Contas (sem alterar saldos de conta)
    fontesDePagamento.filter(f => f.tipo === 'terceiros').forEach(f => {
        novasEntradas.push({ 
            valor: -f.valor, 
            descricao: `${itemDescricao} (${f.descricao})`, 
            data: dataAtual, 
            contaId: contaId // Registra na conta que está sendo paga (para rastreamento)
        });
    });

    // 7. Atualizar Estados Locais
    setContas(novasContas);
    setEntradas(prev => [...prev, ...novasEntradas]);
    fecharFormularioPagamento();

    // 8. Atualizar Firebase
    await updateDoc(doc(db, "usuarios", uid), {
      contas: novasContas.map(c => {
          const { id, ...rest } = c;
          return rest;
      }),
      entradas: [...entradas, ...novasEntradas],
    });
  };

  // ... (editarFatura permanece igual)

  const editarFatura = async (contaIdx: number, compraIdx?: number, parcelaIdx?: number, faturaIdx?: number) => {
    if (!uid) return;

    const novasContas = [...contas];
    let item: any;

    if (novasContas[contaIdx].modo === "compra" && compraIdx !== undefined && parcelaIdx !== undefined) {
      item = novasContas[contaIdx].compras![compraIdx].parcelas[parcelaIdx];
    } else if (novasContas[contaIdx].modo === "fatura" && faturaIdx !== undefined) {
      item = novasContas[contaIdx].faturas![faturaIdx];
    }

    if (!item) return;

    const novoValor = parseFloat(prompt("Novo valor:", String(item.valor)) || String(item.valor));
    const novoVencimento = prompt("Novo vencimento (YYYY-MM-DD):", item.vencimento) || item.vencimento;

    item.valor = novoValor;
    item.vencimento = novoVencimento;

    setContas(novasContas);
    await updateDoc(doc(db, "usuarios", uid), { 
        contas: novasContas.map(c => {
            const { id, ...rest } = c;
            return rest;
        })
    });
  };

  if (loading) return <p>Carregando...</p>;

  const saldoTotalContas = contas.reduce((total, conta) => total + conta.saldo, 0);
  const contaEmPagamento = pagamentoEmAberto ? contas[pagamentoEmAberto.contaIdx] : null;
  const totalPagoAtual = fontesDePagamento.reduce((sum, f) => sum + f.valor, 0);
  const restanteDaDivida = pagamentoEmAberto ? pagamentoEmAberto.itemValor : 0;
  const valorPagoNaSessao = fontesDePagamento.reduce((sum, f) => sum + f.valor, 0);
  const valorMaxAdicionar = restanteDaDivida - valorPagoNaSessao;
  
  const contasMap = new Map(contas.map(c => [c.id, c.nome]));

  return (
    <div style={{ padding: "20px" }}>
      <h1>Dashboard</h1>

      <h2>Saldo Total em Contas: R$ {saldoTotalContas.toFixed(2)}</h2>

      {/* Formulário de Pagamento Condicional */}
      {pagamentoEmAberto && contaEmPagamento && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '8px', width: '500px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <h3>Pagar Item: R$ {restanteDaDivida.toFixed(2)} (Pendente)</h3>
            <p>Conta Principal: <strong>{contaEmPagamento.nome}</strong></p>
            <p style={{ fontWeight: 'bold', color: 'blue' }}>
                Valor pago nesta sessão: R$ {valorPagoNaSessao.toFixed(2)}
            </p>
            <hr />

            {/* LISTA DE FONTES DE PAGAMENTO JÁ ADICIONADAS */}
            {fontesDePagamento.map(f => (
                <div key={f.id} style={{ border: '1px solid #eee', padding: '8px', margin: '5px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>
                        R$ **{f.valor.toFixed(2)}** | 
                        {f.tipo === 'saldo' ? ` Saldo: ${contasMap.get(f.contaOrigemId!)}` : ` Outros: ${f.descricao}`}
                    </span>
                    <button onClick={() => setFontesDePagamento(fontesDePagamento.filter(item => item.id !== f.id))} style={{ backgroundColor: 'red', color: 'white', border: 'none', padding: '5px', cursor: 'pointer' }}>X</button>
                </div>
            ))}
            
            <h4 style={{marginTop: '20px'}}>Adicionar Forma de Pagamento</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                
                <select value={novoTipo} onChange={e => setNovoTipo(e.target.value as 'saldo' | 'terceiros')} style={{ padding: '8px' }}>
                    <option value="saldo">Pagar com Saldo de Conta</option>
                    <option value="terceiros">Pagar com Terceiros/Outras Fontes</option>
                </select>

                <input 
                    type="number" 
                    placeholder={`Valor (Max R$ ${valorMaxAdicionar.toFixed(2)})`}
                    value={novoValor} 
                    onChange={e => setNovoValor(Number(e.target.value))} 
                    max={restanteDaDivida}
                    style={{ padding: '8px' }}
                />
            </div>

            {novoTipo === 'saldo' && (
                <select value={novaContaOrigemId} onChange={e => setNovaContaOrigemId(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: '15px' }}>
                    {contas.map(conta => (
                        <option key={conta.id} value={conta.id}>
                            {conta.nome} (Saldo: R$ {conta.saldo.toFixed(2)})
                        </option>
                    ))}
                </select>
            )}

            {novoTipo === 'terceiros' && (
                <input 
                    type="text" 
                    placeholder="Descrição (Ex: Pagamento Pai, Conta Investimento)"
                    value={novaDescricao} 
                    onChange={e => setNovaDescricao(e.target.value)} 
                    style={{ width: '100%', padding: '8px', marginBottom: '15px' }}
                />
            )}
            
            <button 
                onClick={adicionarFontePagamento} 
                disabled={novoValor <= 0 || valorPagoNaSessao >= restanteDaDivida}
                style={{ width: '100%', padding: '10px', backgroundColor: valorPagoNaSessao < restanteDaDivida ? '#007bff' : 'gray', color: 'white', border: 'none', cursor: 'pointer', marginBottom: '15px' }}
            >
                Adicionar Pagamento
            </button>


            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
                <button 
                    onClick={processarPagamento} 
                    disabled={valorPagoNaSessao <= 0} 
                    style={{ padding: '10px 15px', backgroundColor: valorPagoNaSessao > 0 ? 'green' : 'gray', color: 'white', border: 'none', cursor: 'pointer' }}
                >
                    Confirmar Pagamento de R$ {valorPagoNaSessao.toFixed(2)}
                </button>
                <button onClick={fecharFormularioPagamento} style={{ padding: '10px 15px', backgroundColor: '#dc3545', color: 'white', border: 'none', cursor: 'pointer' }}>
                    Cancelar
                </button>
            </div>
          </div>
        </div>
      )}

      {/* ... (Restante do Dashboard.tsx) */}

      <div style={{ marginTop: "20px" }}>
        <h3>Registrar Entrada</h3>
        <input type="number" placeholder="Valor" value={valorEntrada} onChange={e => setValorEntrada(Number(e.target.value))} />
        <input type="text" placeholder="Descrição" list="descricoes" value={descricaoEntrada} onChange={e => setDescricaoEntrada(e.target.value)} />
        <datalist id="descricoes">{historicoDescricoes.map((d, idx) => <option key={idx} value={d} />)}</datalist>
        <input type="date" value={dataEntrada} onChange={e => setDataEntrada(e.target.value)} />
        
        <select value={contaEntradaId} onChange={e => setContaEntradaId(e.target.value)}>
            <option value="" disabled>Selecione a Conta</option>
            {contas.map(conta => (
                <option key={conta.id} value={conta.id}>
                    {conta.nome}
                </option>
            ))}
        </select>
        
        <button onClick={registrarEntrada} disabled={contas.length === 0}>Adicionar Entrada</button>
        {contas.length === 0 && <p style={{color: 'red'}}>Crie uma conta para registrar entradas.</p>}
      </div>

      {/* Contas e Faturas */}
      <div style={{ marginTop: "20px" }}>
        <h3>Contas e Faturas</h3>
        {contas.map((conta, cIdx) => (
          <div key={cIdx} style={{ border: "1px solid #ccc", padding: "10px", marginBottom: "20px" }}>
            <h4>{conta.nome} — Saldo: R$ {conta.saldo.toFixed(2)}</h4>

            {/* Entradas desta Conta */}
            <div style={{ marginTop: "15px", marginBottom: "15px", padding: "10px", border: "1px dashed #ddd" }}>
              <h5>Entradas/Saídas Recentes nesta Conta</h5>
              {entradas
                .filter(e => e.contaId === conta.id) 
                .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()) 
                .slice(0, 5) 
                .map((e, idx) => (
                  <p key={idx} style={{ margin: "5px 0", fontSize: "0.9em", color: e.valor < 0 ? 'red' : 'green' }}>
                    {e.data} — **{e.descricao}** — R$ {e.valor.toFixed(2)}
                  </p>
                ))}
                {entradas.filter(e => e.contaId === conta.id).length === 0 && (
                    <p style={{ fontSize: "0.9em", color: "#666" }}>Nenhuma entrada/saída nesta conta.</p>
                )}
            </div>
            
            {/* Faturas */}
            {conta.modo === "fatura" && conta.faturas && conta.faturas.length > 0 && (
              <ul>
                {conta.faturas.map((f, fIdx) => (
                  <li key={f.vencimento + f.valor}>
                    R$ {f.valor.toFixed(2)} {f.valor > 0 ? 'pendente' : ''} - {f.vencimento} - {f.pago ? "Pago ✅" : "Pendente ❌"}{" "}
                    {!f.pago && (
                      <button onClick={() => abrirFormularioPagamento(cIdx, f.valor, conta.id, undefined, undefined, fIdx)}>Marcar como Paga</button>
                    )}
                    <button onClick={() => editarFatura(cIdx, undefined, undefined, fIdx)}>Editar</button>
                  </li>
                ))}
              </ul>
            )}

            {/* Compras */}
            {conta.modo === "compra" && conta.compras && conta.compras.length > 0 && (
              <ul>
                {conta.compras.map((compra, compIdx) => (
                  <li key={compra.nome}>
                    <strong>{compra.nome}</strong>
                    <ul>
                      {compra.parcelas.map((p, parcIdx) => (
                        <li key={parcIdx}>
                          R$ {p.valor.toFixed(2)} {p.valor > 0 ? 'pendente' : ''} - {p.vencimento} - {p.pago ? "Pago ✅" : "Pendente ❌"}{" "}
                          {!p.pago && (
                            <button onClick={() => abrirFormularioPagamento(cIdx, p.valor, conta.id, compIdx, parcIdx, undefined)}>Marcar como Paga</button>
                          )}
                          <button onClick={() => editarFatura(cIdx, compIdx, parcIdx)}>Editar</button>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}