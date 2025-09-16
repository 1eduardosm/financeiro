import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

type Parcela = {
  valor: number;
  vencimento?: string;
  pago?: boolean;
};

type Compra = {
  nome: string;
  parcelas: Parcela[];
};

type Fatura = {
  valor: number;
  vencimento: string;
  pago?: boolean;
};

type Conta = {
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
  data: string; // YYYY-MM-DD
};

export default function Dashboard() {
  const [saldo, setSaldo] = useState<number>(0);
  const [contas, setContas] = useState<Conta[]>([]);
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [historicoDescricoes, setHistoricoDescricoes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Campos de entrada
  const [valorEntrada, setValorEntrada] = useState<number>(0);
  const [descricaoEntrada, setDescricaoEntrada] = useState<string>("");
  const [dataEntrada, setDataEntrada] = useState<string>("");

  const uid = auth.currentUser?.uid;

  useEffect(() => {
    const carregar = async () => {
      if (!uid) return;

      try {
        const snap = await getDoc(doc(db, "usuarios", uid));
        if (!snap.exists()) return;

        const data = snap.data();

        setSaldo(typeof data.saldo === "number" ? data.saldo : 0);

        // Contas
        const userContas: Conta[] = (data.contas ?? []).map((c: any) => ({
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

        // Entradas
        const entradasExistentes: Entrada[] = (data.entradas ?? []).map((e: any) => ({
          valor: Number(e.valor) ?? 0,
          descricao: e.descricao ?? "",
          data: e.data ?? "",
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

  // Registrar entrada
  const registrarEntrada = async () => {
    if (!uid || valorEntrada <= 0 || !descricaoEntrada || !dataEntrada) {
      return alert("Preencha todos os campos corretamente!");
    }

    const novaEntrada: Entrada = { valor: valorEntrada, descricao: descricaoEntrada, data: dataEntrada };
    const novoSaldo = saldo + valorEntrada;

    setSaldo(novoSaldo);
    setEntradas(prev => [...prev, novaEntrada]);
    if (!historicoDescricoes.includes(descricaoEntrada)) setHistoricoDescricoes(prev => [...prev, descricaoEntrada]);

    await updateDoc(doc(db, "usuarios", uid), {
      saldo: novoSaldo,
      entradas: [...entradas, novaEntrada],
    });

    setValorEntrada(0);
    setDescricaoEntrada("");
    setDataEntrada("");
  };

  // Marcar fatura/parcela como paga
  const pagarFatura = async (contaIdx: number, compraIdx?: number, parcelaIdx?: number, faturaIdx?: number, usarSaldo = true) => {
    if (!uid) return;

    const novasContas = [...contas];
    let valorPagamento = 0;

    const conta = novasContas[contaIdx];

    if (conta.modo === "compra" && compraIdx !== undefined && parcelaIdx !== undefined) {
      const parcela = conta.compras![compraIdx].parcelas[parcelaIdx];
      if (parcela.pago) return;
      parcela.pago = true;
      valorPagamento = parcela.valor;
    } else if (conta.modo === "fatura" && faturaIdx !== undefined) {
      const fatura = conta.faturas![faturaIdx];
      if (fatura.pago) return;
      fatura.pago = true;
      valorPagamento = fatura.valor;
    }

    let novoSaldo = saldo;
    if (usarSaldo) novoSaldo -= valorPagamento;

    setContas(novasContas);
    setSaldo(novoSaldo);

    await updateDoc(doc(db, "usuarios", uid), {
      contas: novasContas,
      saldo: novoSaldo,
    });
  };

  // Editar fatura/parcela
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
    await updateDoc(doc(db, "usuarios", uid), { contas: novasContas });
  };

  if (loading) return <p>Carregando...</p>;

  return (
    <div style={{ padding: "20px" }}>
      <h1>Dashboard</h1>
      <h2>Saldo: R$ {saldo.toFixed(2)}</h2>

      {/* Entradas */}
      <div style={{ marginTop: "20px" }}>
        <h3>Registrar Entrada</h3>
        <input type="number" placeholder="Valor" value={valorEntrada} onChange={e => setValorEntrada(Number(e.target.value))} />
        <input type="text" placeholder="Descrição" list="descricoes" value={descricaoEntrada} onChange={e => setDescricaoEntrada(e.target.value)} />
        <datalist id="descricoes">{historicoDescricoes.map((d, idx) => <option key={idx} value={d} />)}</datalist>
        <input type="date" value={dataEntrada} onChange={e => setDataEntrada(e.target.value)} />
        <button onClick={registrarEntrada}>Adicionar Entrada</button>
      </div>

      {/* Contas */}
      <div style={{ marginTop: "20px" }}>
        <h3>Contas e Faturas</h3>
        {contas.map((conta, cIdx) => (
          <div key={cIdx} style={{ border: "1px solid #ccc", padding: "10px", marginBottom: "10px" }}>
            <h4>{conta.nome}</h4>

            {/* Faturas */}
            {conta.modo === "fatura" && conta.faturas && conta.faturas.length > 0 && (
              <ul>
                {conta.faturas.map((f, fIdx) => (
                  <li key={f.vencimento + f.valor}>
                    R$ {f.valor.toFixed(2)} - {f.vencimento} - {f.pago ? "Pago ✅" : "Pendente ❌"}{" "}
                    {!f.pago && (
                      <>
                        <button onClick={() => pagarFatura(cIdx, undefined, undefined, fIdx, true)}>Pagar com saldo</button>
                        <button onClick={() => pagarFatura(cIdx, undefined, undefined, fIdx, false)}>Marcar pago</button>
                      </>
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
                          R$ {p.valor.toFixed(2)} - {p.vencimento} - {p.pago ? "Pago ✅" : "Pendente ❌"}{" "}
                          {!p.pago && (
                            <>
                              <button onClick={() => pagarFatura(cIdx, compIdx, parcIdx, undefined, true)}>Pagar com saldo</button>
                              <button onClick={() => pagarFatura(cIdx, compIdx, parcIdx, undefined, false)}>Marcar pago</button>
                            </>
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

      {/* Entradas recentes */}
      <div style={{ marginTop: "20px" }}>
        <h3>Entradas Recentes</h3>
        {entradas.length > 0 ? (
          <ul>
            {entradas.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()).map((e, idx) => (
              <li key={idx}>
                {e.data} — {e.descricao} — R$ {e.valor.toFixed(2)}
              </li>
            ))}
          </ul>
        ) : (
          <p>Nenhuma entrada registrada até agr.</p>
        )}
      </div>
    </div>
  );
}
