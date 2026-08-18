// finance/recurring.js
// Gastos recorrentes: cada um tem um mapa `pagamentos` ({ "2026-08": "pago" })
// pra rastrear status mês a mês, sem precisar de uma coleção separada por mês.

import { createGastoFixo, getGastosFixos, deleteGastoFixo, updateGastoFixo } from "../data-schema.js";
import { anoMesDeHoje } from "./period.js";

export async function adicionarGastoRecorrente(uid, dados) {
  return createGastoFixo(uid, {
    descricao: dados.descricao,
    grupo: dados.grupo || "fixos",
    categoriaId: dados.categoriaId || null,
    valorMedio: Number(dados.valorMedio),
    diaVencimento: Number(dados.diaVencimento),
    formaPagamento: dados.formaPagamento || "",
    recorrencia: dados.recorrencia || "mensal",
    dataInicial: dados.dataInicial || new Date().toISOString().slice(0, 10),
    dataFinal: dados.dataFinal || null,
    ativo: true,
    pagamentos: {},
  });
}

export async function listarGastosRecorrentes(uid, apenasAtivos = true) {
  const gastos = await getGastosFixos(uid);
  const filtrados = apenasAtivos ? gastos.filter((g) => g.ativo !== false) : gastos;
  return filtrados.sort((a, b) => a.diaVencimento - b.diaVencimento);
}

/** Status do gasto num mês específico: "pago" | "atrasado" | "pendente". */
export function calcularStatusVencimento(gasto, anoMes) {
  const statusSalvo = gasto.pagamentos?.[anoMes];
  if (statusSalvo === "pago") return "pago";

  if (anoMes === anoMesDeHoje()) {
    const hoje = new Date();
    if (hoje.getDate() > gasto.diaVencimento) return "atrasado";
  }
  return "pendente";
}

export async function marcarStatusGasto(uid, gasto, anoMes, novoStatus) {
  const novosPagamentos = { ...(gasto.pagamentos || {}), [anoMes]: novoStatus };
  await updateGastoFixo(uid, gasto.id, { pagamentos: novosPagamentos });
}

export async function alternarAtivoGasto(uid, gastoId, ativoAtual) {
  await updateGastoFixo(uid, gastoId, { ativo: !ativoAtual });
}

export async function editarGastoRecorrente(uid, gastoId, dados) {
  await updateGastoFixo(uid, gastoId, dados);
}

export async function removerGastoRecorrente(uid, gastoId) {
  return deleteGastoFixo(uid, gastoId);
}
