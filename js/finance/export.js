// finance/export.js
// Exporta a lista de transações filtrada (a que está sendo exibida na tela)
// como um arquivo CSV, pronto pra abrir em Excel/Sheets.

import { formatarDataBR } from "./period.js";

export function gerarCSVTransacoes(transacoes, mapaCategorias, grupoLabel) {
  const cabecalho = ["Data", "Tipo", "Grupo", "Categoria", "Descrição", "Forma de Pagamento", "Parcela", "Valor"];
  const linhas = transacoes.map((t) => {
    const categoria = mapaCategorias[t.categoriaId]?.nome || "";
    const parcela = t.totalParcelas > 1 ? `${t.parcela}/${t.totalParcelas}` : "";
    const valorFormatado = t.valor.toFixed(2).replace(".", ",");
    return [
      formatarDataBR(t.data),
      t.tipo === "entrada" ? "Entrada" : "Saída",
      grupoLabel[t.grupo] || t.grupo,
      categoria,
      t.descricao || "",
      t.formaPagamento || "",
      parcela,
      valorFormatado,
    ];
  });

  const escapar = (campo) => `"${String(campo).replace(/"/g, '""')}"`;
  const csv = [cabecalho, ...linhas].map((linha) => linha.map(escapar).join(";")).join("\n");

  // BOM UTF-8 no início — sem isso, o Excel abre acentos quebrados.
  return "\uFEFF" + csv;
}

export function baixarCSV(conteudoCSV, nomeArquivo) {
  const blob = new Blob([conteudoCSV], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
