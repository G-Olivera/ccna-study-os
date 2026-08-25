// app.js
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendEmailVerification } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { listarFatoresMFA, iniciarCadastroMFA, confirmarCadastroMFA, removerFatorMFA, getResolverMFA, confirmarLoginMFA } from "./mfa.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

import { seedContentIfNeeded, getModulosResumo } from "./seed-content.js";
import { seedQuestionsIfNeeded } from "./seed-questions.js";
import { seedLabsIfNeeded } from "./seed-labs.js";
import { seedFlashcardsIfNeeded } from "./seed-flashcards.js";
import {
  GRUPOS,
  GRUPO_LABEL,
  FORMAS_PAGAMENTO,
  OPCOES_PARCELAMENTO,
  adicionarTransacao,
  editarTransacao,
  duplicarTransacao,
  adicionarTransacaoParcelada,
  removerTransacao,
  getResumoDoMes,
  definirMetaGasto,
  seedCategoriasIfNeeded,
  listarCategorias,
  anoMesDeHoje,
  formatarAnoMes,
  deslocarAnoMes,
  formatarMoeda,
  formatarDataBR,
  gerarDonutSVG,
  CORES_GRAFICO,
  gerarLinhasSVG,
  gerarResumoFinanceiro,
  gerarComparacaoAnterior,
  buscarEvolucaoMensal,
  adicionarGastoRecorrente,
  listarGastosRecorrentes,
  calcularStatusVencimento,
  marcarStatusGasto,
  editarGastoRecorrente,
  removerGastoRecorrente,
  adicionarCartaoCompleto,
  listarCartoesCompleto,
  removerCartaoCompleto,
  buscarFaturaCartao,
  cicloAtualDoCartao,
  nivelAlerta,
  definirMetaPorCategoria,
  listarMetasPorCategoria,
  gerarCSVTransacoes,
  baixarCSV,
} from "./finance.js";
import { generateDailyPlan, markPlanSectionComplete } from "./daily-plan.js";
import { getDueCards, reviewAndSave, QUALITY } from "./srs-engine.js";
import { getDashboardData, getHistoricoStreak } from "./dashboard.js";
import { verificarConquistas, getConquistasDesbloqueadas, CONQUISTAS, definirMeta, progressoMeta } from "./gamification.js";
import { verificarAusencia, ajustarPlanoParaRetorno } from "./anti-procrastination.js";
import { gerarRevisaoRapida } from "./quick-review.js";
import {
  getPermissaoAtual,
  pedirPermissao,
  salvarHorarioLembrete,
  getHorarioLembrete,
  setLembreteAtivo,
  isLembreteAtivo,
  iniciarVerificacaoLembrete,
} from "./reminder.js";
import { explicarTopico, perguntarLivre } from "./ai-tutor.js";
import { logActivity, getAllTopics, getAllUserTopicProgress, getUserTopicProgress, upsertUserTopicProgress } from "./data-schema.js";
import { gerarSimulado, corrigirESalvarSimulado } from "./simulado.js";
import { definirCronograma, calcularRitmo } from "./planner.js";
import { abrirCLI } from "./cli-simulator.js";
import { adicionarTarefa, getTarefasDeHoje, marcarConcluida, removerTarefa, CATEGORIA_LABEL, SUGESTOES_BEMESTAR } from "./organizer.js";
import { escapeHtml } from "./utils.js";
import { LIVROS_ESTATICOS, abrirLivro, proximaPagina, paginaAnterior, listarProgressoLeituras, toggleFavorito, listarTodosLivros, adicionarLivroLocal, removerLivroLocal, removerProgressoLeitura } from "./reader.js";
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

// ---------- LOGOUT AUTOMÁTICO POR INATIVIDADE ----------
// Útil em computador compartilhado: desloga sozinho se ninguém mexer no app.
const TEMPO_INATIVIDADE_MS = 20 * 60 * 1000; // 20 minutos
let timerInatividade = null;

function resetarTimerInatividade() {
  if (timerInatividade) clearTimeout(timerInatividade);
  if (!currentUser) return;
  timerInatividade = setTimeout(async () => {
    await signOut(auth);
  }, TEMPO_INATIVIDADE_MS);
}

["mousemove", "keydown", "click", "touchstart", "scroll"].forEach((evento) => {
  document.addEventListener(evento, resetarTimerInatividade, { passive: true });
});

// ---------- PWA: registro do Service Worker ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch((err) => {
      console.warn("[PWA] Não foi possível registrar o service worker:", err);
    });
  });
}

// ---------- TEMA (claro/escuro) ----------
// Fica logo no topo do arquivo pra aplicar o tema o mais cedo possível e evitar
// um flash visual da cor errada. Não pode ser um <script> inline no HTML porque
// a CSP do site bloqueia scripts inline por segurança.
const THEME_KEY = "ccna-study-os-theme";

function aplicarTema(tema) {
  document.documentElement.setAttribute("data-theme", tema);
  document.getElementById("icon-theme-sun")?.classList.toggle("hidden", tema === "dark");
  document.getElementById("icon-theme-moon")?.classList.toggle("hidden", tema !== "dark");
}

function temaPreferido() {
  const salvo = localStorage.getItem(THEME_KEY);
  if (salvo === "dark" || salvo === "light") return salvo;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

aplicarTema(temaPreferido());

// ===== MENU FLIP (topbar): abre/fecha por toque, não por hover =====
const menuWrapperEl = document.getElementById("menu-wrapper");
const menuTriggerEl = document.getElementById("menu-trigger");
const menuFlipEl = document.getElementById("menu-flip");

function fecharMenuFlip() {
  menuWrapperEl.classList.remove("open");
  menuTriggerEl.setAttribute("aria-expanded", "false");
  menuFlipEl.setAttribute("aria-hidden", "true");
}

menuTriggerEl.addEventListener("click", (e) => {
  e.stopPropagation();
  const abrindo = !menuWrapperEl.classList.contains("open");
  menuWrapperEl.classList.toggle("open", abrindo);
  menuTriggerEl.setAttribute("aria-expanded", String(abrindo));
  menuFlipEl.setAttribute("aria-hidden", String(!abrindo));
});

document.addEventListener("click", (e) => {
  if (menuWrapperEl.classList.contains("open") && !menuWrapperEl.contains(e.target)) {
    fecharMenuFlip();
  }
});

// Fecha o menu depois que qualquer item dentro dele for escolhido
menuFlipEl.addEventListener("click", (e) => {
  if (e.target.closest("button")) {
    setTimeout(fecharMenuFlip, 120);
  }
});

document.getElementById("btn-theme-toggle").addEventListener("click", () => {
  const atual = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  const novo = atual === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, novo);
  aplicarTema(novo);
});

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

// Medidor de força de senha — heurística simples (tamanho + variedade de caracteres),
// só um retorno visual pra ajudar a escolher senhas melhores.
function avaliarForcaSenha(senha) {
  let pontos = 0;
  if (senha.length >= 8) pontos++;
  if (senha.length >= 12) pontos++;
  if (/[a-z]/.test(senha) && /[A-Z]/.test(senha)) pontos++;
  if (/[0-9]/.test(senha)) pontos++;
  if (/[^A-Za-z0-9]/.test(senha)) pontos++;

  const niveis = [
    { min: 0, largura: "20%", cor: "var(--terracotta)", label: "Fraca" },
    { min: 2, largura: "50%", cor: "var(--amber)", label: "Razoável" },
    { min: 4, largura: "80%", cor: "var(--sage)", label: "Forte" },
    { min: 5, largura: "100%", cor: "var(--teal)", label: "Muito forte" },
  ];
  return [...niveis].reverse().find((n) => pontos >= n.min);
}

document.getElementById("login-senha").addEventListener("input", (e) => {
  const senha = e.target.value;
  const wrapper = document.getElementById("forca-senha-wrapper");

  if (!senha) {
    wrapper.classList.add("hidden");
    return;
  }
  wrapper.classList.remove("hidden");

  const nivel = avaliarForcaSenha(senha);
  const fill = document.getElementById("forca-senha-fill");
  fill.style.width = nivel.largura;
  fill.style.background = nivel.cor;
  document.getElementById("forca-senha-label").textContent = nivel.label;
});

let resolverMFAAtivo = null;

document.getElementById("btn-login").addEventListener("click", async () => {
  const email = document.getElementById("login-email").value;
  const senha = document.getElementById("login-senha").value;
  document.getElementById("login-erro").textContent = "";
  try {
    await signInWithEmailAndPassword(auth, email, senha);
  } catch (e) {
    if (e.code === "auth/multi-factor-auth-required") {
      resolverMFAAtivo = getResolverMFA(e);
      document.getElementById("login-screen").classList.add("hidden");
      document.getElementById("mfa-screen").classList.remove("hidden");
      document.getElementById("mfa-erro").textContent = "";
      document.getElementById("input-mfa-login-codigo").value = "";
      document.getElementById("input-mfa-login-codigo").focus();
    } else {
      document.getElementById("login-erro").textContent = "E-mail ou senha inválidos.";
    }
  }
});

// Só aceita números no código MFA, limitado a 6 dígitos.
document.getElementById("input-mfa-login-codigo").addEventListener("input", (e) => {
  e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6);
});

document.getElementById("btn-confirmar-mfa-login").addEventListener("click", async () => {
  const codigo = document.getElementById("input-mfa-login-codigo").value;
  if (!codigo || !resolverMFAAtivo) return;
  try {
    await confirmarLoginMFA(resolverMFAAtivo, codigo);
    // Limpa o código assim que valida — não deixa resquício no campo, nem no navegador.
    document.getElementById("input-mfa-login-codigo").value = "";
    document.getElementById("mfa-screen").classList.add("hidden");
    resolverMFAAtivo = null;
    // onAuthStateChanged cuida de mostrar o app a partir daqui.
  } catch (e) {
    document.getElementById("mfa-erro").textContent = "Código inválido ou expirado. Tente de novo.";
    document.getElementById("input-mfa-login-codigo").value = "";
    document.getElementById("input-mfa-login-codigo").focus();
  }
});

document.getElementById("btn-voltar-login").addEventListener("click", () => {
  // Volta pro login do zero — limpa tudo, útil pra trocar de usuário.
  resolverMFAAtivo = null;
  document.getElementById("mfa-screen").classList.add("hidden");
  document.getElementById("login-screen").classList.remove("hidden");
  document.getElementById("input-mfa-login-codigo").value = "";
  document.getElementById("mfa-erro").textContent = "";
  document.getElementById("login-email").value = "";
  document.getElementById("login-senha").value = "";
  document.getElementById("login-erro").textContent = "";
  document.getElementById("forca-senha-wrapper").classList.add("hidden");
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
    seedCategoriasIfNeeded(user.uid).catch(() => {});

    await carregarHoje();
    await inicializarCronometroUI();
    iniciarVerificacaoLembrete();
    resetarTimerInatividade();
  } else {
    currentUser = null;
    document.getElementById("login-screen").classList.remove("hidden");
    document.getElementById("app").classList.add("hidden");
    if (timerInatividade) clearTimeout(timerInatividade);

    // Limpa qualquer resíduo da sessão anterior — e-mail, senha, código MFA e
    // mensagens de erro não devem sobreviver a um logout.
    document.getElementById("login-email").value = "";
    document.getElementById("login-senha").value = "";
    document.getElementById("login-erro").textContent = "";
    document.getElementById("forca-senha-wrapper").classList.add("hidden");
    document.getElementById("mfa-screen").classList.add("hidden");
    document.getElementById("mfa-erro").textContent = "";
    document.getElementById("input-mfa-login-codigo").value = "";
    resolverMFAAtivo = null;
  }
});

document.getElementById("btn-logout").addEventListener("click", async () => {
  await signOut(auth);
  // onAuthStateChanged acima cuida de voltar pra tela de login automaticamente.
});

// ---------- NAVEGAÇÃO ----------

document.querySelectorAll(".bottomnav button").forEach((btn) => {
  btn.addEventListener("click", () => trocarTela(btn.dataset.tela));
});

function trocarTela(nome) {
  document.querySelectorAll(".tela").forEach((t) => t.classList.add("hidden"));
  document.getElementById(`tela-${nome}`).classList.remove("hidden");
  document.querySelectorAll(".bottomnav button").forEach((b) => b.classList.toggle("active", b.dataset.tela === nome));

  // Só a tela Finanças ganha mais largura em telas grandes — as outras
  // continuam no formato "uma coisa de cada vez", de propósito.
  // Largura da tela agora é padronizada via CSS (#app) para todas as telas — não precisa mais de classe condicional aqui.

  if (nome === "flashcards") carregarFlashcards();
  if (nome === "dashboard") {
    carregarDashboard();
    inicializarLembreteUI();
  }
  if (nome === "trilha") carregarTrilha();
  if (nome === "tarefas") carregarTarefas();
  if (nome === "financas") carregarFinancas();
  if (nome === "livro") carregarLivro();
}

document.getElementById("btn-abrir-config").addEventListener("click", () => {
  document.getElementById("modal-config").classList.remove("hidden");
  carregarMFA();
});

document.getElementById("btn-fechar-config").addEventListener("click", () => {
  document.getElementById("modal-config").classList.add("hidden");
});

document.getElementById("modal-config").addEventListener("click", (e) => {
  if (e.target.id === "modal-config") document.getElementById("modal-config").classList.add("hidden");
});

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

  const novasConquistas = await verificarConquistas(currentUser.uid, d).catch(() => []);
  const desbloqueadas = await getConquistasDesbloqueadas(currentUser.uid).catch(() => []);
  const idsDesbloqueadas = new Set(desbloqueadas.map((c) => c.id));

  document.getElementById("lista-conquistas").innerHTML = CONQUISTAS.map(
    (c) => `<span class="conquista-badge ${idsDesbloqueadas.has(c.id) ? "desbloqueada" : ""}" title="${c.desc}">${idsDesbloqueadas.has(c.id) ? "🏆" : "🔒"} ${c.nome}</span>`
  ).join("");

  if (novasConquistas && novasConquistas.length > 0) {
    celebrarConquistas(novasConquistas);
  }

  const meta = await progressoMeta(currentUser.uid, "semanal", d).catch(() => null);
  if (meta) {
    document.getElementById("meta-progresso-texto").textContent = `${meta.minutosAtuais} / ${meta.minutosAlvo} min esta semana`;
    document.getElementById("meta-progresso-fill").style.width = `${meta.percentualConcluido}%`;
    document.getElementById("input-meta-minutos").value = meta.minutosAlvo;
  } else {
    document.getElementById("meta-progresso-texto").textContent = "Nenhuma meta definida ainda.";
    document.getElementById("meta-progresso-fill").style.width = "0%";
  }

  await renderCalendarioStreak();
}

// ---------- CELEBRAÇÃO DE CONQUISTA (confete + toast) ----------

// ---------- FEEDBACK VISUAL GENÉRICO (Fase 10 UX) ----------

function mostrarToast(mensagem, tipo = "sucesso") {
  const toast = document.createElement("div");
  toast.className = `toast-feedback ${tipo}`;
  toast.textContent = mensagem;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2800);
}

function celebrarConquistas(novas) {
  const cores = ["#3E6B6B", "#C97B4A", "#5B8266", "#B3654A"];

  for (let i = 0; i < 60; i++) {
    const confete = document.createElement("div");
    confete.className = "confete";
    confete.style.left = `${Math.random() * 100}vw`;
    confete.style.background = cores[Math.floor(Math.random() * cores.length)];
    confete.style.animationDuration = `${1.6 + Math.random() * 1.2}s`;
    confete.style.borderRadius = Math.random() > 0.5 ? "50%" : "2px";
    document.body.appendChild(confete);
    setTimeout(() => confete.remove(), 3200);
  }

  const nomes = novas.map((c) => c.nome).join(", ");
  const toast = document.createElement("div");
  toast.className = "toast-conquista";
  toast.textContent = `🏆 Conquista desbloqueada: ${nomes}`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3700);
}

// ---------- CALENDÁRIO DE STREAK ----------

async function renderCalendarioStreak() {
  const historico = await getHistoricoStreak(currentUser.uid, 84);

  function nivelPara(minutos) {
    if (minutos <= 0) return 0;
    if (minutos < 15) return 1;
    if (minutos < 30) return 2;
    if (minutos < 60) return 3;
    return 4;
  }

  document.getElementById("streak-calendar").innerHTML = historico
    .map((dia) => `<span class="streak-dia nivel-${nivelPara(dia.minutos)}" title="${dia.data}: ${dia.minutos} min"></span>`)
    .join("");
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
  simuladoAtivo = await gerarSimulado(currentUser.uid, 40);
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

// ---------- LEMBRETE DIÁRIO ----------

function renderStatusLembrete() {
  const statusEl = document.getElementById("lembrete-status");
  const permissao = getPermissaoAtual();

  const textos = {
    unsupported: "⚠️ Seu navegador não suporta notificações.",
    granted: "✅ Notificações permitidas.",
    denied: "🚫 Notificações bloqueadas — ative manualmente nas configurações do navegador/site.",
    default: "🔔 Ainda não pedimos permissão — isso acontece ao salvar o lembrete.",
  };
  statusEl.textContent = textos[permissao] || textos.default;
}

function inicializarLembreteUI() {
  document.getElementById("input-lembrete-horario").value = getHorarioLembrete();
  document.getElementById("checkbox-lembrete-ativo").checked = isLembreteAtivo();
  renderStatusLembrete();
}

document.getElementById("btn-salvar-lembrete").addEventListener("click", async () => {
  const horario = document.getElementById("input-lembrete-horario").value || "19:00";
  const ativo = document.getElementById("checkbox-lembrete-ativo").checked;

  salvarHorarioLembrete(horario);
  setLembreteAtivo(ativo);

  if (ativo && getPermissaoAtual() === "default") {
    await pedirPermissao();
  }

  renderStatusLembrete();
  iniciarVerificacaoLembrete();
});

// ---------- FINANÇAS ----------

let valoresOcultos = localStorage.getItem("ccna-study-os-ocultar-valores") === "1";
let periodoAtualFinancas = anoMesDeHoje();
let resumoFinancasCache = null;
let categoriasFinancasCache = [];
let cartoesFinancasCache = [];
let transacaoEditandoId = null;

function formatarValor(v) {
  return valoresOcultos ? "••••" : formatarMoeda(v);
}
function formatarValorInteiro(v) {
  return valoresOcultos ? "••••" : `R$ ${Math.round(v)}`;
}

document.getElementById("btn-toggle-valores").addEventListener("click", () => {
  valoresOcultos = !valoresOcultos;
  localStorage.setItem("ccna-study-os-ocultar-valores", valoresOcultos ? "1" : "0");
  document.getElementById("icon-olho-aberto").classList.toggle("hidden", valoresOcultos);
  document.getElementById("icon-olho-fechado").classList.toggle("hidden", !valoresOcultos);
  carregarFinancas();
});

// ---- Período ----

document.getElementById("btn-periodo-anterior").addEventListener("click", () => {
  periodoAtualFinancas = deslocarAnoMes(periodoAtualFinancas, -1);
  carregarFinancas();
});
document.getElementById("btn-periodo-proximo").addEventListener("click", () => {
  periodoAtualFinancas = deslocarAnoMes(periodoAtualFinancas, 1);
  carregarFinancas();
});

// ---- Carregamento principal ----

async function renderGraficosEResumoFinancas(evolucaoJaCarregada) {
  const mapaCategorias = Object.fromEntries(categoriasFinancasCache.map((c) => [c.id, c]));

  // Gráfico donut por categoria
  const dadosDonut = Object.entries(resumoFinancasCache.porCategoria || {})
    .map(([catId, valor]) => ({ label: mapaCategorias[catId]?.nome || "Sem categoria", icone: mapaCategorias[catId]?.icone || "📦", valor }))
    .sort((a, b) => b.valor - a.valor);

  document.getElementById("financas-donut-categoria").innerHTML = valoresOcultos ? "" : gerarDonutSVG(dadosDonut);
  document.getElementById("financas-donut-legenda").innerHTML = dadosDonut
    .map(
      (d, i) => `
    <div class="donut-legenda-item">
      <span class="donut-legenda-cor" style="background:${CORES_GRAFICO[i % CORES_GRAFICO.length]}"></span>
      <span>${d.icone} ${escapeHtml(d.label)} — ${formatarValor(d.valor)}</span>
    </div>`
    )
    .join("") || `<p style="font-size:12px; color:var(--ink-soft);">Sem despesas categorizadas ainda.</p>`;

  // Evolução mensal (últimos 6 meses) + comparação com o mês anterior
  const evolucao = evolucaoJaCarregada || (await buscarEvolucaoMensal(currentUser.uid, periodoAtualFinancas, 6));
  const resumoAnterior = evolucao.length >= 2 ? evolucao[evolucao.length - 2] : null;

  document.getElementById("financas-evolucao-grafico").innerHTML = valoresOcultos
    ? ""
    : gerarLinhasSVG(evolucao.map((r) => r.totalEntradas), evolucao.map((r) => r.totalSaidas));

  const comparacao = gerarComparacaoAnterior(resumoFinancasCache, resumoAnterior);
  document.getElementById("financas-evolucao-comparacao").innerHTML = comparacao
    ? `
    <span class="comparacao-chip ${comparacao.despesas > 0 ? "positivo" : "negativo"}">Despesas ${comparacao.despesas >= 0 ? "+" : ""}${comparacao.despesas}%</span>
    <span class="comparacao-chip ${comparacao.receitas > 0 ? "negativo" : "positivo"}">Receitas ${comparacao.receitas >= 0 ? "+" : ""}${comparacao.receitas}%</span>
    <span class="comparacao-chip ${comparacao.saldo > 0 ? "negativo" : "positivo"}">Saldo ${comparacao.saldo >= 0 ? "+" : ""}${comparacao.saldo}%</span>
  `
    : `<p style="font-size:12px; color:var(--ink-soft);">Sem período anterior pra comparar ainda.</p>`;

  // Resumo automático (frases)
  const frases = gerarResumoFinanceiro(resumoFinancasCache, categoriasFinancasCache, resumoAnterior);
  document.getElementById("financas-resumo-automatico").innerHTML = valoresOcultos
    ? `<p style="font-size:13px; color:var(--ink-soft);">Valores ocultos.</p>`
    : frases.map((f) => `<div class="resumo-automatico-item">💬 ${escapeHtml(f)}</div>`).join("");
}

// ---- Metas (geral + por categoria) — Fase 7 ----

async function renderMetasFinancas() {
  if (resumoFinancasCache.metaGasto) {
    const alerta = nivelAlerta(resumoFinancasCache.percentualDaMeta || 0);
    document.getElementById("financas-meta-alerta").textContent = alerta.label;
    document.getElementById("financas-meta-alerta").style.color = alerta.cor;
  } else {
    document.getElementById("financas-meta-alerta").textContent = "";
  }

  const metasCategoria = await listarMetasPorCategoria(currentUser.uid, periodoAtualFinancas).catch(() => ({}));
  const gastoPorCategoria = resumoFinancasCache.porCategoria || {};

  document.getElementById("lista-metas-categoria").innerHTML =
    categoriasFinancasCache
      .filter((c) => metasCategoria[c.id] || gastoPorCategoria[c.id])
      .map((c) => {
        const limite = metasCategoria[c.id] || 0;
        const gasto = gastoPorCategoria[c.id] || 0;
        const percentual = limite > 0 ? Math.min(150, Math.round((gasto / limite) * 100)) : 0;
        const alerta = limite > 0 ? nivelAlerta(percentual) : null;
        return `
      <div class="meta-categoria-item">
        <div class="meta-categoria-linha">
          <span>${c.icone} ${escapeHtml(c.nome)}</span>
          <span>${limite > 0 ? `${formatarValor(gasto)} / ${formatarValor(limite)} (${percentual}%)` : formatarValor(gasto)}</span>
        </div>
        ${limite > 0 ? `<div class="meta-categoria-track"><div class="meta-categoria-fill" style="width:${valoresOcultos ? 0 : Math.min(100, percentual)}%; background:${alerta.cor};"></div></div>` : ""}
        <div style="display:flex; gap:6px; margin-top:8px;">
          <input type="number" placeholder="Definir meta" class="input-meta-categoria-inline" data-categoria-meta="${c.id}" style="flex:1; padding:6px; border-radius:6px; border:1px solid var(--border); font-size:12px;" />
          <button class="btn-ver-fatura" data-salvar-meta-categoria="${c.id}">Salvar</button>
        </div>
      </div>`;
      })
      .join("") || `<p style="font-size:12px; color:var(--ink-soft);">Nenhuma categoria com meta ou gasto neste período ainda.</p>`;
}

document.getElementById("lista-metas-categoria").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-salvar-meta-categoria]");
  if (!btn) return;
  const input = document.querySelector(`[data-categoria-meta="${btn.dataset.salvarMetaCategoria}"]`);
  const valor = input.value;
  if (!valor) return;
  await definirMetaPorCategoria(currentUser.uid, periodoAtualFinancas, btn.dataset.salvarMetaCategoria, valor);
  await carregarFinancas();
});

// ---- Próximos vencimentos (Fase 5) ----

async function renderProximosVencimentos() {
  const gastos = await listarGastosRecorrentes(currentUser.uid);
  const listaEl = document.getElementById("lista-proximos-vencimentos");

  listaEl.innerHTML =
    gastos
      .map((g) => {
        const status = calcularStatusVencimento(g, periodoAtualFinancas);
        return `
      <div class="vencimento-item">
        <div class="gastofixo-dia">${g.diaVencimento}</div>
        <div class="transacao-info">
          <div>${escapeHtml(g.descricao)}</div>
          <div class="transacao-grupo">${formatarValor(g.valorMedio)} · ${GRUPO_LABEL[g.grupo] || g.grupo}</div>
        </div>
        <button class="vencimento-status-btn status-${status}" data-toggle-status="${g.id}" data-status-atual="${status}">
          ${status === "pago" ? "✓ Pago" : status === "atrasado" ? "⚠ Atrasado" : "Pendente"}
        </button>
      </div>`;
      })
      .join("") || `<p style="font-size:13px; color:var(--ink-soft);">Nenhum gasto recorrente cadastrado.</p>`;
}

document.getElementById("lista-proximos-vencimentos").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-toggle-status]");
  if (!btn) return;
  const gastos = await listarGastosRecorrentes(currentUser.uid);
  const gasto = gastos.find((g) => g.id === btn.dataset.toggleStatus);
  if (!gasto) return;

  const statusAtual = btn.dataset.statusAtual;
  if (statusAtual === "pago") {
    await marcarStatusGasto(currentUser.uid, gasto, periodoAtualFinancas, "pendente");
  } else {
    await marcarStatusGasto(currentUser.uid, gasto, periodoAtualFinancas, "pago");
    // Gera automaticamente o lançamento no mês, pra ele entrar nos totais (Fase 5).
    await adicionarTransacao(currentUser.uid, {
      tipo: "saida",
      grupo: gasto.grupo,
      categoriaId: gasto.categoriaId,
      descricao: gasto.descricao,
      valor: gasto.valorMedio,
      formaPagamento: gasto.formaPagamento || "",
      data: `${periodoAtualFinancas}-${String(gasto.diaVencimento).padStart(2, "0")}`,
    });
  }
  await carregarFinancas();
});

// ---- Cartões e fatura (Fase 6) ----

async function renderCartoesCompleto() {
  const CORES_BANCO = {
    Nubank: "#820AD1", "Itaú": "#EC7000", Bradesco: "#CC092F", Santander: "#EC0000",
    "Banco do Brasil": "#F8D30F", Caixa: "#0033A0", Inter: "#FF7A00", "C6 Bank": "#242424",
    PicPay: "#21C25E", XP: "#000000",
  };
  const corDoBanco = (nome) => CORES_BANCO[nome] || "#3E6B6B";

  const cartoesComFatura = await Promise.all(
    cartoesFinancasCache.map(async (c) => {
      const ciclo = cicloAtualDoCartao(c);
      const fatura = await buscarFaturaCartao(currentUser.uid, c, ciclo);
      return { ...c, faturaAtual: fatura.total, ciclo };
    })
  );

  document.getElementById("lista-cartoes").innerHTML = cartoesComFatura
    .map((c) => {
      const cor = corDoBanco(c.nome);
      const inicial = c.nome.trim().charAt(0).toUpperCase();
      const percentualLimite = c.limiteTotal ? Math.min(100, Math.round((c.faturaAtual / c.limiteTotal) * 100)) : null;
      return `
      <div class="cartao-item" style="flex-direction:column; align-items:stretch;">
        <div style="display:flex; align-items:center; gap:10px;">
          <div class="cartao-icone" style="background:${cor}22; color:${cor};">${inicial}</div>
          <div class="transacao-info">
            <div>${escapeHtml(c.nome)}</div>
            <div class="transacao-grupo">Fecha dia ${c.fechamento} · Vence dia ${c.vencimento}</div>
          </div>
          <button class="tarefa-remover" data-remover-cartao="${c.id}">✕</button>
        </div>
        <div class="cartao-fatura-info">
          <span>Fatura atual: ${formatarValor(c.faturaAtual)}</span>
          ${c.limiteTotal ? `<span>Limite: ${formatarValor(c.limiteTotal)}</span>` : ""}
        </div>
        ${percentualLimite !== null ? `<div class="cartao-limite-track"><div class="cartao-limite-fill" style="width:${valoresOcultos ? 0 : percentualLimite}%;"></div></div>` : ""}
        <button class="btn-ver-fatura" data-ver-fatura="${c.id}" data-ciclo="${c.ciclo}">Ver fatura</button>
      </div>`;
    })
    .join("") || `<p style="font-size:13px; color:var(--ink-soft);">Nenhum cartão cadastrado.</p>`;
}

document.getElementById("lista-cartoes").addEventListener("click", async (e) => {
  const btnRemover = e.target.closest("[data-remover-cartao]");
  const btnFatura = e.target.closest("[data-ver-fatura]");

  if (btnRemover) {
    if (!confirm("Remover esse cartão?")) return;
    await removerCartaoCompleto(currentUser.uid, btnRemover.dataset.removerCartao);
    await carregarFinancas();
  } else if (btnFatura) {
    const cartao = cartoesFinancasCache.find((c) => c.id === btnFatura.dataset.verFatura);
    const fatura = await buscarFaturaCartao(currentUser.uid, cartao, btnFatura.dataset.ciclo);

    document.getElementById("fatura-conteudo").innerHTML = `
      <h3 style="margin-bottom:4px;">${escapeHtml(cartao.nome)}</h3>
      <p style="font-size:13px; color:var(--ink-soft); margin-bottom:12px;">Fatura de ${formatarAnoMes(btnFatura.dataset.ciclo)} · Fecha dia ${cartao.fechamento} · Vence dia ${cartao.vencimento}</p>
      <div class="stat-card" style="margin-bottom:16px;"><div class="valor">${formatarValor(fatura.total)}</div><div class="label">Total da fatura</div></div>
      ${fatura.transacoes
        .map(
          (t) => `
        <div class="transacao-item">
          <div class="transacao-info">
            <div>${escapeHtml(t.descricao)}${t.totalParcelas > 1 ? `<span class="transacao-parcela-tag">Parcela ${t.parcela}/${t.totalParcelas}</span>` : ""}</div>
            <div class="transacao-grupo">${formatarDataBR(t.data)}</div>
          </div>
          <span class="transacao-valor saida">${formatarValor(t.valor)}</span>
        </div>`
        )
        .join("") || `<p style="font-size:13px; color:var(--ink-soft);">Nenhuma compra nessa fatura.</p>`}
    `;
    document.getElementById("fatura-view").classList.remove("hidden");
  }
});

document.getElementById("btn-fechar-fatura").addEventListener("click", () => {
  document.getElementById("fatura-view").classList.add("hidden");
});

// ---- Exportar CSV (Fase 8) ----

document.getElementById("btn-exportar-csv").addEventListener("click", () => {
  if (!resumoFinancasCache) return;
  if (resumoFinancasCache.transacoes.length === 0) {
    mostrarToast("Nenhuma transação neste período pra exportar.", "erro");
    return;
  }
  const mapaCategorias = Object.fromEntries(categoriasFinancasCache.map((c) => [c.id, c]));
  const csv = gerarCSVTransacoes(resumoFinancasCache.transacoes, mapaCategorias, GRUPO_LABEL);
  baixarCSV(csv, `financas-${periodoAtualFinancas}.csv`);
  mostrarToast("CSV exportado.");
});

async function carregarFinancas() {
  document.getElementById("periodo-label").textContent = formatarAnoMes(periodoAtualFinancas);
  document.getElementById("icon-olho-aberto").classList.toggle("hidden", valoresOcultos);
  document.getElementById("icon-olho-fechado").classList.toggle("hidden", !valoresOcultos);

  resumoFinancasCache = await getResumoDoMes(currentUser.uid, periodoAtualFinancas);
  categoriasFinancasCache = await listarCategorias(currentUser.uid).catch(() => []);
  cartoesFinancasCache = await listarCartoesCompleto(currentUser.uid).catch(() => []);

  document.getElementById("financas-resumo-texto").textContent = `${resumoFinancasCache.transacoes.length} transações neste período`;

  // Busca a evolução mensal cedo para já ter a variação % pronta para os cards de KPI
  const evolucaoParaCards = await buscarEvolucaoMensal(currentUser.uid, periodoAtualFinancas, 6);
  const resumoAnteriorParaCards = evolucaoParaCards.length >= 2 ? evolucaoParaCards[evolucaoParaCards.length - 2] : null;
  const comparacaoCards = gerarComparacaoAnterior(resumoFinancasCache, resumoAnteriorParaCards);

  function chipVariacao(percentual, corBoaSeSubir) {
    if (percentual === null || percentual === undefined) {
      return `<span class="kpi-variacao neutro">— vs mês anterior</span>`;
    }
    const subiu = percentual >= 0;
    const boa = corBoaSeSubir ? subiu : !subiu;
    const seta = subiu
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>`;
    return `<span class="kpi-variacao ${boa ? "up" : "down"}">${seta}${subiu ? "+" : ""}${percentual}% vs mês anterior</span>`;
  }

  document.getElementById("financas-stats").innerHTML = `
    <div class="kpi-card">
      <div class="kpi-card-top">
        <div class="kpi-icon entradas"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg></div>
        <span class="kpi-label">Entradas</span>
      </div>
      <div class="kpi-valor">${valoresOcultos ? "••••" : formatarValorInteiro(resumoFinancasCache.totalEntradas)}</div>
      ${valoresOcultos ? "" : chipVariacao(comparacaoCards?.receitas, true)}
    </div>
    <div class="kpi-card">
      <div class="kpi-card-top">
        <div class="kpi-icon saidas"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg></div>
        <span class="kpi-label">Saídas</span>
      </div>
      <div class="kpi-valor">${valoresOcultos ? "••••" : formatarValorInteiro(resumoFinancasCache.totalSaidas)}</div>
      ${valoresOcultos ? "" : chipVariacao(comparacaoCards?.despesas, false)}
    </div>
    <div class="kpi-card">
      <div class="kpi-card-top">
        <div class="kpi-icon saldo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.1-2.8-2.8L7 14"/></svg></div>
        <span class="kpi-label">Saldo do período</span>
      </div>
      <div class="kpi-valor">${valoresOcultos ? "••••" : formatarValorInteiro(resumoFinancasCache.saldo)}</div>
      ${valoresOcultos ? "" : chipVariacao(comparacaoCards?.saldo, true)}
    </div>
  `;

  const maiorGrupo = Math.max(1, ...Object.values(resumoFinancasCache.porGrupo));
  document.getElementById("financas-grupos-bars").innerHTML =
    Object.entries(resumoFinancasCache.porGrupo)
      .sort((a, b) => b[1] - a[1])
      .map(
        ([grupo, valor]) => `
      <div class="domain-bar">
        <div class="head"><span>${GRUPO_LABEL[grupo] || grupo}</span><span>${formatarValorInteiro(valor)}</span></div>
        <div class="track"><div class="fill" style="width:${valoresOcultos ? 0 : Math.round((valor / maiorGrupo) * 100)}%"></div></div>
      </div>`
      )
      .join("") || `<p style="font-size:13px; color:var(--ink-soft);">Nenhum gasto registrado neste período.</p>`;

  if (resumoFinancasCache.metaGasto) {
    document.getElementById("financas-meta-texto").textContent = `${formatarValorInteiro(resumoFinancasCache.totalSaidas)} de ${formatarValorInteiro(resumoFinancasCache.metaGasto)} gastos`;
    document.getElementById("financas-meta-fill").style.width = `${valoresOcultos ? 0 : resumoFinancasCache.percentualDaMeta}%`;
    document.getElementById("financas-meta-fill").style.background = resumoFinancasCache.percentualDaMeta >= 90 ? "var(--terracotta)" : "var(--sage)";
    document.getElementById("input-meta-financas").value = resumoFinancasCache.metaGasto;
  } else {
    document.getElementById("financas-meta-texto").textContent = "Nenhuma meta definida ainda.";
    document.getElementById("financas-meta-fill").style.width = "0%";
  }

  popularFiltrosFinancas();
  renderListaTransacoes();
  await renderGraficosEResumoFinancas(evolucaoParaCards);
  await renderMetasFinancas();
  await renderProximosVencimentos();
  popularSelectsGastoFixo();

  const gastosFixos = await listarGastosRecorrentes(currentUser.uid);
  document.getElementById("lista-gastos-fixos").innerHTML =
    gastosFixos
      .map(
        (g) => `
      <div class="gastofixo-item">
        <div class="gastofixo-dia">${g.diaVencimento}</div>
        <div class="transacao-info">
          <div>${escapeHtml(g.descricao)}</div>
          <div class="transacao-grupo">${formatarValor(g.valorMedio)} · ${g.recorrencia || "mensal"}</div>
        </div>
        <button class="tarefa-remover" data-remover-gastofixo="${g.id}">✕</button>
      </div>`
      )
      .join("") || `<p style="font-size:13px; color:var(--ink-soft);">Nenhum gasto fixo cadastrado.</p>`;

  await renderCartoesCompleto();
}

function popularSelectsGastoFixo() {
  document.getElementById("select-gastofixo-grupo").innerHTML = Object.entries(GRUPO_LABEL).map(([v, l]) => `<option value="${v}">${l}</option>`).join("");
  document.getElementById("select-gastofixo-categoria").innerHTML =
    `<option value="">Sem categoria</option>` + categoriasFinancasCache.map((c) => `<option value="${c.id}">${c.icone} ${escapeHtml(c.nome)}</option>`).join("");
}

// ---- Filtros e busca ----

function popularFiltrosFinancas() {
  const selGrupo = document.getElementById("filtro-grupo");
  const valorAtualGrupo = selGrupo.value;
  selGrupo.innerHTML = `<option value="">Todos os grupos</option>` + Object.entries(GRUPO_LABEL).map(([v, l]) => `<option value="${v}">${l}</option>`).join("");
  selGrupo.value = valorAtualGrupo;

  const selCategoria = document.getElementById("filtro-categoria");
  const valorAtualCategoria = selCategoria.value;
  selCategoria.innerHTML = `<option value="">Todas categorias</option>` + categoriasFinancasCache.map((c) => `<option value="${c.id}">${c.icone} ${escapeHtml(c.nome)}</option>`).join("");
  selCategoria.value = valorAtualCategoria;

  const selForma = document.getElementById("filtro-forma-pagamento");
  const valorAtualForma = selForma.value;
  selForma.innerHTML = `<option value="">Todas formas</option>` + FORMAS_PAGAMENTO.map((f) => `<option value="${f}">${f}</option>`).join("");
  selForma.value = valorAtualForma;
}

["input-busca-transacao", "filtro-grupo", "filtro-categoria", "filtro-tipo", "filtro-forma-pagamento"].forEach((id) => {
  document.getElementById(id).addEventListener("input", renderListaTransacoes);
  document.getElementById(id).addEventListener("change", renderListaTransacoes);
});

function renderListaTransacoes() {
  if (!resumoFinancasCache) return;

  const busca = document.getElementById("input-busca-transacao").value.toLowerCase();
  const grupo = document.getElementById("filtro-grupo").value;
  const categoriaId = document.getElementById("filtro-categoria").value;
  const tipo = document.getElementById("filtro-tipo").value;
  const forma = document.getElementById("filtro-forma-pagamento").value;

  const filtradas = resumoFinancasCache.transacoes.filter((t) => {
    if (busca && !(t.descricao || "").toLowerCase().includes(busca)) return false;
    if (grupo && t.grupo !== grupo) return false;
    if (categoriaId && t.categoriaId !== categoriaId) return false;
    if (tipo && t.tipo !== tipo) return false;
    if (forma && t.formaPagamento !== forma) return false;
    return true;
  });

  const mapaCategorias = Object.fromEntries(categoriasFinancasCache.map((c) => [c.id, c]));

  document.getElementById("lista-transacoes").innerHTML =
    filtradas
      .map((t) => {
        const cat = mapaCategorias[t.categoriaId];
        const parcelaTag = t.totalParcelas > 1 ? `<span class="transacao-parcela-tag">Parcela ${t.parcela}/${t.totalParcelas}</span>` : "";
        return `
      <div class="transacao-item">
        <div class="transacao-info">
          <div>${escapeHtml(t.descricao) || (cat ? cat.nome : GRUPO_LABEL[t.grupo]) || t.grupo}${parcelaTag}</div>
          <div class="transacao-grupo">${cat ? `${cat.icone} ${escapeHtml(cat.nome)} · ` : ""}${GRUPO_LABEL[t.grupo] || t.grupo} · ${formatarDataBR(t.data)}</div>
        </div>
        <span class="transacao-valor ${t.tipo}">${valoresOcultos ? "••••" : `${t.tipo === "entrada" ? "+" : "-"}${formatarMoeda(t.valor)}`}</span>
        <div class="transacao-acoes">
          <button class="transacao-acao-btn" data-editar-transacao="${t.id}" title="Editar" aria-label="Editar transação">✎</button>
          <button class="transacao-acao-btn" data-duplicar-transacao="${t.id}" title="Duplicar" aria-label="Duplicar transação">⧉</button>
          <button class="transacao-acao-btn" data-remover-transacao="${t.id}" title="Excluir" aria-label="Excluir transação" style="color:var(--terracotta);">✕</button>
        </div>
      </div>`;
      })
      .join("") || `<p style="font-size:13px; color:var(--ink-soft);">Nenhuma transação encontrada.</p>`;
}

document.getElementById("lista-transacoes").addEventListener("click", async (e) => {
  const btnRemover = e.target.closest("[data-remover-transacao]");
  const btnEditar = e.target.closest("[data-editar-transacao]");
  const btnDuplicar = e.target.closest("[data-duplicar-transacao]");

  if (btnRemover) {
    if (!confirm("Excluir essa transação? Essa ação não pode ser desfeita.")) return;
    await removerTransacao(currentUser.uid, btnRemover.dataset.removerTransacao);
    mostrarToast("Transação excluída.");
    await carregarFinancas();
  } else if (btnEditar) {
    const transacao = resumoFinancasCache.transacoes.find((t) => t.id === btnEditar.dataset.editarTransacao);
    if (transacao) abrirModalTransacao(transacao);
  } else if (btnDuplicar) {
    const transacao = resumoFinancasCache.transacoes.find((t) => t.id === btnDuplicar.dataset.duplicarTransacao);
    if (transacao) {
      await duplicarTransacao(currentUser.uid, { ...transacao, data: new Date().toISOString().slice(0, 10) });
      mostrarToast("Transação duplicada.");
      await carregarFinancas();
    }
  }
});

// ---- Modal de nova/editar transação ----

function popularSelectsModal() {
  document.getElementById("modal-select-grupo").innerHTML = Object.entries(GRUPO_LABEL).map(([v, l]) => `<option value="${v}">${l}</option>`).join("");
  document.getElementById("modal-select-categoria").innerHTML =
    `<option value="">Sem categoria</option>` + categoriasFinancasCache.map((c) => `<option value="${c.id}">${c.icone} ${escapeHtml(c.nome)}</option>`).join("");
  document.getElementById("modal-select-forma-pagamento").innerHTML = FORMAS_PAGAMENTO.map((f) => `<option value="${f}">${f}</option>`).join("");
  document.getElementById("modal-select-cartao").innerHTML =
    cartoesFinancasCache.length > 0
      ? cartoesFinancasCache.map((c) => `<option value="${c.id}">${escapeHtml(c.nome)}</option>`).join("")
      : `<option value="">Nenhum cartão cadastrado</option>`;
  document.getElementById("modal-select-parcelamento").innerHTML = OPCOES_PARCELAMENTO.map((p) => `<option value="${p}">${p}</option>`).join("");
}

function atualizarCamposCondicionaisModal() {
  const forma = document.getElementById("modal-select-forma-pagamento").value;
  document.getElementById("modal-campo-cartao").classList.toggle("hidden", forma !== "Crédito");
  document.getElementById("modal-campo-parcelamento").classList.toggle("hidden", forma !== "Crédito");
  atualizarPreviewParcelamento();
}

function atualizarPreviewParcelamento() {
  const parcelamento = document.getElementById("modal-select-parcelamento").value;
  const valor = Number(document.getElementById("modal-input-valor").value) || 0;
  const previewEl = document.getElementById("modal-parcelamento-preview");

  if (!parcelamento || parcelamento === "À vista" || valor <= 0) {
    previewEl.textContent = "";
    return;
  }
  const n = Number(parcelamento.replace("x", ""));
  const valorParcela = valor / n;
  previewEl.textContent = `${n}x de ${formatarMoeda(valorParcela)}`;
}

document.getElementById("modal-select-forma-pagamento").addEventListener("change", atualizarCamposCondicionaisModal);
document.getElementById("modal-select-parcelamento").addEventListener("change", atualizarPreviewParcelamento);
document.getElementById("modal-input-valor").addEventListener("input", atualizarPreviewParcelamento);

document.getElementById("modal-tipo-tabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".cat-tab");
  if (!btn) return;
  document.querySelectorAll("#modal-tipo-tabs .cat-tab").forEach((b) => b.classList.toggle("selecionada", b === btn));
});

function abrirModalTransacao(transacaoExistente = null) {
  popularSelectsModal();
  transacaoEditandoId = transacaoExistente?.id || null;

  document.getElementById("modal-transacao-titulo").textContent = transacaoEditandoId ? "Editar transação" : "Nova transação";

  const tipo = transacaoExistente?.tipo || "saida";
  document.querySelectorAll("#modal-tipo-tabs .cat-tab").forEach((b) => b.classList.toggle("selecionada", b.dataset.tipo === tipo));

  document.getElementById("modal-select-grupo").value = transacaoExistente?.grupo || GRUPOS.VARIAVEIS;
  document.getElementById("modal-select-categoria").value = transacaoExistente?.categoriaId || "";
  document.getElementById("modal-input-descricao").value = transacaoExistente?.descricao || "";
  document.getElementById("modal-input-valor").value = transacaoExistente?.valor || "";
  document.getElementById("modal-input-data").value = transacaoExistente?.data || new Date().toISOString().slice(0, 10);
  document.getElementById("modal-select-forma-pagamento").value = transacaoExistente?.formaPagamento || "Pix";
  document.getElementById("modal-select-cartao").value = transacaoExistente?.cartaoId || "";
  document.getElementById("modal-select-parcelamento").value = "À vista"; // parcelamento não é reeditável numa parcela já existente
  document.getElementById("modal-checkbox-recorrente").checked = !!transacaoExistente?.recorrente;
  document.getElementById("modal-input-observacoes").value = transacaoExistente?.observacoes || "";

  // Ao editar uma parcela existente, trava o campo de parcelamento (evita duplicar a lógica de recriar o grupo de parcelas nessa fase).
  document.getElementById("modal-select-parcelamento").disabled = !!transacaoExistente?.totalParcelas;

  atualizarCamposCondicionaisModal();
  document.getElementById("modal-transacao").classList.remove("hidden");
}

document.getElementById("btn-nova-transacao").addEventListener("click", () => abrirModalTransacao());
document.getElementById("btn-fechar-modal-transacao").addEventListener("click", () => {
  document.getElementById("modal-transacao").classList.add("hidden");
});
document.getElementById("modal-transacao").addEventListener("click", (e) => {
  if (e.target.id === "modal-transacao") document.getElementById("modal-transacao").classList.add("hidden");
});

document.getElementById("btn-salvar-transacao").addEventListener("click", async () => {
  const tipo = document.querySelector("#modal-tipo-tabs .cat-tab.selecionada").dataset.tipo;
  const grupo = document.getElementById("modal-select-grupo").value;
  const categoriaId = document.getElementById("modal-select-categoria").value || null;
  const descricao = document.getElementById("modal-input-descricao").value;
  const valor = document.getElementById("modal-input-valor").value;
  const data = document.getElementById("modal-input-data").value;
  const formaPagamento = document.getElementById("modal-select-forma-pagamento").value;
  const cartaoId = document.getElementById("modal-select-cartao").value || null;
  const parcelamento = document.getElementById("modal-select-parcelamento").value;
  const recorrente = document.getElementById("modal-checkbox-recorrente").checked;
  const observacoes = document.getElementById("modal-input-observacoes").value;

  if (!valor || Number(valor) <= 0 || !data) {
    mostrarToast("Preencha valor e data antes de salvar.", "erro");
    return;
  }

  const dadosBase = { tipo, grupo, categoriaId, descricao, valor, data, formaPagamento, cartaoId, recorrente, observacoes };

  try {
    if (transacaoEditandoId) {
      await editarTransacao(currentUser.uid, transacaoEditandoId, dadosBase);
      mostrarToast("Transação atualizada.");
    } else if (formaPagamento === "Crédito" && parcelamento !== "À vista") {
      const numParcelas = Number(parcelamento.replace("x", ""));
      await adicionarTransacaoParcelada(currentUser.uid, dadosBase, numParcelas);
      mostrarToast(`Transação parcelada em ${numParcelas}x.`);
    } else {
      await adicionarTransacao(currentUser.uid, dadosBase);
      mostrarToast("Transação registrada.");
    }
  } catch (e) {
    mostrarToast("Não foi possível salvar. Tente de novo.", "erro");
    return;
  }

  document.getElementById("modal-transacao").classList.add("hidden");
  await carregarFinancas();
});

// ---- Meta, gastos fixos e cartões ----

document.getElementById("select-cartao-banco").addEventListener("change", (e) => {
  document.getElementById("input-cartao-banco-outro").classList.toggle("hidden", e.target.value !== "Outro");
});

document.getElementById("btn-add-cartao").addEventListener("click", async () => {
  const bancoSelecionado = document.getElementById("select-cartao-banco").value;
  const nome = bancoSelecionado === "Outro" ? document.getElementById("input-cartao-banco-outro").value : bancoSelecionado;
  const fechamento = document.getElementById("input-cartao-fechamento").value;
  const vencimento = document.getElementById("input-cartao-vencimento").value;
  const limiteTotal = document.getElementById("input-cartao-limite").value || null;
  if (!nome || !fechamento || !vencimento) {
    mostrarToast("Preencha banco, fechamento e vencimento.", "erro");
    return;
  }

  await adicionarCartaoCompleto(currentUser.uid, { nome, fechamento, vencimento, limiteTotal });
  document.getElementById("input-cartao-banco-outro").value = "";
  document.getElementById("input-cartao-banco-outro").classList.add("hidden");
  document.getElementById("select-cartao-banco").selectedIndex = 0;
  document.getElementById("input-cartao-fechamento").value = "";
  document.getElementById("input-cartao-vencimento").value = "";
  document.getElementById("input-cartao-limite").value = "";
  mostrarToast("Cartão adicionado.");
  await carregarFinancas();
});

document.getElementById("btn-definir-meta-financas").addEventListener("click", async () => {
  const valor = document.getElementById("input-meta-financas").value;
  if (!valor) {
    mostrarToast("Digite um valor de meta.", "erro");
    return;
  }
  await definirMetaGasto(currentUser.uid, valor, periodoAtualFinancas);
  mostrarToast("Meta definida.");
  await carregarFinancas();
});

document.getElementById("btn-add-gastofixo").addEventListener("click", async () => {
  const descricao = document.getElementById("input-gastofixo-desc").value;
  const grupo = document.getElementById("select-gastofixo-grupo").value;
  const categoriaId = document.getElementById("select-gastofixo-categoria").value || null;
  const diaVencimento = document.getElementById("input-gastofixo-dia").value;
  const valorMedio = document.getElementById("input-gastofixo-valor").value;
  const recorrencia = document.getElementById("select-gastofixo-recorrencia").value;
  if (!descricao || !diaVencimento || !valorMedio) {
    mostrarToast("Preencha descrição, dia e valor.", "erro");
    return;
  }

  await adicionarGastoRecorrente(currentUser.uid, { descricao, grupo, categoriaId, diaVencimento, valorMedio, recorrencia });
  document.getElementById("input-gastofixo-desc").value = "";
  document.getElementById("input-gastofixo-dia").value = "";
  document.getElementById("input-gastofixo-valor").value = "";
  mostrarToast("Gasto recorrente adicionado.");
  await carregarFinancas();
});

document.getElementById("lista-gastos-fixos").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-remover-gastofixo]");
  if (!btn) return;
  if (!confirm("Remover esse gasto fixo?")) return;
  await removerGastoRecorrente(currentUser.uid, btn.dataset.removerGastofixo);
  await carregarFinancas();
});

// ---------- MFA (autenticação de dois fatores) ----------

let totpSecretPendente = null;

async function carregarMFA() {
  const fatores = listarFatoresMFA(currentUser);
  const statusEl = document.getElementById("mfa-status");
  const areaEl = document.getElementById("mfa-area");

  const iconeEscudoCheck = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 5v6c0 5.5 3.4 9.7 8 11 4.6-1.3 8-5.5 8-11V5l-8-3z"/><path d="m9 12 2 2 4-4"/></svg>`;
  const iconeEscudoAlerta = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 5v6c0 5.5 3.4 9.7 8 11 4.6-1.3 8-5.5 8-11V5l-8-3z"/><line x1="12" y1="8" x2="12" y2="13"/><circle cx="12" cy="16" r="0.5" fill="currentColor"/></svg>`;
  const iconeEmail = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 6 10-6"/></svg>`;

  if (fatores.length > 0) {
    statusEl.innerHTML = `
      <div class="mfa-status-row">
        <div class="kpi-icon entradas">${iconeEscudoCheck}</div>
        <div>
          <div class="mfa-status-title">Dois fatores ativado</div>
          <div class="mfa-status-desc">Seu login pede o código do app autenticador.</div>
        </div>
      </div>`;
    areaEl.innerHTML = `<button class="btn-secondary" id="btn-remover-mfa" style="color:var(--terracotta); border-color:var(--terracotta);">Desativar dois fatores</button>`;
    document.getElementById("btn-remover-mfa").addEventListener("click", async () => {
      await removerFatorMFA(currentUser, fatores[0].uid);
      await carregarMFA();
    });
    return;
  }

  if (!currentUser.emailVerified) {
    statusEl.innerHTML = `
      <div class="mfa-status-row">
        <div class="kpi-icon saldo">${iconeEmail}</div>
        <div>
          <div class="mfa-status-title">Verifique seu e-mail primeiro</div>
          <div class="mfa-status-desc">O Firebase exige e-mail verificado antes de ativar o MFA.</div>
        </div>
      </div>`;
    areaEl.innerHTML = `<button class="btn-primary" id="btn-verificar-email">Enviar e-mail de verificação</button><p id="mfa-email-status" style="font-size:12px; margin-top:8px; color:var(--ink-soft);"></p>`;
    document.getElementById("btn-verificar-email").addEventListener("click", async () => {
      try {
        await sendEmailVerification(currentUser);
        document.getElementById("mfa-email-status").textContent = "E-mail enviado! Abra sua caixa de entrada, clique no link, depois volte aqui e saia/entre de novo pra atualizar.";
      } catch (e) {
        document.getElementById("mfa-email-status").textContent = "Não foi possível enviar agora. Tente de novo em alguns minutos.";
      }
    });
    return;
  }

  statusEl.innerHTML = `
    <div class="mfa-status-row">
      <div class="kpi-icon saidas">${iconeEscudoAlerta}</div>
      <div>
        <div class="mfa-status-title">Dois fatores desativado</div>
        <div class="mfa-status-desc">Recomendado, especialmente com dados financeiros no app.</div>
      </div>
    </div>`;
  areaEl.innerHTML = `<button class="btn-primary" id="btn-ativar-mfa">Ativar dois fatores</button>`;
  document.getElementById("btn-ativar-mfa").addEventListener("click", iniciarFluxoAtivacaoMFA);
}

async function iniciarFluxoAtivacaoMFA() {
  const areaEl = document.getElementById("mfa-area");
  try {
    const { totpSecret, secretKey } = await iniciarCadastroMFA(currentUser);
    totpSecretPendente = totpSecret;

    areaEl.innerHTML = `
      <p style="font-size:13px; margin-bottom:8px;">1. Abra o Google Authenticator, Authy ou similar e adicione uma conta manualmente com esta chave:</p>
      <div style="font-family:var(--font-mono); font-size:14px; background:var(--surface-quiet); padding:10px; border-radius:8px; margin-bottom:12px; word-break:break-all; user-select:all;">${secretKey}</div>
      <p style="font-size:13px; margin-bottom:8px;">2. Digite o código de 6 dígitos que o app gerou:</p>
      <input id="input-mfa-cadastro-codigo" type="text" inputmode="numeric" maxlength="6" placeholder="000000" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border); text-align:center; letter-spacing:4px; font-family:var(--font-mono); margin-bottom:10px;" />
      <button class="btn-primary" id="btn-confirmar-cadastro-mfa">Confirmar e ativar</button>
    `;

    document.getElementById("btn-confirmar-cadastro-mfa").addEventListener("click", async () => {
      const codigo = document.getElementById("input-mfa-cadastro-codigo").value;
      if (!codigo) return;
      try {
        await confirmarCadastroMFA(currentUser, totpSecretPendente, codigo);
        await carregarMFA();
      } catch (e) {
        areaEl.insertAdjacentHTML("beforeend", `<p style="color:var(--terracotta); font-size:13px; margin-top:8px;">Código inválido. Tente gerar um novo código no app e digitar de novo.</p>`);
      }
    });
  } catch (e) {
    if (e.code === "auth/requires-recent-login") {
      areaEl.innerHTML = `<p style="color:var(--terracotta); font-size:13px;">Por segurança, ative o MFA logo após logar. Saia e entre de novo, depois tente ativar.</p>`;
    } else {
      areaEl.innerHTML = `<p style="color:var(--terracotta); font-size:13px;">Não foi possível iniciar o cadastro. Tente novamente.</p>`;
    }
  }
}

// ---------- LIVRO (leitor de PDF pessoal) ----------

// ---------- BIBLIOTECA ----------

let progressoLivrosCache = {};
let todosLivrosCache = [];
let filtroTextoLivro = "";
let filtroCategoriaLivro = "";

function corTextoContraste(hex) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#24303A" : "#FFFFFF";
}

function iniciaisTitulo(titulo) {
  return titulo
    .split(" ")
    .filter((p) => p.length > 2)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("") || titulo.slice(0, 2).toUpperCase();
}

function popularFiltroCategorias() {
  const select = document.getElementById("select-categoria-livro");
  const categorias = [...new Set(todosLivrosCache.map((l) => l.categoria).filter(Boolean))];
  select.innerHTML = `<option value="">Todas categorias</option>` + categorias.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
}

function renderBiblioteca() {
  const grid = document.getElementById("grid-livros");
  const vazioEl = document.getElementById("livro-vazio");

  if (todosLivrosCache.length === 0) {
    vazioEl.classList.remove("hidden");
    grid.innerHTML = "";
    return;
  }
  vazioEl.classList.add("hidden");

  const filtrados = todosLivrosCache.filter((l) => {
    const bateTexto = !filtroTextoLivro || l.titulo.toLowerCase().includes(filtroTextoLivro.toLowerCase());
    const bateCategoria = !filtroCategoriaLivro || l.categoria === filtroCategoriaLivro;
    return bateTexto && bateCategoria;
  });

  grid.innerHTML = filtrados
    .map((livro) => {
      const progresso = progressoLivrosCache[livro.id];
      const percent = progresso?.totalPaginas ? Math.round((progresso.paginaAtual / progresso.totalPaginas) * 100) : 0;
      const favorito = progresso?.favorito || false;
      const corTexto = corTextoContraste(livro.corCapa);

      return `
      <div class="livro-card">
        <div class="livro-capa" style="background:${livro.corCapa}; color:${corTexto};">
          ${iniciaisTitulo(livro.titulo)}
          <button class="btn-favorito" data-favorito="${livro.id}" data-favorito-atual="${favorito}" aria-label="${favorito ? "Remover dos favoritos" : "Adicionar aos favoritos"}">${favorito ? "★" : "☆"}</button>
          ${livro.origem === "local" ? `<span class="livro-tag-local">Neste aparelho</span>` : ""}
        </div>
        <div class="livro-info">
          <div class="livro-titulo">${escapeHtml(livro.titulo)}</div>
          <div class="livro-meta">${escapeHtml(livro.volume || "")}${livro.volume && livro.autor ? " · " : ""}${escapeHtml(livro.autor || "")}</div>
          ${
            progresso
              ? `<div class="livro-progresso-track"><div class="livro-progresso-fill" style="width:${percent}%"></div></div>
                 <div class="livro-progresso-texto">Pág. ${progresso.paginaAtual} de ${progresso.totalPaginas || "?"} (${percent}%)</div>`
              : `<div class="livro-progresso-texto">Ainda não iniciado</div>`
          }
          <button class="btn-primary" data-abrir-livro="${livro.id}">Abrir livro</button>
          ${livro.origem === "local" ? `<button class="btn-secondary" data-remover-livro="${livro.id}" style="margin-top:6px; color:var(--terracotta); border-color:var(--terracotta);">Remover</button>` : ""}
        </div>
      </div>`;
    })
    .join("");
}

async function carregarLivro() {
  todosLivrosCache = await listarTodosLivros().catch(() => []);
  progressoLivrosCache = await listarProgressoLeituras(currentUser.uid).catch(() => ({}));
  popularFiltroCategorias();
  renderBiblioteca();
  document.getElementById("livro-biblioteca-view").classList.remove("hidden");
  document.getElementById("livro-leitura-view").classList.add("hidden");
}

document.getElementById("btn-adicionar-livro").addEventListener("click", () => {
  document.getElementById("input-arquivo-livro").click();
});

document.getElementById("input-arquivo-livro").addEventListener("change", async (e) => {
  const arquivo = e.target.files[0];
  if (!arquivo) return;
  const statusEl = document.getElementById("livro-add-status");
  statusEl.textContent = "Salvando no aparelho…";
  try {
    await adicionarLivroLocal(arquivo);
    statusEl.textContent = "Livro adicionado! (salvo só neste aparelho)";
    await carregarLivro();
  } catch (err) {
    statusEl.textContent = "Não consegui salvar esse arquivo. Confirme que é um PDF.";
  }
  e.target.value = "";
});

document.getElementById("input-busca-livro").addEventListener("input", (e) => {
  filtroTextoLivro = e.target.value;
  renderBiblioteca();
});

document.getElementById("select-categoria-livro").addEventListener("change", (e) => {
  filtroCategoriaLivro = e.target.value;
  renderBiblioteca();
});

document.getElementById("grid-livros").addEventListener("click", async (e) => {
  const btnFavorito = e.target.closest("[data-favorito]");
  const btnAbrir = e.target.closest("[data-abrir-livro]");
  const btnRemover = e.target.closest("[data-remover-livro]");

  if (btnFavorito) {
    const atual = btnFavorito.dataset.favoritoAtual === "true";
    const novo = await toggleFavorito(currentUser.uid, btnFavorito.dataset.favorito, atual);
    progressoLivrosCache[btnFavorito.dataset.favorito] = { ...(progressoLivrosCache[btnFavorito.dataset.favorito] || {}), favorito: novo };
    renderBiblioteca();
  } else if (btnAbrir) {
    await abrirLeitorDoLivro(btnAbrir.dataset.abrirLivro);
  } else if (btnRemover) {
    await removerLivroLocal(btnRemover.dataset.removerLivro);
    await removerProgressoLeitura(currentUser.uid, btnRemover.dataset.removerLivro).catch(() => {});
    await carregarLivro();
  }
});

document.getElementById("btn-voltar-biblioteca").addEventListener("click", () => {
  document.getElementById("livro-leitura-view").classList.add("hidden");
  document.getElementById("livro-biblioteca-view").classList.remove("hidden");
  carregarLivro(); // atualiza progresso ao voltar
});

async function abrirLeitorDoLivro(livroId) {
  const livro = todosLivrosCache.find((l) => l.id === livroId);
  const statusEl = document.getElementById("livro-status");
  const canvas = document.getElementById("livro-canvas");

  document.getElementById("livro-biblioteca-view").classList.add("hidden");
  document.getElementById("livro-leitura-view").classList.remove("hidden");
  statusEl.textContent = "Carregando…";

  try {
    await abrirLivro(currentUser.uid, livro, canvas, (pagina, total) => {
      document.getElementById("livro-pagina-texto").textContent = `Página ${pagina} de ${total}`;
      statusEl.textContent = livro.titulo;
    });
  } catch (e) {
    statusEl.textContent = "Não consegui abrir o livro. Confira se o arquivo ainda está disponível.";
  }
}

document.getElementById("btn-pagina-anterior").addEventListener("click", async () => {
  const canvas = document.getElementById("livro-canvas");
  await paginaAnterior(currentUser.uid, canvas, (pagina, total) => {
    document.getElementById("livro-pagina-texto").textContent = `Página ${pagina} de ${total}`;
  });
});

document.getElementById("btn-pagina-proxima").addEventListener("click", async () => {
  const canvas = document.getElementById("livro-canvas");
  await proximaPagina(currentUser.uid, canvas, (pagina, total) => {
    document.getElementById("livro-pagina-texto").textContent = `Página ${pagina} de ${total}`;
  });
});
