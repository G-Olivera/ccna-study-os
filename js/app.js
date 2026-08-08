// app.js
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

import { seedContentIfNeeded, getModulosResumo } from "./seed-content.js";
import { seedQuestionsIfNeeded } from "./seed-questions.js";
import { seedLabsIfNeeded } from "./seed-labs.js";
import { seedFlashcardsIfNeeded } from "./seed-flashcards.js";
import { generateDailyPlan, markPlanSectionComplete } from "./daily-plan.js";
import { getDueCards, reviewAndSave, QUALITY } from "./srs-engine.js";
import { getDashboardData } from "./dashboard.js";
import { verificarConquistas, getConquistasDesbloqueadas, CONQUISTAS, definirMeta, progressoMeta } from "./gamification.js";
import { verificarAusencia, ajustarPlanoParaRetorno } from "./anti-procrastination.js";
import { gerarRevisaoRapida } from "./quick-review.js";
import { explicarTopico, perguntarLivre } from "./ai-tutor.js";
import { logActivity, getAllTopics, getAllUserTopicProgress, getUserTopicProgress, upsertUserTopicProgress } from "./data-schema.js";
import { gerarSimulado, corrigirESalvarSimulado } from "./simulado.js";
import { definirCronograma, calcularRitmo } from "./planner.js";
import { abrirCLI } from "./cli-simulator.js";
import { adicionarTarefa, getTarefasDeHoje, marcarConcluida, removerTarefa, CATEGORIA_LABEL, SUGESTOES_BEMESTAR } from "./organizer.js";
import { escapeHtml } from "./utils.js";
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

let currentUser = null;
let planoHoje = null;
let filaCards = [];
let duracaoRevisaoSelecionada = 0; // 0 = sem limite de tempo ("Tudo")
let cardAtual = null;
let simuladoAtivo = null;
let respostasSimulado = {};

const SECOES_ORDEM = ["teoria", "lab", "revisao", "flashcards", "quiz", "desafio"];
const SECOES_LABEL = { teoria: "Teoria", lab: "Laboratório", revisao: "Revisão", flashcards: "Flashcards", quiz: "Quiz", desafio: "Desafio" };

// ---------- AUTH ----------

document.getElementById("btn-login").addEventListener("click", async () => {
  const email = document.getElementById("login-email").value;
  const senha = document.getElementById("login-senha").value;
  try {
    await signInWithEmailAndPassword(auth, email, senha);
  } catch (e) {
    document.getElementById("login-erro").textContent = "E-mail ou senha inválidos.";
  }
});

// "Criar conta" fica desativado por padrão (app pessoal, sem cadastro público).
// O listener só é anexado se o botão existir no HTML — evita quebrar o app
// caso você reative o botão comentado no index.html.
document.getElementById("btn-signup")?.addEventListener("click", async () => {
  const email = document.getElementById("login-email").value;
  const senha = document.getElementById("login-senha").value;
  try {
    await createUserWithEmailAndPassword(auth, email, senha);
  } catch (e) {
    document.getElementById("login-erro").textContent = e.message;
  }
});

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    document.getElementById("login-screen").classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");

    // Seeds best-effort — só têm efeito real se as regras liberarem escrita pro seu UID.
    seedContentIfNeeded().catch(() => {});
    seedQuestionsIfNeeded().catch(() => {});
    seedLabsIfNeeded().catch(() => {});
    seedFlashcardsIfNeeded().catch(() => {});

    await carregarHoje();
    await inicializarCronometroUI();
  } else {
    currentUser = null;
    document.getElementById("login-screen").classList.remove("hidden");
    document.getElementById("app").classList.add("hidden");
  }
});

// ---------- NAVEGAÇÃO ----------

document.querySelectorAll(".bottomnav button").forEach((btn) => {
  btn.addEventListener("click", () => trocarTela(btn.dataset.tela));
});

function trocarTela(nome) {
  document.querySelectorAll(".tela").forEach((t) => t.classList.add("hidden"));
  document.getElementById(`tela-${nome}`).classList.remove("hidden");
  document.querySelectorAll(".bottomnav button").forEach((b) => b.classList.toggle("active", b.dataset.tela === nome));

  if (nome === "flashcards") carregarFlashcards();
  if (nome === "dashboard") carregarDashboard();
  if (nome === "trilha") carregarTrilha();
  if (nome === "tarefas") carregarTarefas();
}

// ---------- TELA HOJE ----------

async function carregarHoje() {
  planoHoje = await generateDailyPlan(currentUser.uid, { minutosDisponiveis: 45 });

  const ausencia = await verificarAusencia(currentUser.uid);
  const banner = document.getElementById("banner-retorno");
  if (ausencia.ausente) {
    planoHoje = ajustarPlanoParaRetorno(planoHoje, ausencia.multiplicadorCarga);
    banner.textContent = ausencia.mensagem;
    banner.classList.remove("hidden");
  } else {
    banner.classList.add("hidden");
  }

  document.getElementById("hoje-foco-tag").textContent = `Foco: ${planoHoje.focusTopic.nome}`;
  renderRotaHops();
  renderTaskCardAtual();
}

function proximaSecaoPendente() {
  return SECOES_ORDEM.find((s) => !planoHoje[s]?.concluido);
}

function renderRotaHops() {
  const container = document.getElementById("rota-hops");
  container.innerHTML = "";
  const secaoAtual = proximaSecaoPendente();

  SECOES_ORDEM.forEach((secao, i) => {
    const concluido = planoHoje[secao]?.concluido;
    const atual = secao === secaoAtual;

    const hop = document.createElement("div");
    hop.className = `hop ${concluido ? "concluido" : ""} ${atual ? "atual" : ""}`;
    hop.innerHTML = `<div class="hop-node">${concluido ? "✓" : i + 1}</div><div class="hop-label">${SECOES_LABEL[secao]}</div>`;
    container.appendChild(hop);

    if (i < SECOES_ORDEM.length - 1) {
      const line = document.createElement("div");
      line.className = `hop-line ${concluido ? "concluido" : ""}`;
      container.appendChild(line);
    }
  });
}

function renderTaskCardAtual() {
  const secao = proximaSecaoPendente();
  const card = document.getElementById("task-card");

  if (!secao) {
    document.getElementById("task-eyebrow").textContent = "CONCLUÍDO";
    document.getElementById("task-titulo").textContent = "Você terminou o plano de hoje! 🎉";
    document.getElementById("task-descricao").textContent = "Volte amanhã pra continuar de onde parou.";
    document.getElementById("task-acao").classList.add("hidden");
    return;
  }

  document.getElementById("task-acao").classList.remove("hidden");
  document.getElementById("task-eyebrow").textContent = SECOES_LABEL[secao].toUpperCase();

  if (secao === "teoria") {
    document.getElementById("task-titulo").textContent = planoHoje.focusTopic.nome;
    document.getElementById("task-descricao").textContent = "Toque em começar pra receber uma explicação do Tutor IA.";
    document.getElementById("task-acao").textContent = "Explicar este tópico";
    document.getElementById("task-acao").onclick = async () => {
      document.getElementById("task-acao").textContent = "Gerando explicação…";
      try {
        const resposta = await explicarTopico(planoHoje.focusTopic.nome, "iniciante");
        document.getElementById("task-descricao").textContent = resposta;
        document.getElementById("task-acao").textContent = "Entendi, concluir";
        document.getElementById("task-acao").onclick = () => concluirSecao("teoria", 10);
      } catch (e) {
        document.getElementById("task-descricao").textContent =
          "Não consegui gerar a explicação agora (o Tutor IA pode ainda não estar configurado). Você pode marcar como concluído mesmo assim.";
        document.getElementById("task-acao").textContent = "Concluir mesmo assim";
        document.getElementById("task-acao").onclick = () => concluirSecao("teoria", 10);
      }
    };
  } else if (secao === "flashcards" || secao === "revisao") {
    document.getElementById("task-titulo").textContent = "Hora de revisar";
    document.getElementById("task-descricao").textContent = `${planoHoje.revisao.totalDevido} card(s) esperando por você.`;
    document.getElementById("task-acao").textContent = "Ir para os flashcards";
    document.getElementById("task-acao").onclick = () => trocarTela("flashcards");
  } else if (secao === "lab") {
    document.getElementById("task-titulo").textContent = planoHoje.lab.titulo || "Laboratório do dia";
    if (planoHoje.lab.labId) {
      document.getElementById("task-descricao").textContent = "Pratique os comandos direto no terminal simulado.";
      document.getElementById("task-acao").textContent = "Abrir terminal CLI";
      document.getElementById("task-acao").onclick = () => trocarTela("trilha");
    } else {
      document.getElementById("task-descricao").textContent = planoHoje.lab.pendente || "Vá até a Trilha pra abrir o laboratório.";
      document.getElementById("task-acao").textContent = "Marcar como feito";
      document.getElementById("task-acao").onclick = () => concluirSecao("lab", 25);
    }
  } else if (secao === "quiz") {
    document.getElementById("task-titulo").textContent = "Quiz rápido do tópico";
    document.getElementById("task-descricao").textContent = planoHoje.quiz.pendente || `${planoHoje.quiz.questoes.length} questões sobre ${planoHoje.focusTopic.nome}.`;
    document.getElementById("task-acao").textContent = "Marcar como feito";
    document.getElementById("task-acao").onclick = () => concluirSecao("quiz", 10);
  } else if (secao === "desafio") {
    document.getElementById("task-titulo").textContent = "Desafio prático";
    document.getElementById("task-descricao").textContent = planoHoje.desafio.descricao;
    document.getElementById("task-acao").textContent = "Concluí o desafio";
    document.getElementById("task-acao").onclick = () => concluirSecao("desafio", 10);
  }
}

async function concluirSecao(secao, minutos) {
  planoHoje = await markPlanSectionComplete(currentUser.uid, secao);
  await logActivity(currentUser.uid, secao, planoHoje.focusTopic.id, minutos);
  renderRotaHops();
  renderTaskCardAtual();
}

// ---------- CRONÔMETRO ----------

let intervaloCronometro = null;
let intervaloSalvarAuto = null;

async function inicializarCronometroUI() {
  const display = document.getElementById("cronometro-display");
  const card = document.getElementById("cronometro-card");
  const btnToggle = document.getElementById("btn-cronometro-toggle");
  const btnReset = document.getElementById("btn-cronometro-reset");
  const hojeTexto = document.getElementById("cronometro-hoje-texto");

  async function atualizarTextoHoje() {
    const minutosHoje = await buscarMinutosHoje(currentUser.uid);
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
      await salvarProgressoCronometro(currentUser.uid, planoHoje?.focusTopic?.id);
      await atualizarTextoHoje();
    } else {
      iniciarCronometro();
      card.classList.add("rodando");
      btnToggle.textContent = "Pausar";
      intervaloCronometro = setInterval(tick, 1000);
      // salva automaticamente a cada 2 min, pra não perder tempo se a aba fechar
      intervaloSalvarAuto = setInterval(async () => {
        await salvarProgressoCronometro(currentUser.uid, planoHoje?.focusTopic?.id);
        await atualizarTextoHoje();
      }, 120000);
    }
  });

  btnReset.addEventListener("click", async () => {
    if (estaRodando()) {
      pausarCronometro();
      await salvarProgressoCronometro(currentUser.uid, planoHoje?.focusTopic?.id);
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

// ---------- FLASHCARDS ----------

async function carregarFlashcards() {
  if (duracaoRevisaoSelecionada > 0) {
    const sessao = await gerarRevisaoRapida(currentUser.uid, duracaoRevisaoSelecionada);
    filaCards = [...sessao.flashcards];
  } else {
    const { novos, revisoes } = await getDueCards(currentUser.uid);
    filaCards = [...revisoes, ...novos];
  }

  if (filaCards.length === 0) {
    document.getElementById("flashcard-vazio").classList.remove("hidden");
    document.getElementById("flashcard-wrapper").classList.add("hidden");
    return;
  }

  document.getElementById("flashcard-vazio").classList.add("hidden");
  document.getElementById("flashcard-wrapper").classList.remove("hidden");
  proximoCard();
}

document.getElementById("quick-review-tabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".qr-tab");
  if (!btn) return;
  duracaoRevisaoSelecionada = Number(btn.dataset.min);
  document.querySelectorAll(".qr-tab").forEach((b) => b.classList.toggle("selecionada", b === btn));
  carregarFlashcards();
});

function proximoCard() {
  if (filaCards.length === 0) {
    carregarFlashcards();
    return;
  }
  cardAtual = filaCards.shift();
  document.getElementById("flashcard-texto").textContent = cardAtual.front;
  document.getElementById("flashcard-face").dataset.revelado = "false";
  document.getElementById("flashcard-controls").classList.add("hidden");
}

document.getElementById("flashcard-face").addEventListener("click", () => {
  const face = document.getElementById("flashcard-face");
  if (face.dataset.revelado === "false") {
    document.getElementById("flashcard-texto").textContent = cardAtual.back;
    face.dataset.revelado = "true";
    document.getElementById("flashcard-controls").classList.remove("hidden");
  }
});

document.getElementById("flashcard-controls").addEventListener("click", async (e) => {
  if (!e.target.dataset.q) return;
  const qualidade = Number(e.target.dataset.q);
  await reviewAndSave(currentUser.uid, cardAtual.id, qualidade);
  await logActivity(currentUser.uid, "flashcard", cardAtual.topicId, 0.5);
  proximoCard();
});

// ---------- DASHBOARD ----------

async function carregarDashboard() {
  const d = await getDashboardData(currentUser.uid);
  document.getElementById("streak-valor").textContent = d.streakDias;

  document.getElementById("stat-scroll").innerHTML = `
    <div class="stat-card"><div class="valor">${d.progressoGeral}%</div><div class="label">Progresso geral</div></div>
    <div class="stat-card"><div class="valor">${d.prontidaoExame}%</div><div class="label">Prontidão pro exame</div></div>
    <div class="stat-card"><div class="valor">${d.horasEstudadas}h</div><div class="label">Horas estudadas</div></div>
    <div class="stat-card"><div class="valor">Nv ${d.nivel}</div><div class="label">${d.xp} XP</div></div>
  `;

  document.getElementById("domain-bars").innerHTML = d.progressoPorDominio
    .map((dom) => `
      <div class="domain-bar">
        <div class="head"><span>${dom.dominio}</span><span>${dom.progressoPercent}%</span></div>
        <div class="track"><div class="fill" style="width:${dom.progressoPercent}%"></div></div>
      </div>`)
    .join("");

  document.getElementById("topicos-criticos").innerHTML =
    d.assuntosCriticos.map((t) => `<span class="topic-chip critico">${t.nome}</span>`).join("") || `<p style="font-size:13px;">Nenhum agora 🎉</p>`;

  document.getElementById("topicos-dominados").innerHTML =
    d.assuntosDominados.map((t) => `<span class="topic-chip dominado">${t.nome}</span>`).join("") || `<p style="font-size:13px;">Ainda nenhum — continue!</p>`;

  await verificarConquistas(currentUser.uid, d).catch(() => {});
  const desbloqueadas = await getConquistasDesbloqueadas(currentUser.uid).catch(() => []);
  const idsDesbloqueadas = new Set(desbloqueadas.map((c) => c.id));

  document.getElementById("lista-conquistas").innerHTML = CONQUISTAS.map(
    (c) => `<span class="conquista-badge ${idsDesbloqueadas.has(c.id) ? "desbloqueada" : ""}" title="${c.desc}">${idsDesbloqueadas.has(c.id) ? "🏆" : "🔒"} ${c.nome}</span>`
  ).join("");

  const meta = await progressoMeta(currentUser.uid, "semanal", d).catch(() => null);
  if (meta) {
    document.getElementById("meta-progresso-texto").textContent = `${meta.minutosAtuais} / ${meta.minutosAlvo} min esta semana`;
    document.getElementById("meta-progresso-fill").style.width = `${meta.percentualConcluido}%`;
    document.getElementById("input-meta-minutos").value = meta.minutosAlvo;
  } else {
    document.getElementById("meta-progresso-texto").textContent = "Nenhuma meta definida ainda.";
    document.getElementById("meta-progresso-fill").style.width = "0%";
  }
}

document.getElementById("btn-definir-meta").addEventListener("click", async () => {
  const minutos = Number(document.getElementById("input-meta-minutos").value);
  if (!minutos) return;
  await definirMeta(currentUser.uid, "semanal", { minutosAlvo: minutos });
  await carregarDashboard();
});

// ---------- TUTOR IA ----------

let modoTutorSelecionado = "iniciante";

document.getElementById("tutor-modos").addEventListener("click", (e) => {
  if (!e.target.dataset.modo) return;
  modoTutorSelecionado = e.target.dataset.modo;
  document.querySelectorAll("#tutor-modos button").forEach((b) => b.classList.toggle("selecionado", b === e.target));
});

document.getElementById("tutor-enviar").addEventListener("click", async () => {
  const pergunta = document.getElementById("tutor-pergunta").value.trim();
  if (!pergunta) return;
  const resposta = document.getElementById("tutor-resposta");
  resposta.classList.remove("hidden");
  resposta.textContent = "Pensando…";
  try {
    const texto = await perguntarLivre(pergunta);
    resposta.textContent = texto;
  } catch (e) {
    resposta.textContent = "Não consegui responder agora. Verifique se o Firebase AI Logic está ativado no Console (Serviços de IA > AI Logic).";
  }
});

// ---------- TRILHA (módulos/lições + cronograma) ----------

async function carregarTrilha() {
  const modulos = getModulosResumo();
  const [allTopics, progresso] = await Promise.all([getAllTopics(), getAllUserTopicProgress(currentUser.uid)]);
  const progressoMap = new Map(progresso.map((p) => [p.id, p]));

  document.getElementById("lista-modulos").innerHTML = modulos
    .map((mod) => {
      const licoesDoModulo = allTopics.filter((t) => t.modulo === mod.nome).sort((a, b) => a.id.localeCompare(b.id));
      const dominadas = licoesDoModulo.filter((t) => (progressoMap.get(t.id)?.masteryPercent ?? 0) >= 80).length;
      const percent = licoesDoModulo.length ? Math.round((dominadas / licoesDoModulo.length) * 100) : 0;

      return `
      <div class="modulo-card">
        <div class="modulo-header" data-modulo="${mod.ordem}">
          <div>
            <div class="titulo">${mod.ordem}. ${mod.nome}</div>
            <div class="meta">${dominadas}/${mod.totalLicoes} lições · ${mod.dominio}</div>
            <div class="modulo-progress-mini"><div class="fill" style="width:${percent}%"></div></div>
          </div>
          <div style="font-size:18px;">${percent === 100 ? "✅" : "›"}</div>
        </div>
        <div class="modulo-licoes" id="licoes-${mod.ordem}">
          ${licoesDoModulo
            .map(
              (t) =>
                `<span class="licao-chip ${(progressoMap.get(t.id)?.masteryPercent ?? 0) >= 80 ? "dominada" : ""}" data-licao-id="${t.id}" data-licao-nome="${t.nome}">${t.nome}</span>`
            )
            .join("")}
        </div>
        <div class="licao-conteudo hidden" id="conteudo-${mod.ordem}"></div>
      </div>`;
    })
    .join("");

  document.querySelectorAll(".modulo-header").forEach((h) => {
    h.addEventListener("click", () => {
      document.getElementById(`licoes-${h.dataset.modulo}`).classList.toggle("aberto");
    });
  });

  document.querySelectorAll(".modulo-licoes").forEach((el) => {
    el.addEventListener("click", async (e) => {
      const chip = e.target.closest(".licao-chip");
      if (!chip) return;
      const moduloOrdem = el.id.replace("licoes-", "");
      await abrirConteudoLicao(chip.dataset.licaoId, chip.dataset.licaoNome, moduloOrdem);
    });
  });

  // Cronograma
  const ritmo = await calcularRitmo(currentUser.uid);
  renderCronograma(ritmo);
}

// Abre (ou fecha) o painel de conteúdo de uma lição, gerando a explicação via Tutor IA.
async function abrirConteudoLicao(licaoId, licaoNome, moduloOrdem) {
  const painel = document.getElementById(`conteudo-${moduloOrdem}`);

  if (!painel.classList.contains("hidden") && painel.dataset.licaoAtual === licaoId) {
    painel.classList.add("hidden");
    return;
  }

  painel.dataset.licaoAtual = licaoId;
  painel.classList.remove("hidden");
  painel.innerHTML = `<p class="eyebrow">${escapeHtml(licaoNome)}</p><p>Gerando explicação…</p>`;

  try {
    const texto = await explicarTopico(licaoNome, "iniciante");
    painel.innerHTML = `
      <p class="eyebrow">${escapeHtml(licaoNome)}</p>
      <p class="licao-texto">${escapeHtml(texto)}</p>
      <button class="btn-primary" id="btn-marcar-estudada" data-licao="${licaoId}" style="margin-top:12px;">Marcar como estudada</button>
    `;
    document.getElementById("btn-marcar-estudada").addEventListener("click", async () => {
      const atual = await getUserTopicProgress(currentUser.uid, licaoId);
      const novoMastery = Math.max(atual?.masteryPercent ?? 0, 50);
      await upsertUserTopicProgress(currentUser.uid, licaoId, { masteryPercent: novoMastery });
      await logActivity(currentUser.uid, "leitura_licao", licaoId, 5);
      painel.classList.add("hidden");
      await carregarTrilha();
    });
  } catch (e) {
    painel.innerHTML = `<p class="eyebrow">${licaoNome}</p><p>Não consegui gerar a explicação agora. Verifique se o Firebase AI Logic está ativado.</p>`;
  }
}

function renderCronograma(ritmo) {
  const div = document.getElementById("cronograma-resultado");
  if (!ritmo) {
    div.innerHTML = "";
    return;
  }
  const statusTexto = {
    folga: "Você está adiantado — pode manter o ritmo tranquilo. 🎉",
    no_ritmo: "Você está no ritmo certo pra chegar preparado na data da prova.",
    precisa_ajustar: "Nesse ritmo atual, pode não dar tempo. Considere aumentar as horas/semana ou adiar a data.",
  };
  div.innerHTML = `
    <p>${ritmo.licoesConcluidas}/${ritmo.totalLicoes} lições concluídas · faltam ~${ritmo.horasRestantesEstimadas}h de estudo</p>
    <p style="margin-top:6px;">Você precisa de <strong>${ritmo.horasNecessariasPorSemana}h/semana</strong> (~${ritmo.minutosNecessariosPorDia} min/dia) até ${ritmo.dataProva}.</p>
    <div class="cronograma-status ${ritmo.status}">${statusTexto[ritmo.status]}</div>
  `;
}

document.getElementById("btn-salvar-cronograma").addEventListener("click", async () => {
  const dataProva = document.getElementById("input-data-prova").value;
  const horasPorSemana = Number(document.getElementById("input-horas-semana").value);
  if (!dataProva || !horasPorSemana) return;
  const ritmo = await definirCronograma(currentUser.uid, dataProva, horasPorSemana);
  renderCronograma(ritmo);
});

// ---------- SIMULADO + LABS (dentro da Trilha) ----------

document.getElementById("btn-iniciar-simulado").addEventListener("click", async () => {
  const container = document.getElementById("area-simulado");
  container.innerHTML = "<p>Gerando simulado…</p>";
  simuladoAtivo = await gerarSimulado(40);
  respostasSimulado = {};
  renderSimulado();
});

function renderSimulado() {
  const container = document.getElementById("area-simulado");
  container.innerHTML = `<h2 style="font-size:16px; margin-bottom:12px;">Simulado (${simuladoAtivo.totalQuestoes} questões)</h2>` +
    simuladoAtivo.questoes
      .map(
        (q, i) => `
      <div class="task-card" style="margin-bottom:12px;">
        <div class="eyebrow">${q.dominio}</div>
        <h2 style="font-size:16px;">${i + 1}. ${q.enunciado}</h2>
        ${Object.entries(q.alternativas)
          .map(
            ([letra, texto]) => `
          <label style="display:block; margin:8px 0; font-size:14px;">
            <input type="radio" name="q-${q.id}" value="${letra}" onchange="window.__respostaSimulado('${q.id}','${letra}')" /> ${letra}) ${texto}
          </label>`
          )
          .join("")}
      </div>`
      )
      .join("") +
    `<button class="btn-primary" id="btn-corrigir-simulado">Corrigir simulado</button>`;

  document.getElementById("btn-corrigir-simulado").addEventListener("click", async () => {
    const resultado = await corrigirESalvarSimulado(currentUser.uid, simuladoAtivo, respostasSimulado);
    container.innerHTML = `
      <h1>Resultado: ${resultado.percentual}%</h1>
      <p style="margin:12px 0;">${resultado.acertos} de ${resultado.totalQuestoes} corretas · ${resultado.duracaoMin} min</p>
      <h3 style="margin-bottom:8px;">Foco de revisão sugerido:</h3>
      ${resultado.planoRevisaoGerado.map((p) => `<span class="topic-chip critico">${p.topicId} (errou ${p.vezesErrado}x)</span>`).join("")}
    `;
  });
}

window.__respostaSimulado = (questaoId, letra) => {
  respostasSimulado[questaoId] = letra;
};

document.getElementById("btn-ver-labs").addEventListener("click", async () => {
  const snap = await getDocs(collection(db, "content", "labs", "items"));
  const labs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const container = document.getElementById("area-labs");
  container.innerHTML =
    `<div id="cli-area" style="margin-bottom:16px;"></div>` +
    labs
      .map(
        (lab) => `
      <div class="task-card" style="margin-bottom:12px;">
        <div class="eyebrow">${lab.ferramenta} · ${lab.dispositivo}</div>
        <h2 style="font-size:16px;">${lab.titulo}</h2>
        <p class="descricao">${lab.topologiaDescricao}</p>
        <button class="btn-primary btn-abrir-cli" data-lab="${lab.id}">Iniciar CLI</button>
      </div>`
      )
      .join("");

  container.querySelectorAll(".btn-abrir-cli").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const cliArea = document.getElementById("cli-area");
      cliArea.scrollIntoView({ behavior: "smooth" });
      await abrirCLI(currentUser.uid, btn.dataset.lab, cliArea);
    });
  });
});

// ---------- TAREFAS (trabalho / estudo / bem-estar) ----------

let categoriaSelecionada = "trabalho";

document.getElementById("categoria-tabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".cat-tab");
  if (!btn) return;
  categoriaSelecionada = btn.dataset.cat;
  document.querySelectorAll(".cat-tab").forEach((b) => b.classList.toggle("selecionada", b === btn));

  const sugestoesEl = document.getElementById("sugestoes-bemestar");
  if (categoriaSelecionada === "bemestar") {
    sugestoesEl.classList.remove("hidden");
    sugestoesEl.innerHTML = SUGESTOES_BEMESTAR.map((s) => `<span class="sugestao-chip" data-sugestao="${s}">${s}</span>`).join("");
  } else {
    sugestoesEl.classList.add("hidden");
    sugestoesEl.innerHTML = "";
  }
});

document.getElementById("sugestoes-bemestar").addEventListener("click", async (e) => {
  const chip = e.target.closest(".sugestao-chip");
  if (!chip) return;
  await adicionarTarefa(currentUser.uid, chip.dataset.sugestao, "bemestar");
  await carregarTarefas();
});

async function adicionarTarefaDoInput() {
  const input = document.getElementById("input-nova-tarefa");
  const titulo = input.value.trim();
  if (!titulo) return;
  await adicionarTarefa(currentUser.uid, titulo, categoriaSelecionada);
  input.value = "";
  await carregarTarefas();
}

document.getElementById("btn-add-tarefa").addEventListener("click", adicionarTarefaDoInput);
document.getElementById("input-nova-tarefa").addEventListener("keydown", (e) => {
  if (e.key === "Enter") adicionarTarefaDoInput();
});

async function carregarTarefas() {
  const { agrupadas, totalTarefas, totalConcluidas } = await getTarefasDeHoje(currentUser.uid);

  document.getElementById("tarefas-resumo").textContent = `${totalConcluidas} de ${totalTarefas} concluídas`;

  ["trabalho", "estudo", "bemestar"].forEach((cat) => {
    const container = document.getElementById(`lista-tarefas-${cat}`);
    const tarefas = agrupadas[cat];

    if (tarefas.length === 0) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = `
      <div class="grupo-titulo"><span class="dot dot-${cat}"></span>${CATEGORIA_LABEL[cat]}</div>
      ${tarefas
        .map(
          (t) => `
        <div class="tarefa-item">
          <div class="tarefa-checkbox ${t.concluida ? "concluida" : ""}" data-id="${t.id}" data-concluida="${t.concluida}">${t.concluida ? "✓" : ""}</div>
          <span class="tarefa-titulo ${t.concluida ? "concluida" : ""}">${escapeHtml(t.titulo)}</span>
          <button class="tarefa-remover" data-remover="${t.id}">✕</button>
        </div>`
        )
        .join("")}
    `;
  });
}

document.querySelectorAll(".grupo-tarefas").forEach((el) => {
  el.addEventListener("click", async (e) => {
    const checkbox = e.target.closest(".tarefa-checkbox");
    const removerBtn = e.target.closest("[data-remover]");

    if (checkbox) {
      const novoEstado = checkbox.dataset.concluida !== "true";
      await marcarConcluida(currentUser.uid, checkbox.dataset.id, novoEstado);
      await carregarTarefas();
    } else if (removerBtn) {
      await removerTarefa(currentUser.uid, removerBtn.dataset.remover);
      await carregarTarefas();
    }
  });
});
