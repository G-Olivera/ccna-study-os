// timer.js
// Cronômetro simples (não é contagem regressiva — sem pressão de prazo).
// Controla o tempo em memória e salva incrementos no activityLog conforme
// o usuário pausa, pra alimentar streak, horas estudadas e o dashboard.

import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { logActivity } from "./data-schema.js";

let inicioMs = null; // timestamp de quando o cronômetro começou a rodar (null = parado/pausado)
let acumuladoSeg = 0; // segundos já contabilizados nesta sessão (antes da pausa atual)
let segundosNaoSalvos = 0; // segundos já decorridos mas ainda não persistidos no Firestore

export function iniciarCronometro() {
  if (inicioMs !== null) return; // já rodando
  inicioMs = Date.now();
}

export function pausarCronometro() {
  if (inicioMs === null) return { pausado: true, segundosTotais: acumuladoSeg };
  const decorrido = Math.floor((Date.now() - inicioMs) / 1000);
  acumuladoSeg += decorrido;
  segundosNaoSalvos += decorrido;
  inicioMs = null;
  return { pausado: true, segundosTotais: acumuladoSeg };
}

export function reiniciarCronometro() {
  inicioMs = null;
  acumuladoSeg = 0;
  segundosNaoSalvos = 0;
}

export function segundosAtuais() {
  if (inicioMs === null) return acumuladoSeg;
  return acumuladoSeg + Math.floor((Date.now() - inicioMs) / 1000);
}

export function estaRodando() {
  return inicioMs !== null;
}

export function formatarTempo(segundosTotais) {
  const h = Math.floor(segundosTotais / 3600);
  const m = Math.floor((segundosTotais % 3600) / 60);
  const s = segundosTotais % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/**
 * Persiste os segundos acumulados desde o último save (chamar ao pausar
 * ou periodicamente enquanto roda, pra não perder tempo se a aba fechar).
 */
export async function salvarProgressoCronometro(uid, topicId = null) {
  if (segundosNaoSalvos < 30) return; // evita gravar incrementos irrelevantes (< 30s)
  const minutos = Math.round((segundosNaoSalvos / 60) * 10) / 10;
  await logActivity(uid, "estudo_livre", topicId, minutos);
  segundosNaoSalvos = 0;
}

/** Soma o tempo já estudado hoje (todas as categorias de atividade). */
export async function buscarMinutosHoje(uid) {
  const inicioDoDia = new Date();
  inicioDoDia.setHours(0, 0, 0, 0);

  const q = query(collection(db, "users", uid, "activityLog"), where("timestamp", ">=", inicioDoDia));
  const snap = await getDocs(q);
  const minutos = snap.docs.reduce((acc, d) => acc + (d.data().duracao || 0), 0);
  return Math.round(minutos * 10) / 10;
}
