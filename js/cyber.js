// cyber.js
// Módulo Cybersecurity — Fase 1: dashboard, trilhas, progressão, "continuar
// estudando" e laboratórios. Carregado sob demanda (import dinâmico) quando a
// aba abre, igual ao topology.js. Reaproveita o Tutor IA, o activityLog / streak
// e o sistema de XP já existentes — não cria uma segunda progressão.
//
// Fases seguintes (SOC Lab, ferramentas, Tutor Cyber, CTF, pontos fracos) entram
// depois, sem quebrar o que está aqui.

import { collection, getDocs, doc, getDoc, setDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { logActivity } from "./data-schema.js";
import { explicarTopico } from "./ai-tutor.js";
import { getDashboardData } from "./dashboard.js";
import { verificarConquistasCyber, getConquistasDesbloqueadas, CONQUISTAS_CYBER } from "./gamification.js";
import { escapeHtml, corHexSegura } from "./utils.js";

const DIFICULDADE_LABEL = { basico: "Básico", intermediario: "Intermediário", avancado: "Avançado" };
const TIPO_LABEL = { teoria: "Teoria", lab: "Lab", quiz: "Quiz" };

let conteudoCache = null; // { tracks, lessons, labs }
let uidAtual = null;

// ---------- DADOS ----------

async function carregarConteudo() {
  if (conteudoCache) return conteudoCache;
  const [tr, le, la, so, ct, siemSnap] = await Promise.all([
    getDocs(collection(db, "content", "cyberTracks", "items")),
    getDocs(collection(db, "content", "cyberLessons", "items")),
    getDocs(collection(db, "content", "cyberLabs", "items")),
    getDocs(collection(db, "content", "socScenarios", "items")).catch(() => ({ docs: [] })),
    getDocs(collection(db, "content", "cyberCtf", "items")).catch(() => ({ docs: [] })),
    getDoc(doc(db, "content", "cyberSiem", "items", "lote-01")).catch(() => null),
  ]);
  conteudoCache = {
    tracks: tr.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.ordem || 0) - (b.ordem || 0)),
    lessons: le.docs.map((d) => ({ id: d.id, ...d.data() })),
    labs: la.docs.map((d) => ({ id: d.id, ...d.data() })),
    soc: so.docs.map((d) => ({ id: d.id, ...d.data() })),
    ctf: ct.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.ordem || 0) - (b.ordem || 0)),
    siem: siemSnap?.exists?.() ? { id: siemSnap.id, ...siemSnap.data() } : null,
  };
  return conteudoCache;
}

async function carregarProgresso(uid) {
  const [licSnap, labSnap, socSnap, ctfSnap] = await Promise.all([
    getDocs(collection(db, "users", uid, "cyberProgress")),
    getDocs(collection(db, "users", uid, "cyberLabProgress")),
    getDocs(collection(db, "users", uid, "socAttempts")).catch(() => ({ docs: [] })),
    getDocs(collection(db, "users", uid, "cyberCtfProgress")).catch(() => ({ docs: [] })),
  ]);
  const licoes = {};
  licSnap.docs.forEach((d) => (licoes[d.id] = d.data()));
  const labs = {};
  labSnap.docs.forEach((d) => (labs[d.id] = d.data()));
  const soc = {};
  socSnap.docs.forEach((d) => (soc[d.id] = d.data()));
  const ctf = {};
  ctfSnap.docs.forEach((d) => (ctf[d.id] = d.data()));
  return { licoes, labs, soc, ctf };
}

// Minutos de atividade Cybersecurity no mês corrente.
async function minutosCyberDoMes(uid) {
  try {
    const q = query(collection(db, "users", uid, "activityLog"), where("tipo", "in", ["cyber_licao", "cyber_lab", "cyber_soc", "cyber_ctf"]));
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
  await logActivity(uid, "cyber_licao", licaoId, 5).catch((e) => console.warn("[cyber] Falha ao registrar activityLog da lição:", e));
}

export async function salvarProgressoLab(uid, labId, dados) {
  await setDoc(
    doc(db, "users", uid, "cyberLabProgress", labId),
    { ...dados, lastUpdated: serverTimestamp() },
    { merge: true }
  );
}

export async function concluirLab(uid, labId, conclusao, tempoMin) {
  await salvarProgressoLab(uid, labId, { concluido: true, conclusao: conclusao || "", concluidoEm: new Date().toISOString() });
  await logActivity(uid, "cyber_lab", labId, tempoMin || 20).catch((e) => console.warn("[cyber] Falha ao registrar activityLog do lab:", e));
}

export async function registrarTentativaSoc(uid, cenarioId, classificacao, conclusao, acertou, tentativasAtuais = 0) {
  await setDoc(
    doc(db, "users", uid, "socAttempts", cenarioId),
    {
      classificacao,
      conclusao: conclusao || "",
      acertou: !!acertou,
      tentativas: tentativasAtuais + 1,
      concluidoEm: new Date().toISOString(),
      lastUpdated: serverTimestamp(),
    },
    { merge: true }
  );
  if (acertou) await logActivity(uid, "cyber_soc", cenarioId, 15).catch((e) => console.warn("[cyber] Falha ao registrar activityLog do SOC Lab:", e));
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

// ---------- SOC LAB ----------

const SEV_ORDEM = { critico: 0, alto: 1, medio: 2, baixo: 3 };
const SEV_LABEL = { critico: "Crítico", alto: "Alto", medio: "Médio", baixo: "Baixo" };
const SEV_CLASSE = { critico: "advanced", alto: "advanced", medio: "medium", baixo: "basic" };
const CLASSIF_LABEL = { vp: "Verdadeiro positivo", fp: "Falso positivo", investigar: "Necessita investigação" };

function socPainelHtml(cenarios, progSoc) {
  if (!cenarios.length) {
    return `<div class="task-card"><div class="cyber-secao-header"><h3>SOC Lab</h3></div>
      <p style="font-size:13px; color:var(--ink-soft);">Os cenários de alerta são populados no login da conta admin.</p></div>`;
  }
  const resolvidos = cenarios.filter((c) => progSoc[c.id]?.acertou).length;
  const linhas = cenarios
    .slice()
    .sort((a, b) => {
      const ra = progSoc[a.id]?.acertou ? 1 : 0;
      const rb = progSoc[b.id]?.acertou ? 1 : 0;
      if (ra !== rb) return ra - rb; // não resolvidos primeiro
      return (SEV_ORDEM[a.severidade] ?? 9) - (SEV_ORDEM[b.severidade] ?? 9);
    })
    .map((c) => {
      const at = progSoc[c.id];
      const estado = at?.acertou ? '<span class="cyber-lab-ok">✓ resolvido</span>' : at ? '<span class="cyber-soc-retry">tentar de novo</span>' : "";
      return `
      <button class="cyber-soc-alerta" data-cyber-abrir-soc="${c.id}">
        <span class="badge ${SEV_CLASSE[c.severidade] || "medium"}">${SEV_LABEL[c.severidade] || c.severidade}</span>
        <span class="cyber-soc-alerta-info">
          <span class="cyber-soc-alerta-titulo">${escapeHtml(c.codigo)} · ${escapeHtml(c.titulo)}</span>
          <span class="cyber-soc-alerta-sub">${escapeHtml(c.categoria || "")} ${estado}</span>
        </span>
      </button>`;
    })
    .join("");
  return `
    <div class="task-card">
      <div class="cyber-secao-header">
        <h3>SOC Lab</h3>
        <span style="font-size:12px; color:var(--ink-soft);">${resolvidos}/${cenarios.length} resolvidos</span>
      </div>
      <p style="font-size:11px; color:var(--ink-soft); margin-bottom:10px;">Cenários fictícios e educacionais. Analise, classifique e registre a conclusão.</p>
      <div class="cyber-soc-lista">${linhas}</div>
    </div>`;
}

let socAbertoId = null;

async function abrirCenarioSoc(cenarioId) {
  const c = conteudoCache.soc.find((s) => s.id === cenarioId);
  const slot = document.getElementById("cyber-slot-painel");
  if (!c || !slot) return;
  trilhaAbertaId = null;
  labAbertoId = null;
  socAbertoId = cenarioId;

  const at = (await carregarProgresso(uidAtual)).soc[cenarioId] || {};
  const jaResolvido = at.acertou;

  const timeline = (c.timeline || [])
    .map((e) => `<li><span class="cyber-soc-hora">${escapeHtml(e.hora || "")}</span><span><strong>${escapeHtml(e.evento || "")}</strong>${e.detalhe ? " — " + escapeHtml(e.detalhe) : ""}</span></li>`)
    .join("");
  const evid = (c.evidencias || []).map((x) => `<li>${escapeHtml(x)}</li>`).join("");
  const guia = (c.perguntasGuia || []).map((x) => `<li>${escapeHtml(x)}</li>`).join("");

  slot.innerHTML = `
    <div class="task-card cyber-painel-trilha" data-cyber-soc-painel="${cenarioId}">
      <div class="cyber-secao-header">
        <h3>${escapeHtml(c.codigo)} · ${escapeHtml(c.titulo)} ${jaResolvido ? '<span class="cyber-lab-ok">✓ resolvido</span>' : ""}</h3>
        <button class="btn-secondary" data-cyber-fechar-trilha style="width:auto; margin-top:0; padding:6px 12px; font-size:12px;">Fechar</button>
      </div>

      <div class="cyber-soc-cabecalho">
        <span class="badge ${SEV_CLASSE[c.severidade] || "medium"}">${SEV_LABEL[c.severidade] || c.severidade}</span>
        <span><strong>Categoria:</strong> ${escapeHtml(c.categoria || "—")}</span>
        <span><strong>Origem:</strong> ${escapeHtml(c.origem || "—")}</span>
        <span><strong>Destino:</strong> ${escapeHtml(c.destino || "—")}</span>
      </div>

      <p class="cyber-lab-ambiente">🔒 Cenário 100% fictício. IPs externos usam faixas de documentação (RFC 5737). Nenhum sistema real é consultado ou afetado.</p>

      <p style="font-size:13px; margin:12px 0 4px;"><strong>Resumo</strong></p>
      <p style="font-size:13px; color:var(--ink-soft);">${escapeHtml(c.resumo || "")}</p>
      <p style="font-size:13px; color:var(--ink-soft); margin-top:6px;">${escapeHtml(c.contexto || "")}</p>

      <p style="font-size:13px; margin:14px 0 4px;"><strong>Timeline</strong></p>
      <ul class="cyber-soc-timeline">${timeline}</ul>

      <p style="font-size:13px; margin:14px 0 4px;"><strong>Evidências</strong></p>
      <ul class="cyber-checklist">${evid}</ul>

      ${guia ? `<p style="font-size:13px; margin:14px 0 4px;"><strong>Perguntas-guia</strong></p><ul class="cyber-checklist">${guia}</ul>` : ""}

      <p style="font-size:13px; margin:16px 0 6px;"><strong>Sua classificação</strong></p>
      <div class="cyber-soc-opcoes" id="cyber-soc-opcoes">
        <button class="cyber-soc-op" data-classif="vp">Verdadeiro positivo</button>
        <button class="cyber-soc-op" data-classif="fp">Falso positivo</button>
        <button class="cyber-soc-op" data-classif="investigar">Necessita investigação</button>
      </div>

      <label style="display:block; margin-top:14px; font-size:13px; font-weight:600;">Conclusão</label>
      <p style="font-size:11px; color:var(--ink-soft); margin:2px 0 6px;">O que aconteceu, por que você classificou assim e qual seria a próxima ação (mín. 15 caracteres).</p>
      <textarea id="cyber-soc-conclusao" class="cyber-lab-conclusao" rows="3" placeholder="Escreva sua conclusão…">${escapeHtml(at.conclusao || "")}</textarea>

      <button class="btn-primary" data-cyber-soc-enviar="${cenarioId}" style="width:auto; margin-top:12px;" disabled>Enviar classificação</button>
      <div id="cyber-soc-feedback" class="cyber-soc-feedback hidden"></div>
    </div>`;

  slot.querySelector(".cyber-painel-trilha")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function socClassifSelecionada() {
  return document.querySelector("#cyber-soc-opcoes .cyber-soc-op.selecionada")?.dataset.classif || null;
}
function atualizarBotaoSoc() {
  const btn = document.querySelector("[data-cyber-soc-enviar]");
  const conclusao = document.getElementById("cyber-soc-conclusao")?.value?.trim() || "";
  if (btn) btn.disabled = !(socClassifSelecionada() && conclusao.length >= 15);
}

async function enviarClassificacaoSoc(cenarioId) {
  const c = conteudoCache.soc.find((s) => s.id === cenarioId);
  const classif = socClassifSelecionada();
  const conclusao = document.getElementById("cyber-soc-conclusao")?.value?.trim() || "";
  if (!c || !classif || conclusao.length < 15) return;

  const acertou = classif === c.classificacaoCorreta;
  const at = (await carregarProgresso(uidAtual)).soc[cenarioId] || {};
  await registrarTentativaSoc(uidAtual, cenarioId, classif, conclusao, acertou, at.tentativas || 0);

  const fb = document.getElementById("cyber-soc-feedback");
  if (fb) {
    fb.classList.remove("hidden");
    fb.classList.toggle("acerto", acertou);
    fb.classList.toggle("erro", !acertou);
    fb.innerHTML = `
      <strong>${acertou ? "✓ Classificação correta" : "✗ Não é a classificação esperada"}</strong>
      <p style="margin-top:4px;">Resposta do cenário: <strong>${CLASSIF_LABEL[c.classificacaoCorreta]}</strong>.</p>
      <p style="margin-top:6px;">${escapeHtml(c.explicacao || "")}</p>
      ${acertou ? '<p style="margin-top:6px; color:var(--sage);">XP registrado. Volte ao painel pra ver o próximo alerta.</p>' : '<p style="margin-top:6px;">Revise a timeline e as evidências e tente de novo.</p>'}`;
  }
  // Atualiza o painel lateral em segundo plano (marca resolvido / contador).
  const lateral = document.querySelector(".cyber-col-lateral");
  carregarProgresso(uidAtual).then((prog) => {
    if (lateral) lateral.querySelector(".task-card").outerHTML = socPainelHtml(conteudoCache.soc, prog.soc);
  });
}

// ---------- FASE 3: painéis (ferramentas, CTF, tutor) ----------

let painelFase3 = null; // "tools" | "ctf" — pra reabrir após re-render

async function abrirFerramentas() {
  const slot = document.getElementById("cyber-slot-painel");
  if (!slot) return;
  trilhaAbertaId = labAbertoId = socAbertoId = null;
  painelFase3 = "tools";
  slot.innerHTML = `
    <div class="task-card cyber-painel-trilha">
      <div class="cyber-secao-header">
        <h3>Ferramentas de Segurança</h3>
        <button class="btn-secondary" data-cyber-fechar-trilha style="width:auto; margin-top:0; padding:6px 12px; font-size:12px;">Fechar</button>
      </div>
      <p class="cyber-lab-ambiente">🔒 Tudo roda localmente no navegador. Nenhuma varredura de rede, descoberta de hosts ou chamada externa.</p>
      <div id="cyber-tools-raiz"></div>
    </div>`;
  slot.querySelector(".cyber-painel-trilha")?.scrollIntoView({ behavior: "smooth", block: "start" });
  try {
    const mod = await import("./cyber-tools.js");
    mod.renderFerramentas(document.getElementById("cyber-tools-raiz"));
  } catch (e) {
    const r = document.getElementById("cyber-tools-raiz");
    if (r) r.innerHTML = `<p style="color:var(--terracotta); font-size:13px;">Não consegui carregar as ferramentas.</p>`;
  }
}

async function abrirDesafioCtf(ctfId) {
  const d = conteudoCache.ctf.find((x) => x.id === ctfId);
  const slot = document.getElementById("cyber-slot-painel");
  if (!d || !slot) return;
  trilhaAbertaId = labAbertoId = socAbertoId = null;
  painelFase3 = "ctf:" + ctfId;
  const prog = (await carregarProgresso(uidAtual)).ctf[ctfId] || {};

  slot.innerHTML = `
    <div class="task-card cyber-painel-trilha" data-cyber-ctf-painel="${ctfId}">
      <div class="cyber-secao-header">
        <h3>${escapeHtml(d.titulo)} ${prog.resolvido ? '<span class="cyber-lab-ok">✓ resolvido</span>' : ""}</h3>
        <button class="btn-secondary" data-cyber-fechar-trilha style="width:auto; margin-top:0; padding:6px 12px; font-size:12px;">Fechar</button>
      </div>
      <p style="font-size:12px; color:var(--ink-soft);">${escapeHtml(d.categoria || "")} · ${DIFICULDADE_LABEL[d.dificuldade] || d.dificuldade}</p>
      <pre class="cyber-ctf-enunciado">${escapeHtml(d.enunciado || "")}</pre>
      ${d.dica ? `<details class="cyber-ctf-dica"><summary>Dica</summary><p>${escapeHtml(d.dica)}</p></details>` : ""}
      <label class="cyber-tool-label" style="margin-top:12px;">Sua resposta</label>
      <input id="cyber-ctf-resp" class="cyber-tool-input" placeholder="Digite a resposta…" />
      <button class="btn-primary" data-cyber-ctf-enviar="${ctfId}" style="width:auto; margin-top:10px;">Verificar</button>
      <div id="cyber-ctf-feedback" class="cyber-soc-feedback hidden"></div>
    </div>`;
  slot.querySelector(".cyber-painel-trilha")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function verificarCtf(ctfId) {
  const d = conteudoCache.ctf.find((x) => x.id === ctfId);
  const entrada = document.getElementById("cyber-ctf-resp")?.value || "";
  if (!d || !entrada.trim()) return;
  const mod = await import("./cyber-tools.js");
  const acertou = mod.conferirRespostaCtf(entrada, d.respostas);
  const fb = document.getElementById("cyber-ctf-feedback");

  if (acertou) {
    const prog = (await carregarProgresso(uidAtual)).ctf[ctfId] || {};
    await setDoc(
      doc(db, "users", uidAtual, "cyberCtfProgress", ctfId),
      { resolvido: true, tentativas: (prog.tentativas || 0) + 1, resolvidoEm: new Date().toISOString(), lastUpdated: serverTimestamp() },
      { merge: true }
    );
    await logActivity(uidAtual, "cyber_ctf", ctfId, 10).catch((e) => console.warn("[cyber] Falha ao registrar activityLog do CTF:", e));
  }
  if (fb) {
    fb.classList.remove("hidden");
    fb.classList.toggle("acerto", acertou);
    fb.classList.toggle("erro", !acertou);
    fb.innerHTML = acertou
      ? `<strong>✓ Correto!</strong><p style="margin-top:6px;">${escapeHtml(d.explicacao || "")}</p><p style="margin-top:6px; color:var(--sage);">XP registrado.</p>`
      : `<strong>✗ Ainda não</strong><p style="margin-top:6px;">Revise o enunciado${d.dica ? " e a dica" : ""} e tente outra formulação da resposta.</p>`;
  }
}

async function perguntarTutorCyberUI() {
  const inp = document.getElementById("cyber-tutor-in");
  const out = document.getElementById("cyber-tutor-out");
  const pergunta = inp?.value?.trim();
  if (!pergunta || !out) return;
  out.classList.remove("hidden");
  out.textContent = "Consultando o Tutor…";
  try {
    const { perguntarTutorCyber } = await import("./ai-tutor.js");
    out.textContent = await perguntarTutorCyber(pergunta);
  } catch (e) {
    out.textContent = "Não consegui responder agora. Verifique se o Firebase AI Logic está ativado.";
  }
}

// ---------- FASE 3: cards (pontos fracos, ferramentas, CTF, tutor) ----------

function pontosFracosHtml(tracks, lessons, progLicoes) {
  const comConteudo = tracks
    .map((t) => ({ t, p: progressoDaTrilha(t, lessons, progLicoes) }))
    .filter((x) => x.p.percent !== null);
  const iniciadas = comConteudo.filter((x) => x.p.percent > 0);
  if (iniciadas.length === 0) {
    return `<div class="task-card"><div class="cyber-secao-header"><h3>Pontos fracos</h3></div>
      <p style="font-size:13px; color:var(--ink-soft);">Comece uma trilha pra o sistema apontar onde reforçar.</p></div>`;
  }
  const fracas = iniciadas.sort((a, b) => a.p.percent - b.p.percent).slice(0, 3);
  const recomendacoes = ["Revisar a teoria da trilha", "Refazer as lições marcadas como pendentes", "Executar o laboratório da trilha", "Fazer o quiz da trilha"];
  const linhas = fracas
    .map(
      ({ t, p }) => `
      <div class="cyber-fraco">
        <div class="cyber-fraco-topo"><strong>${escapeHtml(t.nome)}</strong><span>${p.percent}%</span></div>
        <div class="track"><div class="fill" style="width:${p.percent}%; background:var(--terracotta);"></div></div>
        <button class="btn-secondary" data-cyber-abrir-trilha="${t.id}" style="width:auto; margin-top:8px; padding:6px 12px; font-size:12px;">${escapeHtml(recomendacoes[0])} →</button>
      </div>`
    )
    .join("");
  return `<div class="task-card"><div class="cyber-secao-header"><h3>Pontos fracos</h3></div>
    <p style="font-size:11px; color:var(--ink-soft); margin-bottom:10px;">Trilhas iniciadas com menor domínio. Sugestão: ${escapeHtml(recomendacoes.join(" · "))}.</p>
    ${linhas}</div>`;
}

function ferramentasCardHtml() {
  return `<div class="task-card"><div class="cyber-secao-header"><h3>Ferramentas de Segurança</h3></div>
    <p style="font-size:11px; color:var(--ink-soft); margin-bottom:10px;">Base64, hash, analisador de IP/URL, portas e calculadora CVSS — tudo roda só no navegador, sem chamada externa.</p>
    <button class="btn-secondary" data-cyber-abrir-tools style="width:auto; margin-top:0;">Abrir ferramentas</button></div>`;
}

function conquistasCyberHtml(desbloqueadas) {
  const ids = new Set(desbloqueadas.map((c) => c.id));
  const cards = CONQUISTAS_CYBER.map((c) => {
    const ok = ids.has(c.id);
    return `<div class="conquista-card ${ok ? "desbloqueada" : ""}" title="${escapeHtml(c.desc)}">
      <div class="conquista-card-icone">${ok ? "🏆" : "🔒"}</div>
      <div class="conquista-card-nome">${escapeHtml(c.nome)}</div>
      <div class="conquista-card-status">${ok ? "Concluída" : "Bloqueada"}</div>
    </div>`;
  }).join("");
  const total = CONQUISTAS_CYBER.length;
  const feitas = CONQUISTAS_CYBER.filter((c) => ids.has(c.id)).length;
  return `<div class="task-card"><div class="cyber-secao-header"><h3>Conquistas Cyber</h3><span style="font-size:12px; color:var(--ink-soft);">${feitas}/${total}</span></div>
    <div class="conquistas-grid">${cards}</div></div>`;
}

// Confete + toast ao desbloquear conquista Cyber — mesma mecânica visual do
// dashboard principal (app.js), duplicada aqui porque esse módulo é carregado
// sob demanda e não importa app.js (evita dependência circular).
function celebrarConquistaCyber(novas) {
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

function tutorCyberHtml() {
  return `<div class="task-card"><div class="cyber-secao-header"><h3>Tutor Cyber</h3></div>
    <p style="font-size:11px; color:var(--ink-soft); margin-bottom:8px;">Explica logs, alertas e conceitos de defesa. Reaproveita o Tutor IA do app.</p>
    <textarea id="cyber-tutor-in" class="cyber-lab-conclusao" rows="2" placeholder="Ex.: o que significa Event ID 4672?"></textarea>
    <button class="btn-secondary" data-cyber-tutor-perguntar style="width:auto; margin-top:8px;">Perguntar</button>
    <div id="cyber-tutor-out" class="cyber-tutor-out hidden"></div></div>`;
}

function ctfHtml(desafios, progCtf) {
  if (!desafios.length) return "";
  const resolvidos = desafios.filter((d) => progCtf[d.id]?.resolvido).length;
  const linhas = desafios
    .map((d) => {
      const ok = progCtf[d.id]?.resolvido;
      return `<button class="cyber-lab-item cyber-ctf-linha" data-cyber-abrir-ctf="${d.id}" style="width:100%; text-align:left; background:none; border:0; border-bottom:1px solid var(--border);">
        <div>
          <div class="cyber-lab-titulo">${escapeHtml(d.titulo)} ${ok ? '<span class="cyber-lab-ok">✓ resolvido</span>' : ""}</div>
          <div class="cyber-lab-desc">${escapeHtml(d.categoria || "")}</div>
        </div>
        <span class="badge ${iconeDificuldade(d.dificuldade)}">${DIFICULDADE_LABEL[d.dificuldade] || d.dificuldade}</span>
        <span style="font-size:12px; color:var(--teal);">Abrir →</span>
      </button>`;
    })
    .join("");
  return `<div class="task-card"><div class="cyber-secao-header"><h3>Desafios / CTF</h3><span style="font-size:12px; color:var(--ink-soft);">${resolvidos}/${desafios.length}</span></div>
    <p style="font-size:11px; color:var(--ink-soft); margin-bottom:10px;">Exercícios sobre dados fictícios. Ambientes próprios/educacionais.</p>
    ${linhas}</div>`;
}

// Painel de lições de uma trilha (expandido abaixo da grade).
function painelTrilhaHtml(track, lessons, progLicoes) {
  const itens = lessons
    .filter((l) => l.trackId === track.id)
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
    .map((l) => {
      const m = progLicoes[l.id]?.masteryPercent ?? 0;
      const feita = m >= LICAO_CONCLUIDA;
      // Lições do tipo "lab" abrem o laboratório interativo em vez do texto.
      const attrs =
        l.tipo === "lab" && l.labId
          ? `data-cyber-abrir-lab="${l.labId}"`
          : `data-cyber-licao="${l.id}" data-cyber-licao-nome="${escapeHtml(l.nome)}"`;
      return `
      <button class="cyber-licao-linha ${feita ? "feita" : ""}" ${attrs}>
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

  const [{ tracks, lessons, labs, soc }, progresso, dash, minutosMes] = await Promise.all([
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
  const progSoc = progresso.soc || {};

  const licoesTotais = lessons.length;
  const licoesFeitas = lessons.filter((l) => (progLicoes[l.id]?.masteryPercent ?? 0) >= LICAO_CONCLUIDA).length;
  const percentGeral = licoesTotais ? Math.round((licoesFeitas / licoesTotais) * 100) : 0;
  const labsFeitos = Object.values(progLabs).filter((p) => p.concluido).length;
  const socFeitos = Object.values(progSoc).filter((p) => p?.acertou).length;
  const ctfFeitos = Object.values(progresso.ctf || {}).filter((p) => p?.resolvido).length;
  const h = Math.floor(minutosMes / 60);
  const min = Math.round(minutosMes % 60);
  const horasMes = minutosMes === 0 ? "0h" : h > 0 ? `${h}h ${min}min` : `${min}min`;
  const nenhumProgresso = Object.keys(progLicoes).length === 0 && labsFeitos === 0 && socFeitos === 0 && ctfFeitos === 0;

  const trilhasComProgresso = tracks.map((t) => progressoDaTrilha(t, lessons, progLicoes)).filter((p) => p.percent !== null);
  const dadosCyber = {
    labsFeitos,
    socFeitos,
    ctfFeitos,
    percentGeral,
    siemConcluido: !!progLabs[SIEM_LAB_ID]?.concluido,
    trilhasConcluidas: trilhasComProgresso.filter((p) => p.percent === 100).length,
    trilhasComConteudo: trilhasComProgresso.length,
  };
  const novasConquistasCyber = await verificarConquistasCyber(uidAtual, dadosCyber).catch(() => []);
  const desbloqueadasCyber = await getConquistasDesbloqueadas(uidAtual).catch(() => []);

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
  html += ctfHtml(conteudoCache.ctf || [], progresso.ctf || {});

  html += `</div><div class="cyber-col-lateral">`;
  html += socPainelHtml(soc || [], progSoc);
  html += conquistasCyberHtml(desbloqueadasCyber);
  html += pontosFracosHtml(tracks, lessons, progLicoes);
  html += ferramentasCardHtml();
  html += tutorCyberHtml();
  html += desempenhoHtml(tracks, lessons, progLicoes);
  html += `</div></div>`;

  raiz.innerHTML = html;

  // Reabre o painel que estava aberto (após re-render pós conclusão de lição/lab).
  if (socAbertoId) abrirCenarioSoc(socAbertoId);
  else if (labAbertoId) abrirLabPainel(labAbertoId);
  else if (trilhaAbertaId) abrirPainelTrilha(trilhaAbertaId, { silencioso: true });
  else if (painelFase3 === "tools") abrirFerramentas();
  else if (painelFase3?.startsWith("ctf:")) abrirDesafioCtf(painelFase3.slice(4));

  if (novasConquistasCyber.length > 0) celebrarConquistaCyber(novasConquistasCyber);
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
    const salvarLab = e.target.closest("[data-cyber-lab-salvar]");
    const concluirLabBtn = e.target.closest("[data-cyber-lab-concluir]");
    const abrirSoc = e.target.closest("[data-cyber-abrir-soc]");
    const socOp = e.target.closest("#cyber-soc-opcoes .cyber-soc-op");
    const enviarSoc = e.target.closest("[data-cyber-soc-enviar]");
    const abrirTools = e.target.closest("[data-cyber-abrir-tools]");
    const abrirCtf = e.target.closest("[data-cyber-abrir-ctf]");
    const enviarCtf = e.target.closest("[data-cyber-ctf-enviar]");
    const perguntarTutor = e.target.closest("[data-cyber-tutor-perguntar]");
    const siemLimpar = e.target.closest("[data-cyber-siem-limpar]");
    const siemVerificar = e.target.closest("[data-cyber-siem-verificar]");

    if (abrirTools) return void abrirFerramentas();
    if (abrirCtf) return void abrirDesafioCtf(abrirCtf.dataset.cyberAbrirCtf);
    if (enviarCtf) return void verificarCtf(enviarCtf.dataset.cyberCtfEnviar);
    if (perguntarTutor) return void perguntarTutorCyberUI();
    if (siemLimpar) {
      const labId = siemLimpar.dataset.cyberSiemLimpar;
      document.querySelectorAll(`[data-cyber-lab-painel="${labId}"] .cyber-siem-filtro`).forEach((el) => (el.value = ""));
      renderizarResultadosSiem(labId);
      return;
    }
    if (siemVerificar) return void verificarAchadoSiem(siemVerificar.dataset.cyberSiemVerificar);

    if (abrirSoc) {
      abrirCenarioSoc(abrirSoc.dataset.cyberAbrirSoc);
      return;
    }
    if (socOp) {
      document.querySelectorAll("#cyber-soc-opcoes .cyber-soc-op").forEach((b) => b.classList.toggle("selecionada", b === socOp));
      atualizarBotaoSoc();
      return;
    }
    if (enviarSoc) {
      enviarSoc.disabled = true;
      enviarSoc.textContent = "Enviando…";
      await enviarClassificacaoSoc(enviarSoc.dataset.cyberSocEnviar);
      enviarSoc.textContent = "Enviar classificação";
      atualizarBotaoSoc();
      return;
    }

    if (comecar || abrirTrilha) {
      abrirPainelTrilha((comecar || abrirTrilha).dataset.cyberComecar || abrirTrilha.dataset.cyberAbrirTrilha);
    } else if (fecharTrilha) {
      fecharPainel();
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
      abrirLabPainel(abrirLab.dataset.cyberAbrirLab);
    } else if (salvarLab) {
      await persistirEstadoLab(salvarLab.dataset.cyberLabSalvar);
      const st = document.getElementById("cyber-lab-status");
      if (st) st.textContent = "Progresso salvo.";
    } else if (concluirLabBtn) {
      const labId = concluirLabBtn.dataset.cyberLabConcluir;
      const lab = conteudoCache.labs.find((l) => l.id === labId);
      const conclusao = document.getElementById("cyber-lab-conclusao")?.value?.trim() || "";
      if (!estadoLabCompleto(labId, lab)) return;
      concluirLabBtn.disabled = true;
      concluirLabBtn.textContent = "Registrando…";
      await persistirEstadoLab(labId);
      await concluirLab(uidAtual, labId, conclusao, lab?.tempoMin);
      await render();
    }
  });

  // Checkbox do checklist e textarea de conclusão (não são 'click').
  raiz.addEventListener("change", (e) => {
    const chk = e.target.closest("[data-cyber-lab-item]");
    if (chk) {
      atualizarBotaoConcluirLab(chk.closest("[data-cyber-lab-painel]")?.dataset.cyberLabPainel);
      agendarSalvarLab(chk.closest("[data-cyber-lab-painel]")?.dataset.cyberLabPainel);
      return;
    }
    if (e.target.closest(".cyber-siem-filtro")) {
      renderizarResultadosSiem(e.target.closest("[data-cyber-lab-painel]")?.dataset.cyberLabPainel);
    }
  });
  raiz.addEventListener("input", (e) => {
    if (e.target.id === "cyber-lab-conclusao") {
      const labId = e.target.closest("[data-cyber-lab-painel]")?.dataset.cyberLabPainel;
      atualizarBotaoConcluirLab(labId);
      agendarSalvarLab(labId);
    } else if (e.target.id === "cyber-soc-conclusao") {
      atualizarBotaoSoc();
    } else if (e.target.closest(".cyber-siem-filtro")) {
      renderizarResultadosSiem(e.target.closest("[data-cyber-lab-painel]")?.dataset.cyberLabPainel);
    }
  });
}

// ---------- PLAYGROUND SIEM (lab "cylab-siem") ----------
// Usa o mesmo mecanismo de progresso dos demais labs (checklist + conclusão
// em cyberLabProgress) — só a investigação em si é interativa de verdade:
// filtros reais sobre o lote de eventos semeado em content/cyberSiem.

const SIEM_LAB_ID = "cylab-siem";
const SIEM_ACTION_LABEL = { logon: "Logon", process: "Processo", network: "Rede", dns: "DNS", file: "Arquivo", group_change: "Alteração de grupo" };
const SIEM_RESULT_LABEL = { success: "Sucesso", failure: "Falha", allowed: "Permitido", denied: "Negado" };

function siemHora(tsIso) {
  return (tsIso || "").split("T")[1]?.replace("Z", "") || "";
}

function valoresUnicosSiem(eventos, campo) {
  return [...new Set(eventos.map((e) => e[campo]).filter(Boolean))].sort();
}

function optsDeLista(arr, placeholder) {
  return `<option value="">${escapeHtml(placeholder)}</option>` + arr.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
}
function optsDeMapa(mapa, placeholder) {
  return `<option value="">${escapeHtml(placeholder)}</option>` + Object.entries(mapa).map(([v, label]) => `<option value="${v}">${escapeHtml(label)}</option>`).join("");
}

function filtrosSiemAtuais(labId) {
  const raiz = document.querySelector(`[data-cyber-lab-painel="${labId}"]`);
  if (!raiz) return null;
  const val = (sel) => raiz.querySelector(sel)?.value || "";
  return {
    host: val("#cyber-siem-host"),
    user: val("#cyber-siem-user"),
    action: val("#cyber-siem-action"),
    result: val("#cyber-siem-result"),
    texto: val("#cyber-siem-texto").trim().toLowerCase(),
    de: val("#cyber-siem-de"),
    ate: val("#cyber-siem-ate"),
    agrupar: val("#cyber-siem-agrupar"),
  };
}

function filtrarEventosSiem(eventos, f) {
  return eventos
    .filter((e) => !f.host || e.host === f.host)
    .filter((e) => !f.user || e.user === f.user)
    .filter((e) => !f.action || e.action === f.action)
    .filter((e) => !f.result || e.result === f.result)
    .filter((e) => {
      const hora = siemHora(e.ts).slice(0, 5);
      if (f.de && hora < f.de) return false;
      if (f.ate && hora > f.ate) return false;
      return true;
    })
    .filter((e) => !f.texto || `${e.host} ${e.user} ${e.src} ${e.detail || ""}`.toLowerCase().includes(f.texto))
    .sort((a, b) => (a.ts || "").localeCompare(b.ts || ""));
}

function siemTabelaHtml(eventos) {
  if (!eventos.length) return `<p style="font-size:12px; color:var(--ink-soft); margin-top:10px;">Nenhum evento bate com esse filtro.</p>`;
  const linhas = eventos
    .map((e) => {
      const ruim = e.result === "failure" || e.result === "denied";
      return `<tr class="${ruim ? "cyber-siem-linha-ruim" : ""}">
        <td class="cyber-tool-mono">${siemHora(e.ts)}</td>
        <td>${escapeHtml(e.host)}</td>
        <td>${escapeHtml(e.user)}</td>
        <td class="cyber-tool-mono">${escapeHtml(e.src)}</td>
        <td>${SIEM_ACTION_LABEL[e.action] || escapeHtml(e.action)}</td>
        <td>${SIEM_RESULT_LABEL[e.result] || escapeHtml(e.result)}</td>
        <td>${escapeHtml(e.detail || "")}</td>
      </tr>`;
    })
    .join("");
  return `<div class="cyber-tool-scroll"><table class="cyber-tool-tabela cyber-siem-tabela">
    <tr><th>Hora</th><th>Host</th><th>Usuário</th><th>Origem</th><th>Ação</th><th>Resultado</th><th>Detalhe</th></tr>
    ${linhas}
  </table></div>`;
}

function siemGrupoHtml(eventos, campo) {
  if (!campo) return "";
  const contagem = new Map();
  eventos.forEach((e) => {
    const chave = e[campo] || "—";
    const atual = contagem.get(chave) || { total: 0, falhas: 0 };
    atual.total++;
    if (e.result === "failure" || e.result === "denied") atual.falhas++;
    contagem.set(chave, atual);
  });
  const linhas = [...contagem.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .map(([chave, c]) => `<tr><td>${escapeHtml(chave)}</td><td>${c.total}</td><td>${c.falhas || "—"}</td></tr>`)
    .join("");
  return `<p class="cyber-tool-label" style="margin-top:14px;">Agrupado por ${campo === "host" ? "host" : "usuário"}</p>
    <div class="cyber-tool-scroll"><table class="cyber-tool-tabela">
      <tr><th>${campo === "host" ? "Host" : "Usuário"}</th><th>Eventos</th><th>Falhas/negados</th></tr>
      ${linhas}
    </table></div>`;
}

function renderizarResultadosSiem(labId) {
  if (!labId) return;
  const raiz = document.querySelector(`[data-cyber-lab-painel="${labId}"]`);
  const lote = conteudoCache?.siem;
  if (!raiz || !lote) return;
  const f = filtrosSiemAtuais(labId);
  const filtrados = filtrarEventosSiem(lote.eventos || [], f);
  const contagem = raiz.querySelector("#cyber-siem-contagem");
  if (contagem) contagem.textContent = `${filtrados.length} de ${(lote.eventos || []).length} eventos`;
  const tabela = raiz.querySelector("#cyber-siem-tabela-wrap");
  if (tabela) tabela.innerHTML = siemTabelaHtml(filtrados);
  const grupo = raiz.querySelector("#cyber-siem-grupo-wrap");
  if (grupo) grupo.innerHTML = siemGrupoHtml(filtrados, f.agrupar);
}

async function verificarAchadoSiem(labId) {
  const raiz = document.querySelector(`[data-cyber-lab-painel="${labId}"]`);
  const lote = conteudoCache?.siem;
  const fb = raiz?.querySelector("#cyber-siem-feedback");
  if (!raiz || !lote?.achado || !fb) return;
  const hostDigitado = raiz.querySelector("#cyber-siem-resp-host")?.value || "";
  const userDigitado = raiz.querySelector("#cyber-siem-resp-user")?.value || "";
  const { conferirRespostaCtf } = await import("./cyber-tools.js");
  const hostOk = conferirRespostaCtf(hostDigitado, [lote.achado.host]);
  const userOk = conferirRespostaCtf(userDigitado, [lote.achado.usuario]);
  fb.classList.remove("hidden");
  fb.classList.toggle("acerto", hostOk && userOk);
  fb.classList.toggle("erro", !(hostOk && userOk));
  fb.innerHTML =
    hostOk && userOk
      ? `<strong>✓ Investigação correta</strong><p style="margin-top:6px;">${escapeHtml(lote.achado.resumo)}</p>`
      : `<strong>Ainda não bateu</strong><p style="margin-top:6px;">Host ${hostOk ? "✓" : "✗"} · Usuário ${userOk ? "✓" : "✗"}. Tente isolar a janela em que as falhas de logon acontecem e veja quem agiu logo depois.</p>`;
}

function siemPlaygroundHtml(lab, lote, prog) {
  const marcados = new Set(prog.itensConcluidos || []);
  const total = (lab.checklist || []).length;
  const feitos = marcados.size;
  const hosts = valoresUnicosSiem(lote.eventos || [], "host");
  const users = valoresUnicosSiem(lote.eventos || [], "user");

  const itensHtml = (lab.checklist || [])
    .map(
      (c, i) => `
      <label class="cyber-lab-check">
        <input type="checkbox" data-cyber-lab-item="${i}" ${marcados.has(i) ? "checked" : ""} />
        <span>${escapeHtml(c)}</span>
      </label>`
    )
    .join("");

  return `
    <div class="task-card cyber-painel-trilha" data-cyber-lab-painel="${lab.id}">
      <div class="cyber-secao-header">
        <h3>${escapeHtml(lab.nome)} ${prog.concluido ? '<span class="cyber-lab-ok">✓ concluído</span>' : ""}</h3>
        <button class="btn-secondary" data-cyber-fechar-trilha style="width:auto; margin-top:0; padding:6px 12px; font-size:12px;">Fechar</button>
      </div>
      <p style="font-size:13px; color:var(--ink-soft);">${escapeHtml(lab.descricao || "")}</p>
      <p class="cyber-lab-ambiente">🔒 Lote de logs 100% fictício (${escapeHtml(lote.nome || "")}) — não conecta a nenhum SIEM real.</p>

      <p class="cyber-tool-label" style="margin-top:14px;">Filtros</p>
      <div class="cyber-siem-filtros">
        <select class="cyber-tool-input cyber-siem-filtro" id="cyber-siem-host">${optsDeLista(hosts, "Todos os hosts")}</select>
        <select class="cyber-tool-input cyber-siem-filtro" id="cyber-siem-user">${optsDeLista(users, "Todos os usuários")}</select>
        <select class="cyber-tool-input cyber-siem-filtro" id="cyber-siem-action">${optsDeMapa(SIEM_ACTION_LABEL, "Todas as ações")}</select>
        <select class="cyber-tool-input cyber-siem-filtro" id="cyber-siem-result">${optsDeMapa(SIEM_RESULT_LABEL, "Todos os resultados")}</select>
        <input class="cyber-tool-input cyber-siem-filtro" id="cyber-siem-texto" placeholder="Busca livre (host, usuário, origem, detalhe)" />
        <input class="cyber-tool-input cyber-siem-filtro" id="cyber-siem-de" type="time" title="A partir de" />
        <input class="cyber-tool-input cyber-siem-filtro" id="cyber-siem-ate" type="time" title="Até" />
        <select class="cyber-tool-input cyber-siem-filtro" id="cyber-siem-agrupar">
          <option value="">Não agrupar</option>
          <option value="host">Agrupar por host</option>
          <option value="user">Agrupar por usuário</option>
        </select>
      </div>
      <div class="cyber-tool-acoes">
        <button class="btn-secondary" data-cyber-siem-limpar="${lab.id}" style="margin-top:0;">Limpar filtros</button>
        <span id="cyber-siem-contagem" style="font-size:11px; color:var(--ink-soft); align-self:center;"></span>
      </div>
      <div id="cyber-siem-tabela-wrap"></div>
      <div id="cyber-siem-grupo-wrap"></div>

      <p class="cyber-tool-label" style="margin-top:16px;">O que você encontrou?</p>
      <div class="cyber-siem-resposta">
        <input class="cyber-tool-input" id="cyber-siem-resp-host" placeholder="Host suspeito" />
        <input class="cyber-tool-input" id="cyber-siem-resp-user" placeholder="Usuário/conta envolvida" />
        <button class="btn-secondary" data-cyber-siem-verificar="${lab.id}" style="margin-top:0;">Verificar achado</button>
      </div>
      <div id="cyber-siem-feedback" class="cyber-soc-feedback hidden"></div>

      <strong style="display:block; margin:16px 0 8px; font-size:13px;">Checklist do laboratório</strong>
      <div class="cyber-lab-checklist">${itensHtml}</div>

      <div class="cyber-lab-progresso">
        <div class="track"><div class="fill" id="cyber-lab-fill" style="width:${total ? Math.round((feitos / total) * 100) : 0}%; background:var(--sage);"></div></div>
        <span id="cyber-lab-progresso-texto">${feitos} de ${total} passos</span>
      </div>

      <label style="display:block; margin-top:16px; font-size:13px; font-weight:600;">Sua conclusão</label>
      <p style="font-size:11px; color:var(--ink-soft); margin:2px 0 6px;">O que você encontrou, como classificou e o que faltaria confirmar (mín. 10 caracteres).</p>
      <textarea id="cyber-lab-conclusao" class="cyber-lab-conclusao" rows="4" placeholder="Escreva sua conclusão do laboratório…">${escapeHtml(prog.conclusao || "")}</textarea>

      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:12px;">
        <button class="btn-secondary" data-cyber-lab-salvar="${lab.id}" style="width:auto; margin-top:0;">Salvar progresso</button>
        <button class="btn-primary" data-cyber-lab-concluir="${lab.id}" style="width:auto; margin-top:0;" disabled>Marcar lab como concluído</button>
      </div>
      <p id="cyber-lab-status" style="font-size:12px; color:var(--ink-soft); margin-top:8px;"></p>
    </div>`;
}

// ---------- LABORATÓRIO INTERATIVO ----------

let labAbertoId = null;
let salvarLabTimer = null;

function fecharPainel() {
  trilhaAbertaId = null;
  labAbertoId = null;
  socAbertoId = null;
  painelFase3 = null;
  const slot = document.getElementById("cyber-slot-painel");
  if (slot) slot.innerHTML = "";
}

function itensMarcadosNoDom(labId) {
  return Array.from(document.querySelectorAll(`[data-cyber-lab-painel="${labId}"] [data-cyber-lab-item]:checked`)).map((c) =>
    Number(c.dataset.cyberLabItem)
  );
}

function estadoLabCompleto(labId, lab) {
  const total = (lab?.checklist || []).length;
  const marcados = itensMarcadosNoDom(labId).length;
  const conclusao = document.getElementById("cyber-lab-conclusao")?.value?.trim() || "";
  return total > 0 && marcados === total && conclusao.length >= 10;
}

function atualizarBotaoConcluirLab(labId) {
  if (!labId) return;
  const lab = conteudoCache.labs.find((l) => l.id === labId);
  const btn = document.querySelector(`[data-cyber-lab-concluir="${labId}"]`);
  const barra = document.getElementById("cyber-lab-fill");
  const texto = document.getElementById("cyber-lab-progresso-texto");
  const total = (lab?.checklist || []).length;
  const feitos = itensMarcadosNoDom(labId).length;
  if (barra) barra.style.width = total ? `${Math.round((feitos / total) * 100)}%` : "0%";
  if (texto) texto.textContent = `${feitos} de ${total} passos`;
  if (btn) btn.disabled = !estadoLabCompleto(labId, lab);
}

async function persistirEstadoLab(labId) {
  const conclusao = document.getElementById("cyber-lab-conclusao")?.value?.trim() || "";
  await salvarProgressoLab(uidAtual, labId, { itensConcluidos: itensMarcadosNoDom(labId), conclusao });
}

function agendarSalvarLab(labId) {
  if (!labId) return;
  clearTimeout(salvarLabTimer);
  salvarLabTimer = setTimeout(async () => {
    const st = document.getElementById("cyber-lab-status");
    try {
      await persistirEstadoLab(labId);
      if (st) st.textContent = "Progresso salvo automaticamente.";
    } catch (e) {
      console.warn("[cyber] Falha ao salvar progresso automaticamente:", e);
      if (st) st.textContent = "Não consegui salvar agora — verifique sua conexão.";
    }
  }, 1200);
}

async function abrirLabPainel(labId) {
  const lab = conteudoCache.labs.find((l) => l.id === labId);
  const slot = document.getElementById("cyber-slot-painel");
  if (!lab || !slot) return;
  trilhaAbertaId = null;
  labAbertoId = labId;

  const prog = (await carregarProgresso(uidAtual)).labs[labId] || {};

  if (labId === SIEM_LAB_ID && conteudoCache.siem) {
    slot.innerHTML = siemPlaygroundHtml(lab, conteudoCache.siem, prog);
    renderizarResultadosSiem(labId);
    atualizarBotaoConcluirLab(labId);
    slot.querySelector(".cyber-painel-trilha")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  const marcados = new Set(prog.itensConcluidos || []);
  const total = (lab.checklist || []).length;
  const feitos = marcados.size;

  const itensHtml = (lab.checklist || [])
    .map(
      (c, i) => `
      <label class="cyber-lab-check">
        <input type="checkbox" data-cyber-lab-item="${i}" ${marcados.has(i) ? "checked" : ""} />
        <span>${escapeHtml(c)}</span>
      </label>`
    )
    .join("");

  slot.innerHTML = `
    <div class="task-card cyber-painel-trilha" data-cyber-lab-painel="${labId}">
      <div class="cyber-secao-header">
        <h3>${escapeHtml(lab.nome)} ${prog.concluido ? '<span class="cyber-lab-ok">✓ concluído</span>' : ""}</h3>
        <button class="btn-secondary" data-cyber-fechar-trilha style="width:auto; margin-top:0; padding:6px 12px; font-size:12px;">Fechar</button>
      </div>
      <p style="font-size:13px; color:var(--ink-soft);">${escapeHtml(lab.descricao || "")}</p>
      <p style="font-size:12px; color:var(--ink-soft); margin:8px 0;">
        Dificuldade: <strong>${DIFICULDADE_LABEL[lab.dificuldade] || lab.dificuldade}</strong> ·
        ~${lab.tempoMin || "?"} min ·
        Ferramenta: ${escapeHtml(lab.ferramenta || "—")}
      </p>
      <p class="cyber-lab-ambiente">🔒 ${escapeHtml(lab.ambiente || "Execute somente em ambiente de laboratório próprio/autorizado e isolado.")}</p>

      <div class="cyber-lab-progresso">
        <div class="track"><div class="fill" id="cyber-lab-fill" style="width:${total ? Math.round((feitos / total) * 100) : 0}%; background:var(--sage);"></div></div>
        <span id="cyber-lab-progresso-texto">${feitos} de ${total} passos</span>
      </div>

      <strong style="display:block; margin:14px 0 8px; font-size:13px;">Passos do laboratório</strong>
      <div class="cyber-lab-checklist">${itensHtml}</div>

      <label style="display:block; margin-top:16px; font-size:13px; font-weight:600;">Sua conclusão</label>
      <p style="font-size:11px; color:var(--ink-soft); margin:2px 0 6px;">O que você encontrou, como classificou e o que faltaria confirmar (mín. 10 caracteres).</p>
      <textarea id="cyber-lab-conclusao" class="cyber-lab-conclusao" rows="4" placeholder="Escreva sua conclusão do laboratório…">${escapeHtml(prog.conclusao || "")}</textarea>

      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:12px;">
        <button class="btn-secondary" data-cyber-lab-salvar="${labId}" style="width:auto; margin-top:0;">Salvar progresso</button>
        <button class="btn-primary" data-cyber-lab-concluir="${labId}" style="width:auto; margin-top:0;" disabled>Marcar lab como concluído</button>
      </div>
      <p id="cyber-lab-status" style="font-size:12px; color:var(--ink-soft); margin-top:8px;"></p>
    </div>`;

  atualizarBotaoConcluirLab(labId);
  slot.querySelector(".cyber-painel-trilha")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------- ENTRADA ----------
export async function initCyber(uid) {
  uidAtual = uid;
  ligarEventos();
  await render();
}
