// finance/insights.js
// Frases automáticas com base nos dados do mês — puro cálculo em JS, sem IA
// (mais rápido, mais previsível, sem custo nenhum).

import { formatarMoeda } from "./period.js";

export function gerarResumoFinanceiro(resumo, categoriasCache, resumoAnterior) {
  const frases = [];
  const mapaCategorias = Object.fromEntries((categoriasCache || []).map((c) => [c.id, c]));

  if (resumo.totalSaidas > 0) {
    frases.push(`Você gastou ${formatarMoeda(resumo.totalSaidas)} neste período.`);
  } else {
    frases.push("Nenhuma saída registrada neste período ainda.");
    return frases;
  }

  const categoriasOrdenadas = Object.entries(resumo.porCategoria || {}).sort((a, b) => b[1] - a[1]);
  if (categoriasOrdenadas.length > 0) {
    const [catId, valor] = categoriasOrdenadas[0];
    const nome = mapaCategorias[catId]?.nome || "Sem categoria";
    const percentual = Math.round((valor / resumo.totalSaidas) * 100);
    frases.push(`${nome} representa ${percentual}% das suas despesas.`);
  }

  if (resumoAnterior && resumoAnterior.totalSaidas > 0) {
    const variacao = Math.round(((resumo.totalSaidas - resumoAnterior.totalSaidas) / resumoAnterior.totalSaidas) * 100);
    if (variacao !== 0) {
      frases.push(`Seus gastos ${variacao > 0 ? "aumentaram" : "diminuíram"} ${Math.abs(variacao)}% em relação ao período anterior.`);
    }
  }

  if (resumo.metaGasto) {
    const disponivel = resumo.metaGasto - resumo.totalSaidas;
    if (disponivel > 0) {
      frases.push(`Você ainda possui ${formatarMoeda(disponivel)} disponíveis dentro do orçamento.`);
    } else {
      frases.push(`Você ultrapassou o orçamento em ${formatarMoeda(Math.abs(disponivel))}.`);
    }
  }

  return frases;
}

/** Indicadores de comparação com o período anterior (Despesas +12%, Receitas +5%...). */
export function gerarComparacaoAnterior(resumo, resumoAnterior) {
  if (!resumoAnterior) return null;

  function variacaoPercentual(atual, anterior) {
    if (anterior === 0) return atual > 0 ? 100 : 0;
    return Math.round(((atual - anterior) / anterior) * 100);
  }

  return {
    despesas: variacaoPercentual(resumo.totalSaidas, resumoAnterior.totalSaidas),
    receitas: variacaoPercentual(resumo.totalEntradas, resumoAnterior.totalEntradas),
    saldo: variacaoPercentual(resumo.saldo, resumoAnterior.saldo),
  };
}
