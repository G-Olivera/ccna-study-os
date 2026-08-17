// finance/constants.js
// Constantes do módulo financeiro. GRUPOS é fixo (tipo do lançamento);
// categorias são geridas pelo usuário (ver categories.js) — a lista abaixo
// é só a sugestão inicial usada no primeiro seed.

// Grupo = tipo financeiro do lançamento (não confundir com Categoria,
// que é "onde o dinheiro foi usado"). Segue a mesma lógica da sua planilha.
export const GRUPOS = {
  FIXOS: "fixos",
  ASSINATURA: "assinatura",
  VARIAVEIS: "variaveis",
  TEMPORARIAS: "temporarias",
  FATURA: "fatura",
  RECEITA: "receita",
  INVESTIMENTO: "investimento",
  RESERVA: "reserva",
  SAQUE: "saque",
};

export const GRUPO_LABEL = {
  fixos: "🏠 Gastos Fixos",
  assinatura: "📺 Assinaturas",
  variaveis: "💸 Gastos Variáveis",
  temporarias: "🧾 Despesas Temporárias",
  fatura: "💳 Pagamento de Fatura",
  receita: "💵 Ganhos",
  investimento: "💰 Investimento",
  reserva: "📝 Reserva",
  saque: "💲 Saque/Resgate",
};

// Grupos que contam como SAÍDA de dinheiro no cálculo de totais.
// "fatura" fica de fora do total de saídas normal — ver REGRA no finance.js
// (calculations.js, Fase 4) sobre evitar dupla contabilização com o cartão.
export const GRUPOS_SAIDA = [GRUPOS.FIXOS, GRUPOS.ASSINATURA, GRUPOS.VARIAVEIS, GRUPOS.TEMPORARIAS, GRUPOS.INVESTIMENTO];
export const GRUPOS_ENTRADA = [GRUPOS.RECEITA, GRUPOS.SAQUE];

export const FORMAS_PAGAMENTO = ["Pix", "Débito", "Crédito", "Dinheiro", "Transferência", "Boleto", "Outros"];

export const OPCOES_PARCELAMENTO = ["À vista", ...Array.from({ length: 23 }, (_, i) => `${i + 2}x`)];

export const OPCOES_RECORRENCIA = ["mensal", "semanal", "anual", "personalizada"];

/** Categorias sugeridas no primeiro uso — o usuário pode editar/excluir todas depois. */
export const CATEGORIAS_PADRAO = [
  { nome: "Alimentação", icone: "🍽️" },
  { nome: "Transporte", icone: "🚗" },
  { nome: "Moradia", icone: "🏠" },
  { nome: "Saúde", icone: "💊" },
  { nome: "Estudos", icone: "📚" },
  { nome: "Tecnologia", icone: "💻" },
  { nome: "Lazer", icone: "🎮" },
  { nome: "Compras", icone: "🛍️" },
  { nome: "Assinaturas", icone: "📺" },
  { nome: "Investimentos", icone: "💰" },
  { nome: "Salário", icone: "💼" },
  { nome: "Outros", icone: "📦" },
];
