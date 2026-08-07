// gamification.js
// Conquistas, missões e metas semanais/mensais.
// XP e nível já são calculados em dashboard.js — este módulo cuida do resto.

import { doc, getDoc, setDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

// Catálogo de conquistas — cada uma tem uma condição avaliada contra os dados do dashboard.
export const CONQUISTAS = [
  { id: "primeiro_dia", nome: "Primeiro Passo", desc: "Complete seu primeiro dia de estudo.", condicao: (d) => d.streakDias >= 1 },
  { id: "streak_7", nome: "Semana Consistente", desc: "7 dias seguidos estudando.", condicao: (d) => d.streakDias >= 7 },
  { id: "streak_30", nome: "Hábito Formado", desc: "30 dias seguidos estudando.", condicao: (d) => d.streakDias >= 30 },
  { id: "primeiro_dominado", nome: "Primeiro Domínio", desc: "Domine seu primeiro tópico (mastery ≥ 80%).", condicao: (d) => d.assuntosDominados.length >= 1 },
  { id: "dez_dominados", nome: "Base Sólida", desc: "10 tópicos dominados.", condicao: (d) => d.assuntosDominados.length >= 10 },
  { id: "sem_criticos", nome: "Zero Crítico", desc: "Nenhum assunto crítico no momento.", condicao: (d) => d.assuntosCriticos.length === 0 && d.totalQuestoesRespondidas > 0 },
  { id: "cem_questoes", nome: "Maratonista", desc: "Responda 100 questões.", condicao: (d) => d.totalQuestoesRespondidas >= 100 },
  { id: "prontidao_70", nome: "Quase Lá", desc: "Prontidão para o exame ≥ 70%.", condicao: (d) => d.prontidaoExame >= 70 },
  { id: "prontidao_90", nome: "Pronto pra Prova", desc: "Prontidão para o exame ≥ 90%.", condicao: (d) => d.prontidaoExame >= 90 },
];

/**
 * Compara os dados atuais do dashboard contra o catálogo de conquistas
 * e desbloqueia (salva) as que ainda não tinham sido registradas.
 */
export async function verificarConquistas(uid, dashboardData) {
  const conquistasRef = collection(db, "users", uid, "conquistas");
  const snap = await getDocs(conquistasRef);
  const jaDesbloqueadas = new Set(snap.docs.map((d) => d.id));

  const novasDesbloqueadas = [];

  for (const conquista of CONQUISTAS) {
    if (!jaDesbloqueadas.has(conquista.id) && conquista.condicao(dashboardData)) {
      await setDoc(doc(db, "users", uid, "conquistas", conquista.id), {
        nome: conquista.nome,
        desc: conquista.desc,
        desbloqueadaEm: new Date().toISOString(),
      });
      novasDesbloqueadas.push(conquista);
    }
  }

  return novasDesbloqueadas; // use isso pra mostrar um toast/celebração na UI
}

// ---------- METAS SEMANAIS / MENSAIS ----------

function inicioDaSemana() {
  const d = new Date();
  const dia = d.getDay(); // 0 = domingo
  d.setDate(d.getDate() - dia);
  return d.toISOString().slice(0, 10);
}

function inicioDoMes() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * Define (ou mantém) a meta da semana/mês atual.
 * Ex: metaSemana = { minutosAlvo: 300, topicosAlvo: 3 }
 */
export async function definirMeta(uid, periodo, metaConfig) {
  const chave = periodo === "semanal" ? inicioDaSemana() : inicioDoMes();
  const ref = doc(db, "users", uid, periodo === "semanal" ? "metasSemanais" : "metasMensais", chave);
  await setDoc(ref, { ...metaConfig, criadaEm: new Date().toISOString() }, { merge: true });
  return chave;
}

/**
 * Verifica o progresso da meta atual comparando com horas estudadas / tópicos concluídos.
 */
export async function progressoMeta(uid, periodo, dashboardData) {
  const chave = periodo === "semanal" ? inicioDaSemana() : inicioDoMes();
  const ref = doc(db, "users", uid, periodo === "semanal" ? "metasSemanais" : "metasMensais", chave);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  const meta = snap.data();
  return {
    ...meta,
    minutosAtuais: Math.round(dashboardData.horasEstudadas * 60),
    percentualConcluido: meta.minutosAlvo
      ? Math.min(100, Math.round(((dashboardData.horasEstudadas * 60) / meta.minutosAlvo) * 100))
      : null,
  };
}
