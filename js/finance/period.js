// finance/period.js
// Funções utilitárias pro seletor de período ("< Agosto 2026 >") e pras
// opções rápidas (mês atual, mês anterior, últimos 3/6 meses, ano atual).

const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function anoMesDeHoje() {
  return new Date().toISOString().slice(0, 7); // "YYYY-MM"
}

export function formatarAnoMes(anoMes) {
  const [ano, mes] = anoMes.split("-").map(Number);
  return `${MESES_PT[mes - 1]} ${ano}`;
}

/** Soma (ou subtrai, com delta negativo) meses a um "YYYY-MM". */
export function deslocarAnoMes(anoMes, delta) {
  const [ano, mes] = anoMes.split("-").map(Number);
  const data = new Date(ano, mes - 1 + delta, 1);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}

/** Gera a lista de "YYYY-MM" entre um período (inclusive), pra relatórios/gráficos de evolução. */
export function listarAnoMesEntre(anoMesInicio, anoMesFim) {
  const lista = [];
  let atual = anoMesInicio;
  while (atual <= anoMesFim) {
    lista.push(atual);
    atual = deslocarAnoMes(atual, 1);
  }
  return lista;
}

/** Faixas rápidas: mês atual, mês anterior, últimos 3/6 meses, ano atual. */
export function faixaRapida(tipo) {
  const hoje = anoMesDeHoje();
  switch (tipo) {
    case "mes-atual":
      return [hoje];
    case "mes-anterior": {
      const anterior = deslocarAnoMes(hoje, -1);
      return [anterior];
    }
    case "ultimos-3":
      return listarAnoMesEntre(deslocarAnoMes(hoje, -2), hoje);
    case "ultimos-6":
      return listarAnoMesEntre(deslocarAnoMes(hoje, -5), hoje);
    case "ano-atual": {
      const ano = hoje.slice(0, 4);
      return listarAnoMesEntre(`${ano}-01`, hoje);
    }
    default:
      return [hoje];
  }
}

/** Formata número em Real brasileiro: R$ 1.234,56 */
export function formatarMoeda(valor) {
  return (valor ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Formata data ISO ("YYYY-MM-DD") como DD/MM/AAAA. */
export function formatarDataBR(dataIso) {
  if (!dataIso) return "";
  const [ano, mes, dia] = dataIso.split("-");
  return `${dia}/${mes}/${ano}`;
}

/** Soma (ou subtrai) meses a uma data completa "YYYY-MM-DD" — usado no parcelamento. */
export function somarMesesData(dataIso, n) {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  const data = new Date(ano, mes - 1 + n, dia);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}
