// timer-ui.js
// DOM glue do cartão de cronômetro (Pomodoro simples) da tela "Hoje".
// Toda a lógica de cronometragem em si mora em timer.js — este módulo só liga
// os botões, atualiza o texto/intervalo na tela, e persiste o progresso.
//
// Extraído de app.js (qualidade de código): era a seção mais autocontida do
// arquivo — único ponto de uso de todas as funções de timer.js.

import {
  iniciarCronometro,
  pausarCronometro,
  reiniciarCronometro,
  segundosAtuais,
  estaRodando,
  formatarTempo,
  salvarProgressoCronometro,
  buscarMinutosHoje,
} from "./timer.js";

let intervaloCronometro = null;
let intervaloSalvarAuto = null;

/**
 * @param {string} uid
 * @param {() => (string|undefined)} getFocusTopicId - lê o foco do dia NO MOMENTO
 *   em que é chamada (não no momento em que o cronômetro foi montado), porque o
 *   plano do dia pode ser recalculado depois que esta tela já abriu.
 */
export async function inicializarCronometroUI(uid, getFocusTopicId) {
  const display = document.getElementById("cronometro-display");
  const card = document.getElementById("cronometro-card");
  const btnToggle = document.getElementById("btn-cronometro-toggle");
  const btnReset = document.getElementById("btn-cronometro-reset");
  const hojeTexto = document.getElementById("cronometro-hoje-texto");

  async function atualizarTextoHoje() {
    const minutosHoje = await buscarMinutosHoje(uid);
    const h = Math.floor(minutosHoje / 60);
    const m = Math.round(minutosHoje % 60);
    hojeTexto.textContent = h > 0 ? `Hoje: ${h}h ${m}min estudados` : `Hoje: ${m} min estudados`;
  }

  function tick() {
    display.textContent = formatarTempo(segundosAtuais());
  }

  btnToggle.addEventListener("click", async () => {
    if (estaRodando()) {
      pausarCronometro();
      card.classList.remove("rodando");
      btnToggle.textContent = "Continuar";
      clearInterval(intervaloCronometro);
      clearInterval(intervaloSalvarAuto);
      await salvarProgressoCronometro(uid, getFocusTopicId());
      await atualizarTextoHoje();
    } else {
      iniciarCronometro();
      card.classList.add("rodando");
      btnToggle.textContent = "Pausar";
      intervaloCronometro = setInterval(tick, 1000);
      // salva automaticamente a cada 2 min, pra não perder tempo se a aba fechar
      intervaloSalvarAuto = setInterval(async () => {
        await salvarProgressoCronometro(uid, getFocusTopicId());
        await atualizarTextoHoje();
      }, 120000);
    }
  });

  btnReset.addEventListener("click", async () => {
    if (estaRodando()) {
      pausarCronometro();
      await salvarProgressoCronometro(uid, getFocusTopicId());
      await atualizarTextoHoje();
    }
    reiniciarCronometro();
    card.classList.remove("rodando");
    btnToggle.textContent = "Iniciar";
    clearInterval(intervaloCronometro);
    clearInterval(intervaloSalvarAuto);
    display.textContent = "00:00";
  });

  display.textContent = "00:00";
  await atualizarTextoHoje();
}
