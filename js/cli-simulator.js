// cli-simulator.js
// Terminal CLI simulado: mostra a instrução do passo atual + o comando a digitar
// (prática de digitação/muscle-memory), executa e mostra a saída simulada.
// Segue o princípio TDAH: um passo por vez, nunca o checklist inteiro na tela.

import { getLabById } from "./labs.js";
import { upsertLabProgress } from "./data-schema.js";
import { logActivity } from "./data-schema.js";
import { escapeHtml } from "./utils.js";

/**
 * Monta e controla o terminal dentro de `container` (um elemento DOM).
 * Retorna um objeto com `destruir()` pra limpar listeners se a tela for trocada.
 */
export async function abrirCLI(uid, labId, container) {
  const lab = await getLabById(labId);
  if (!lab) {
    container.innerHTML = `<p>Laboratório não encontrado.</p>`;
    return;
  }

  let passoAtual = 0;
  let tentativasErradas = 0;
  let promptAtual = lab.promptInicial;
  const historico = [];

  container.innerHTML = `
    <div class="cli-wrapper">
      <div class="cli-instrucoes">
        <div class="cli-instrucoes-label">INSTRUÇÕES</div>
        <div id="cli-instrucao-texto"></div>
        <div class="cli-comando-sugerido" id="cli-comando-sugerido"></div>
      </div>
      <div class="cli-terminal" id="cli-terminal">
        <div class="cli-historico" id="cli-historico"></div>
        <div class="cli-linha-atual">
          <span id="cli-prompt-atual"></span>
          <input type="text" id="cli-input" autocomplete="off" spellcheck="false" />
        </div>
      </div>
      <div id="cli-concluido" class="cli-concluido hidden">
        <p>✅ Laboratório concluído!</p>
      </div>
    </div>
  `;

  const elInstrucao = container.querySelector("#cli-instrucao-texto");
  const elComandoSugerido = container.querySelector("#cli-comando-sugerido");
  const elHistorico = container.querySelector("#cli-historico");
  const elPrompt = container.querySelector("#cli-prompt-atual");
  const elInput = container.querySelector("#cli-input");
  const elTerminal = container.querySelector("#cli-terminal");
  const elConcluido = container.querySelector("#cli-concluido");

  function renderPassoAtual() {
    if (passoAtual >= lab.comandos.length) {
      finalizarLab();
      return;
    }
    const passo = lab.comandos[passoAtual];
    elInstrucao.textContent = passo.instrucao;
    elComandoSugerido.textContent = passo.cmd;
    elPrompt.textContent = promptAtual + " ";
    elInput.value = "";
    elInput.focus();
  }

  function normalizar(str) {
    return str.trim().toLowerCase().replace(/\s+/g, " ");
  }

  function renderHistorico() {
    elHistorico.innerHTML = historico
      .map((linha) => {
        if (linha.tipo === "cmd") return `<div class="cli-linha-hist"><span class="cli-prompt-hist">${escapeHtml(linha.prompt)}</span> ${escapeHtml(linha.texto)}</div>`;
        if (linha.tipo === "saida") return `<div class="cli-linha-hist cli-saida">${escapeHtml(linha.texto).replace(/\n/g, "<br/>")}</div>`;
        if (linha.tipo === "erro") return `<div class="cli-linha-hist cli-erro">${escapeHtml(linha.texto)}</div>`;
        return "";
      })
      .join("");
    elTerminal.scrollTop = elTerminal.scrollHeight;
  }

  function processarComando(valor) {
    const passo = lab.comandos[passoAtual];
    historico.push({ tipo: "cmd", prompt: promptAtual, texto: valor });

    if (normalizar(valor) === normalizar(passo.cmd)) {
      tentativasErradas = 0;
      if (passo.saida) historico.push({ tipo: "saida", texto: passo.saida });
      promptAtual = passo.promptDepois;
      passoAtual += 1;
      renderHistorico();
      renderPassoAtual();
    } else {
      tentativasErradas += 1;
      const dica =
        tentativasErradas >= 2
          ? `% Comando não reconhecido. Dica: digite exatamente "${passo.cmd}"`
          : `% Comando não reconhecido. Confira as instruções acima e tente de novo.`;
      historico.push({ tipo: "erro", texto: dica });
      renderHistorico();
    }
  }

  async function finalizarLab() {
    elInput.disabled = true;
    elComandoSugerido.textContent = "";
    elInstrucao.textContent = "Laboratório concluído!";
    elConcluido.classList.remove("hidden");
    await upsertLabProgress(uid, labId, {
      status: "concluido",
      totalComandos: lab.comandos.length,
      concluidoEm: new Date().toISOString(),
    });
    await logActivity(uid, "lab", lab.topicId, 20);
  }

  function onKeydown(e) {
    if (e.key === "Enter" && elInput.value.trim()) {
      processarComando(elInput.value);
    }
  }

  elInput.addEventListener("keydown", onKeydown);
  container.addEventListener("click", () => elInput.focus());

  renderPassoAtual();

  return {
    destruir() {
      elInput.removeEventListener("keydown", onKeydown);
    },
  };
}
