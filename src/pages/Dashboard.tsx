import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { doc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";

type Fatura = {
  valor: number;
  vencimento: string;
  pago: boolean;
};

type Cartao = {
  nome: string;
  faturas: Fatura[];
};

type Entrada = {
  valor: number;
  descricao: string;
  data: string; // YYYY-MM-DD
};

export default function Dashboard() {
  const [saldo, setSaldo] = useState<number>(0);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [historicoDescricoes, setHistoricoDescricoes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Campos do formulário de entrada
  const [valorEntrada, setValorEntrada] = useState<number>(0);
  const [descricaoEntrada, setDescricaoEntrada] = useState<string>("");
  const [dataEntrada, setDataEntrada] = useState<string>("");

  const uid = auth.currentUser?.uid;

  useEffect(() => {
    const carregar = async () => {
      if (!uid) return;

      try {
        const ref = doc(db, "usuarios", uid);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          const data = snap.data();
          setSaldo(typeof data.saldo === "number" ? data.saldo : 0);

          // Cartões e faturas
          const userCartoes: Cartao[] = [];
          (data.parcelamentos ?? []).forEach((c: any) => {
            let existente = userCartoes.find(cart => cart.nome === c.nome);
            if (!existente) {
              existente = { nome: c.nome ?? "Cartão sem nome", faturas: [] };
              userCartoes.push(existente);
            }

            (c.faturas ?? []).forEach((f: any) => {
              const jaExiste = existente!.faturas.some(
                ft => ft.vencimento === f.vencimento && ft.valor === f.valor
              );
              if (!jaExiste) {
                existente!.faturas.push({
                  valor: typeof f.valor === "number" ? f.valor : 0,
                  vencimento: f.vencimento ?? "Sem vencimento",
                  pago: f.pago ?? false,
                });
              }
            });
          });
          setCartoes(userCartoes);

          // Entradas existentes
          const entradasExistentes: Entrada[] = (data.entradas ?? []).map((e: any) => ({
            valor: typeof e.valor === "number" ? e.valor : 0,
            descricao: String(e.descricao ?? ""),
            data: String(e.data ?? ""),
          }));
          setEntradas(entradasExistentes);

          // Histórico de descrições
          const descricoes = Array.from(new Set(entradasExistentes.map(e => e.descricao)));
          setHistoricoDescricoes(descricoes);
        }
      } catch (err) {
        console.error("Erro ao carregar:", err);
      } finally {
        setLoading(false);
      }
    };

    carregar();
  }, [uid]);

  // Registrar nova entrada detalhada
  const registrarEntrada = async () => {
    if (!uid || valorEntrada <= 0 || !descricaoEntrada || !dataEntrada) {
      return alert("Preencha todos os campos corretamente!");
    }

    const novaEntrada: Entrada = {
      valor: valorEntrada,
      descricao: descricaoEntrada,
      data: dataEntrada,
    };

    const novoSaldo = saldo + valorEntrada;
    setSaldo(novoSaldo);
    setEntradas(prev => [...prev, novaEntrada]);

    // Atualiza histórico de descrições
    if (!historicoDescricoes.includes(descricaoEntrada)) {
      setHistoricoDescricoes(prev => [...prev, descricaoEntrada]);
    }

    const ref = doc(db, "usuarios", uid);
    await updateDoc(ref, {
      saldo: novoSaldo,
      entradas: arrayUnion(novaEntrada),
    });

    // Resetar campos
    setValorEntrada(0);
    setDescricaoEntrada("");
    setDataEntrada("");
  };

  // Marcar fatura como paga
  const pagarFatura = async (cartaoIndex: number, faturaIndex: number) => {
    if (!uid) return;

    const novosCartoes = [...cartoes];
    const fatura = novosCartoes[cartaoIndex].faturas[faturaIndex];
    if (fatura.pago) return;

    fatura.pago = true;
    const novoSaldo = saldo - (fatura.valor ?? 0);

    setCartoes(novosCartoes);
    setSaldo(novoSaldo);

    const ref = doc(db, "usuarios", uid);
    await updateDoc(ref, {
      parcelamentos: novosCartoes,
      saldo: novoSaldo,
    });
  };

  if (loading) return <p>Carregando...</p>;

  return (
    <div style={{ padding: "20px" }}>
      <h1>Dashboard</h1>
      <h2>Saldo: R$ {saldo.toFixed(2)}</h2>

      {/* Registrar entrada detalhada */}
      <div style={{ marginTop: "20px" }}>
        <h3>Registrar Entrada</h3>
        <input
          type="number"
          value={valorEntrada}
          onChange={(e) => setValorEntrada(parseFloat(e.target.value))}
          placeholder="Valor"
        />
        <input
          type="text"
          list="descricoes"
          value={descricaoEntrada}
          onChange={(e) => setDescricaoEntrada(e.target.value)}
          placeholder="Descrição (ex: Salário)"
        />
        <datalist id="descricoes">
          {historicoDescricoes.map((d, idx) => (
            <option key={idx} value={d} />
          ))}
        </datalist>
        <input
          type="date"
          value={dataEntrada}
          onChange={(e) => setDataEntrada(e.target.value)}
        />
        <button onClick={registrarEntrada}>Adicionar Entrada</button>
      </div>

      {/* Cartões e faturas */}
      <div style={{ marginTop: "20px" }}>
        <h3>Cartões de Crédito</h3>
        {cartoes.length > 0 ? (
          cartoes.map((cartao, cIdx) => {
            const ordenadas = [...cartao.faturas].sort(
              (a, b) => new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime()
            );
            const abertas = ordenadas.filter(f => !f.pago);
            if (abertas.length === 0) return null;

            return (
              <div key={cIdx} style={{ border: "1px solid #ccc", margin: "10px", padding: "10px" }}>
                <h4>{cartao.nome}</h4>
                <ul>
                  {abertas.map((f, fIdx) => (
                    <li key={f.vencimento + f.valor}>
                      Vencimento: {f.vencimento} — R$ {f.valor.toFixed(2)} — Pendente ❌{" "}
                      <button onClick={() => pagarFatura(cIdx, fIdx)}>Marcar como paga</button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        ) : (
          <p>não há cartão cadastrado.</p>
        )}
      </div>

      {/* Entradas recentes */}
      <div style={{ marginTop: "20px" }}>
        <h3>Entradas Recentes</h3>
        {entradas.length > 0 ? (
          <ul>
            {entradas
              .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
              .map((e, idx) => (
                <li key={e.data + e.descricao + idx}>
                  {e.data} — {e.descricao} — R$ {e.valor.toFixed(2)}
                </li>
              ))}
          </ul>
        ) : (
          <p>Nenhuma entrada registrada ainda.</p>
        )}
      </div>
    </div>
  );
}
