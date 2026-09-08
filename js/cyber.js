// cyber.js
// Módulo Cybersecurity — Fase 1: dashboard, trilhas, progressão, "continuar
// estudando" e laboratórios. Carregado sob demanda (import dinâmico) quando a
// aba abre, igual ao topology.js. Reaproveita o Tutor IA, o activityLog / streak
// e o sistema de XP já existentes — não cria uma segunda progressão.
//
// Fases seguintes (SOC Lab, ferramentas, Tutor Cyber, CTF, pontos fracos) entram
// depois, sem quebrar o que está aqui.

import { collection, getDocs, doc, setDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { logActivity } from "./data-schema.js";
import { explicarTopico } from "./ai-tutor.js";
import { getDashboardData } from "./dashboard.js";
import { escapeHtml } from "./utils.js";

const DIFICULDADE_LABEL = { basico: "Básico", intermediario: "Intermediário", avancado: "Avançado" };
const TIPO_LABEL = { teoria: "Teoria", lab: "Lab", quiz: "Quiz" };

let conteudoCache = null; // { tracks, lessons, labs }
let uidAtual = null;

function corHexSegura(v, fallback = "#3E6B6B") {
  return typeof v === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v.trim()) ? v.trim() : fallback;
}

// ---------- DADOS ----------

async function carregarConteudo() {
  if (conteudoCache) return conteudoCache;
  const [tr, le, la] = await Promise.all([
    getDocs(collection(db, "content", "cyberTracks", "items")),
    getDocs(collection(db, "content", "cyberLessons", "items")),
    getDocs(collection(db, "content", "cyberLabs", "items")),
  ]);
  conteudoCache = {
    tracks: tr.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.ordem || 0) - (b.ordem || 0)),
    lessons: le.docs.map((d) => ({ id: d.id, ...d.data() })),
    labs: la.docs.map((d) => ({ id: d.id, ...d.data() })),
  };
  return conteudoCache;
}

async function carregarProgresso(uid) {
  const [licSnap, labSnap] = await Promise.all([
    getDocs(collection(db, "users", uid, "cyberProgress")),
    getDocs(collection(db, "users", uid, "cyberLabProgress")),
  ]);
  const licoes = {};
  licSnap.docs.forEach((d) => (licoes[d.id] = d.data()));
  const labs = {};
  labSnap.docs.forEach((d) => (labs[d.id] = d.data()));
  return { licoes, labs };
}

// Minutos de atividade Cybersecurity no mês corrente.
async function minutosCyberDoMes(uid) {
  try {
    const q = query(collection(db, "users", uid, "activityLog"), where("tipo", "in", ["cyber_licao", "cyber_lab"]));
    const snap = await getDocs(q);
    const agora = new Date();
    let min = 0;
    snap.docs.forEach((d) => {
      const a = d.data();
      const t = a.timestamp?.toDate?.();
      if (t && t.getFullYear() === agora.getFullYear() && t.getMonth() === agora.getMonth()) {
        min += a.duracao || 0;
      }
    });
    return min;
  } catch {
    return 0;
  }
}

export async function marcarLicaoCyber(uid, licaoId, mastery) {
  await setDoc(
    doc(db, "users", uid, "cyberProgress", licaoId),
    { masteryPercent: mastery, lastUpdated: serverTimestamp() },
    { merge: true }
  );
  await logActivity(uid, "cyber_licao", licaoId, 5).catch(() => {});
}

// ---------- CÁLCULO DE PROGRESSO ----------

const LICAO_CONCLUIDA = 80;

function progressoDaTrilha(track, lessons, progLicoes) {
  const daTrilha = lessons.filter((l) => l.trackId === track.id);
  if (daTrilha.length === 0) return { total: 0, feitas: 0, percent: null };
  const feitas = daTrilha.filter((l) => (progLicoes[l.id]?.masteryPercent ?? 0) >= LICAO_CONCLUIDA).length;
  return { total: daTrilha.length, feitas, percent: Math.round((feitas / daTrilha.length) * 100) };
}

function proximaLicao(track, lessons, progLicoes) {
  return lessons
    .filter((l) => l.trackId === track.id)
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
    .find((l) => (progLicoes[l.id]?.masteryPercent ?? 0) < LICAO_CONCLUIDA);
}

// ---------- RENDER ----------

function iconeDificuldade(d) {
  return d === "avancado" ? "advanced" : d === "intermediario" ? "medium" : "basic";
}

function estadoVazioHtml() {
  return `
    <div class="task-card cyber-vazio">
      <div class="cyber-vazio-icone">🛡️</div>
      <h3>Comece sua jornada em Cybersecurity</h3>
      <p>0% concluído · nenhum laboratório concluído ainda.</p>
      <p class="cyber-vazio-dica">Recomendação: comece por <strong>Fundamentos de Cybersecurity</strong>.</p>
      <button class="btn-primary" data-cyber-comecar="fundamentos" style="width:auto;">Começar trilha →</button>
    </div>`;
}

function metricasHtml(m) {
  const cel = (label, valor, sub) => `
    <div class="kpi-card cyber-metric">
      <span class="kpi-label">${label}</span>
      <div class="kpi-valor">${valor}</div>
      <span class="kpi-variacao neutro">${sub}</span>
    </div>`;
  return `
    <div class="kpi-grid cyber-metrics">
      ${cel("Nível atual", `Nível ${m.nivel}`, `${m.xp} XP`)}
      ${cel("Progresso geral", `${m.percentGeral}%`, `${m.licoesFeitas} de ${m.licoesTotais} lições`)}
      ${cel("Laboratórios", m.labsFeitos, "concluídos")}
      ${cel("Horas de estudo", m.horasMes, "este mês")}
      ${cel("Sequência", `${m.streak} dias`, m.streak >= 3 ? "Excelente!" : "Continue!")}
    </div>`;
}

function continuarHtml(track, prox, prog) {
  const cor = corHexSegura(track.cor);
  return `
    <div class="task-card cyber-continuar" style="border-left:3px solid ${cor};">
      <span class="eyebrow">${escapeHtml(track.nome)}</span>
      <h3>${prox ? escapeHtml(prox.nome) : "Trilha concluída 🎉"}</h3>
      <p>${escapeHtml(track.descricao || "")}</p>
      <div class="track" style="margin:14px 0 6px;"><div class="fill" style="width:${prog.percent || 0}%; background:${cor};"></div></div>
      <div class="cyber-continuar-meta">
        <span>${prox ? "Próxima: " + escapeHtml(prox.nome) : "Tudo em dia nesta trilha"}</span>
        <strong>${prog.percent || 0}%</strong>
      </div>
      <button class="btn-primary" data-cyber-abrir-trilha="${track.id}" style="width:auto; margin-top:14px;">Continuar →</button>
    </div>`;
}

function trilhasGridHtml(tracks, lessons, progLicoes) {
  const cards = tracks
    .map((t) => {
      const p = progressoDaTrilha(t, lessons, progLicoes);
      const cor = corHexSegura(t.cor);
      const emBreve = p.percent === null;
      return `
      <button class="cyber-track-card ${emBreve ? "cyber-track-em-breve" : ""}" data-cyber-abrir-trilha="${t.id}" ${emBreve ? "disabled" : ""}>
        <span class="cyber-track-icone">${t.icone || "🛡️"}</span>
        <span class="cyber-track-nome">${escapeHtml(t.nome)}</span>
        <div class="track cyber-track-barra"><div class="fill" style="width:${p.percent || 0}%; background:${cor};"></div></div>
        <span class="cyber-track-pct">${emBreve ? "Conteúdo em breve" : p.percent + "% · " + p.feitas + "/" + p.total}</span>
      </button>`;
    })
    .join("");
  return `
    <div class="task-card">
      <div class="cyber-secao-header"><h3>Trilhas de aprendizado</h3></div>
      <div class="cyber-track-grid">${cards}</div>
    </div>`;
}

function labsHtml(labs, progLabs) {
  const linhas = labs
    .slice()
    .sort((a, b) => (a.dificuldade || "").localeCompare(b.dificuldade || ""))
    .map((lab) => {
      const feito = progLabs[lab.id]?.concluido;
      return `
      <div class="cyber-lab-item">
        <div>
          <div class="cyber-lab-titulo">${escapeHtml(lab.nome)} ${feito ? '<span class="cyber-lab-ok">✓ concluído</span>' : ""}</div>
          <div class="cyber-lab-desc">${escapeHtml(lab.descricao || "")}</div>
        </div>
        <span class="badge ${iconeDificuldade(lab.dificuldade)}">${DIFICULDADE_LABEL[lab.dificuldade] || lab.dificuldade}</span>
        <button class="btn-secondary" data-cyber-abrir-lab="${lab.id}" style="width:auto; margin-top:0; padding:7px 12px; font-size:12px;">${feito ? "Rever" : "Abrir"}</button>
      </div>`;
    })
    .join("");
  return `
    <div class="task-card">
      <div class="cyber-secao-header"><h3>Laboratórios</h3></div>
      ${linhas || '<p style="font-size:13px; color:var(--ink-soft);">Nenhum laboratório disponível ainda.</p>'}
    </div>`;
}

function desempenhoHtml(tracks, lessons, progLicoes) {
  const linhas = tracks
    .map((t) => ({ t, p: progressoDaTrilha(t, lessons, progLicoes) }))
    .filter((x) => x.p.percent !== null)
    .sort((a, b) => b.p.percent - a.p.percent)
    .slice(0, 8)
    .map(
      ({ t, p }) => `
      <div class="cyber-skill">
        <span>${escapeHtml(t.nome)}</span>
        <div class="track"><div class="fill" style="width:${p.percent}%; background:${corHexSegura(t.cor)};"></div></div>
        <strong>${p.percent}%</strong>
      </div>`
    )
    .join("");
  return `
    <div class="task-card">
      <div class="cyber-secao-header"><h3>Seu desempenho</h3></div>
      ${linhas || '<p style="font-size:13px; color:var(--ink-soft);">Complete lições pra ver seu desempenho por trilha.</p>'}
    </div>`;
}

// Painel de lições de uma trilha (expandido abaixo da grade).
function painelTrilhaHtml(track, lessons, progLicoes) {
  const itens = lessons
    .filter((l) => l.trackId === track.id)
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
    .map((l) => {
      const m = progLicoes[l.id]?.masteryPercent ?? 0;
      const feita = m >= LICAO_CONCLUIDA;
      return `
      <button class="cyber-licao-linha ${feita ? "feita" : ""}" data-cyber-licao="${l.id}" data-cyber-licao-nome="${escapeHtml(l.nome)}">
        <span class="cyber-licao-status">${feita ? "✓" : ""}</span>
        <span class="cyber-licao-nome">${escapeHtml(l.nome)}</span>
        <span class="cyber-licao-tipo">${TIPO_LABEL[l.tipo] || l.tipo}${l.ccnaTopicId ? " · ligado ao CCNA" : ""}</span>
      </button>`;
    })
    .join("");
  return `
    <div class="task-card cyber-painel-trilha" id="cyber-painel-trilha">
      <div class="cyber-secao-header">
        <h3>${escapeHtml(track.nome)}</h3>
        <button class="btn-secondary" data-cyber-fechar-trilha style="width:auto; margin-top:0; padding:6px 12px; font-size:12px;">Fechar</button>
      </div>
      <p style="font-size:13px; color:var(--ink-soft); margin-bottom:12px;">${escapeHtml(track.descricao || "")}</p>
      <div class="cyber-licoes-lista">${itens}</div>
      <div class="cyber-licao-conteudo hidden" id="cyber-licao-conteudo"></div>
    </div>`;
}

// ---------- ORQUESTRAÇÃO ----------

let trilhaAbertaId = null;

async function render() {
  const raiz = document.getElementById("cyber-conteudo");
  if (!raiz) return;
  raiz.innerHTML = `<p style="color:var(--ink-soft); font-size:13px;">Carregando Cybersecurity…</p>`;

  const [{ tracks, lessons, labs }, progresso, dash, minutosMes] = await Promise.all([
    carregarConteudo(),
    carregarProgresso(uidAtual),
    getDashboardData(uidAtual).catch(() => ({ nivel: 0, xp: 0, streakDias: 0 })),
    minutosCyberDoMes(uidAtual),
  ]);

  if (!tracks.length) {
    raiz.innerHTML = `
      <div class="task-card cyber-vazio">
        <div class="cyber-vazio-icone">🛡️</div>
        <h3>Conteúdo de Cybersecurity ainda não carregado</h3>
        <p>As trilhas são populadas no primeiro login da conta que administra o conteúdo. Saia e entre de novo; se você é a conta admin, recarregue a página.</p>
      </div>`;
    return;
  }

  const progLicoes = progresso.licoes;
  const progLabs = progresso.labs;

  const licoesTotais = lessons.length;
  const licoesFeitas = lessons.filter((l) => (progLicoes[l.id]?.masteryPercent ?? 0) >= LICAO_CONCLUIDA).length;
  const percentGeral = licoesTotais ? Math.round((licoesFeitas / licoesTotais) * 100) : 0;
  const labsFeitos = Object.values(progLabs).filter((p) => p.concluido).length;
  const h = Math.floor(minutosMes / 60);
  const min = Math.round(minutosMes % 60);
  const horasMes = minutosMes === 0 ? "0h" : h > 0 ? `${h}h ${min}min` : `${min}min`;

  const nenhumProgresso = Object.keys(progLicoes).length === 0 && labsFeitos === 0;

  // Trilha "continuar": a de maior progresso ainda não concluída; senão Fundamentos.
  const comProgresso = tracks
    .map((t) => ({ t, p: progressoDaTrilha(t, lessons, progLicoes) }))
    .filter((x) => x.p.percent !== null && x.p.percent > 0 && x.p.percent < 100)
    .sort((a, b) => b.p.percent - a.p.percent);
  const trilhaContinuar = comProgresso[0]?.t || tracks.find((t) => progressoDaTrilha(t, lessons, progLicoes).percent !== null);

  let html = "";
  html += metricasHtml({ nivel: dash.nivel ?? 0, xp: dash.xp ?? 0, percentGeral, licoesFeitas, licoesTotais, labsFeitos, horasMes, streak: dash.streakDias ?? 0 });

  html += `<div class="cyber-grid"><div class="cyber-col-principal">`;

  if (nenhumProgresso) {
    html += estadoVazioHtml();
  } else if (trilhaContinuar) {
    const prox = proximaLicao(trilhaContinuar, lessons, progLicoes);
    html += `<div class="task-card cyber-continuar-wrap"><div class="cyber-secao-header"><h3>Continuar estudando</h3></div>${continuarHtml(
      trilhaContinuar,
      prox,
      progressoDaTrilha(trilhaContinuar, lessons, progLicoes)
    )}</div>`;
  }

  html += trilhasGridHtml(tracks, lessons, progLicoes);
  html += `<div id="cyber-slot-painel"></div>`;
  html += labsHtml(labs, progLabs);

  html += `</div><div class="cyber-col-lateral">`;
  html += desempenhoHtml(tracks, lessons, progLicoes);
  html += `</div></div>`;

  raiz.innerHTML = html;

  // Reabre o painel da trilha que estava aberto (após re-render pós "marcar estudada").
  if (trilhaAbertaId) abrirPainelTrilha(trilhaAbertaId, { silencioso: true });
}

function abrirPainelTrilha(trackId, { silencioso = false } = {}) {
  const { tracks, lessons } = conteudoCache;
  const track = tracks.find((t) => t.id === trackId);
  if (!track) return;
  trilhaAbertaId = trackId;
  const slot = document.getElementById("cyber-slot-painel");
  if (!slot) return;
  carregarProgresso(uidAtual).then((prog) => {
    slot.innerHTML = painelTrilhaHtml(track, lessons, prog.licoes);
    if (!silencioso) document.getElementById("cyber-painel-trilha")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function fecharPainelTrilha() {
  trilhaAbertaId = null;
  const slot = document.getElementById("cyber-slot-painel");
  if (slot) slot.innerHTML = "";
}

async function abrirLicao(licaoId, licaoNome) {
  const painel = document.getElementById("cyber-licao-conteudo");
  if (!painel) return;
  if (!painel.classList.contains("hidden") && painel.dataset.licao === licaoId) {
    painel.classList.add("hidden");
    return;
  }
  painel.dataset.licao = licaoId;
  painel.classList.remove("hidden");
  painel.innerHTML = `<p class="eyebrow">${escapeHtml(licaoNome)}</p><p>Gerando explicação…</p>`;

  try {
    const texto = await explicarTopico(licaoNome, "iniciante");
    painel.innerHTML = `
      <p class="eyebrow">${escapeHtml(licaoNome)}</p>
      <p class="licao-texto">${escapeHtml(texto)}</p>
      <button class="btn-primary" data-cyber-marcar="${licaoId}" style="margin-top:12px;">Marcar como estudada</button>`;
  } catch (e) {
    painel.innerHTML = `<p class="eyebrow">${escapeHtml(licaoNome)}</p><p>Não consegui gerar a explicação agora. Verifique se o Firebase AI Logic está ativado.</p>
      <button class="btn-primary" data-cyber-marcar="${licaoId}" style="margin-top:12px;">Marcar como estudada</button>`;
  }
}

// Delegação de eventos — um listener só na raiz.
function ligarEventos() {
  const raiz = document.getElementById("cyber-conteudo");
  if (!raiz || raiz.dataset.ligado === "1") return;
  raiz.dataset.ligado = "1";

  raiz.addEventListener("click", async (e) => {
    const comecar = e.target.closest("[data-cyber-comecar]");
    const abrirTrilha = e.target.closest("[data-cyber-abrir-trilha]");
    const fecharTrilha = e.target.closest("[data-cyber-fechar-trilha]");
    const licao = e.target.closest("[data-cyber-licao]");
    const marcar = e.target.closest("[data-cyber-marcar]");
    const abrirLab = e.target.closest("[data-cyber-abrir-lab]");

    if (comecar || abrirTrilha) {
      abrirPainelTrilha((comecar || abrirTrilha).dataset.cyberComecar || abrirTrilha.dataset.cyberAbrirTrilha);
    } else if (fecharTrilha) {
      fecharPainelTrilha();
    } else if (licao) {
      abrirLicao(licao.dataset.cyberLicao, licao.dataset.cyberLicaoNome);
    } else if (marcar) {
      const btn = marcar;
      btn.disabled = true;
      btn.textContent = "Salvando…";
      const atual = (await carregarProgresso(uidAtual)).licoes[btn.dataset.cyberMarcar]?.masteryPercent ?? 0;
      await marcarLicaoCyber(uidAtual, btn.dataset.cyberMarcar, Math.max(atual, 100));
      await render();
    } else if (abrirLab) {
      // Fase 2 abre a execução completa do lab. Por ora, leva ao checklist.
      abrirLabResumo(abrirLab.dataset.cyberAbrirLab);
    }
  });
}

function abrirLabResumo(labId) {
  const lab = conteudoCache.labs.find((l) => l.id === labId);
  if (!lab) return;
  const slot = document.getElementById("cyber-slot-painel");
  if (!slot) return;
  trilhaAbertaId = null;
  slot.innerHTML = `
    <div class="task-card cyber-painel-trilha">
      <div class="cyber-secao-header">
        <h3>${escapeHtml(lab.nome)}</h3>
        <button class="btn-secondary" data-cyber-fechar-trilha style="width:auto; margin-top:0; padding:6px 12px; font-size:12px;">Fechar</button>
      </div>
      <p style="font-size:13px; color:var(--ink-soft);">${escapeHtml(lab.descricao || "")}</p>
      <p style="font-size:12px; color:var(--ink-soft); margin:8px 0;">
        Dificuldade: <strong>${DIFICULDADE_LABEL[lab.dificuldade] || lab.dificuldade}</strong> ·
        ~${lab.tempoMin || "?"} min ·
        Ferramenta: ${escapeHtml(lab.ferramenta || "—")}
      </p>
      <p style="font-size:12px; color:var(--sage);">🔒 ${escapeHtml(lab.ambiente || "Ambiente de laboratório próprio/autorizado.")}</p>
      <strong style="display:block; margin:12px 0 6px; font-size:13px;">Checklist</strong>
      <ul class="cyber-checklist">${(lab.checklist || []).map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul>
      <p style="font-size:12px; color:var(--ink-soft); margin-top:12px;">A execução guiada com registro de conclusão chega na Fase 2.</p>
    </div>`;
  slot.querySelector(".cyber-painel-trilha")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------- ENTRADA ----------
export async function initCyber(uid) {
  uidAtual = uid;
  ligarEventos();
  await render();
}
