import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

export default function Dashboard() {
  const [saldo, setSaldo] = useState<number | null>(null);
  const [parcelamentos, setParcelamentos] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const carregarDados = async () => {
      if (!auth.currentUser) return;
      const uid = auth.currentUser.uid;

      try {
        const userRef = doc(db, "usuarios", uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const data = userSnap.data();
          setSaldo(data.saldo ?? 0);
          setParcelamentos(data.parcelamentos || []);
        } else {
          setSaldo(0);
          setParcelamentos([]);
        }
      } catch (error: any) {
        console.error(error);
        alert("Erro ao carregar dados: " + error.message);
      } finally {
        setCarregando(false);
      }
    };

    carregarDados();
  }, []);

  if (carregando) {
    return <p>Carregando dados...</p>;
  }

  return (
    <div style={{ padding: "20px" }}>
      <h1>Dashboard</h1>

      <h2>Saldo Inicial: R$ {saldo?.toFixed(2)}</h2>

      <h3>Parcelamentos Ativos</h3>
      {parcelamentos.length > 0 ? (
        <ul>
          {parcelamentos.map((p, index) => (
            <li key={index}>
              {p.descricao} - {p.parcelasPagas}/{p.parcelasTotais} pagas - Valor da parcela: R$ {p.valorParcela?.toFixed(2)}
            </li>
          ))}
        </ul>
      ) : (
        <p>Nenhum parcelamento cadastrado</p>
      )}
    </div>
  );
}
