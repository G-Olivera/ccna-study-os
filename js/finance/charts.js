// finance/charts.js
// Gráficos simples desenhados à mão em SVG — sem biblioteca externa, então
// nada de dependência pesada nem risco de violar a CSP do site.

export const CORES_GRAFICO = ["#3E6B6B", "#C97B4A", "#5B8266", "#B3654A", "#6B5B95", "#4A7C9B", "#D4876C", "#7FAE8C"];

/** Monta um gráfico donut SVG a partir de [{label, valor}]. */
export function gerarDonutSVG(dados, tamanho = 160) {
  const total = dados.reduce((acc, d) => acc + d.valor, 0);
  if (total <= 0) {
    return `<p style="font-size:13px; color:var(--ink-soft); text-align:center; padding:20px 0;">Sem dados neste período.</p>`;
  }

  const raio = tamanho / 2 - 14;
  const centro = tamanho / 2;
  const circunferencia = 2 * Math.PI * raio;
  let acumulado = 0;

  const fatias = dados
    .map((d, i) => {
      const fracao = d.valor / total;
      const comprimento = fracao * circunferencia;
      const offset = circunferencia - acumulado;
      acumulado += comprimento;
      const cor = CORES_GRAFICO[i % CORES_GRAFICO.length];
      return `<circle cx="${centro}" cy="${centro}" r="${raio}" fill="none" stroke="${cor}" stroke-width="20"
        stroke-dasharray="${comprimento} ${circunferencia - comprimento}" stroke-dashoffset="${offset}"
        transform="rotate(-90 ${centro} ${centro})" />`;
    })
    .join("");

  return `<svg viewBox="0 0 ${tamanho} ${tamanho}" width="${tamanho}" height="${tamanho}">${fatias}</svg>`;
}

/** Monta um gráfico de linhas simples (evolução mensal: entradas x saídas). */
export function gerarLinhasSVG(pontosEntrada, pontosSaida, largura = 320, altura = 140) {
  if (pontosEntrada.length === 0) {
    return `<p style="font-size:13px; color:var(--ink-soft);">Sem dados suficientes ainda.</p>`;
  }

  const maiorValor = Math.max(1, ...pontosEntrada, ...pontosSaida);
  const passoX = largura / Math.max(1, pontosEntrada.length - 1);
  const margem = 10;

  function paraPath(pontos) {
    return pontos
      .map((v, i) => `${i === 0 ? "M" : "L"} ${(i * passoX).toFixed(1)} ${(altura - margem - (v / maiorValor) * (altura - margem * 2)).toFixed(1)}`)
      .join(" ");
  }

  return `<svg viewBox="0 0 ${largura} ${altura}" width="100%" height="${altura}" preserveAspectRatio="none">
    <path d="${paraPath(pontosSaida)}" fill="none" stroke="var(--terracotta)" stroke-width="2.5" />
    <path d="${paraPath(pontosEntrada)}" fill="none" stroke="var(--sage)" stroke-width="2.5" />
  </svg>`;
}
