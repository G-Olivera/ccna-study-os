// planner.js
// "Plan your study schedule": você informa quanto tempo tem por semana e a data da prova,
// o sistema calcula o ritmo necessário e avisa se está dentro do esperado.

import { getAllTopics, getAllUserTopicProgress, saveUserProfile, getUserProfile } from "./data-schema.js";

const TEMPO_MEDIO_POR_LICAO_MIN = 42; // baseado em ~142 lições ≈ 100h de estudo total

export async function definirCronograma(uid, dataProva, horasPorSemana) {
  await saveUserProfile(uid, { dataProva, horasPorSemana, definidoEm: new Date().toISOString() });
  return calcularRitmo(uid);
}

export async function calcularRitmo(uid) {
  const perfil = await getUserProfile(uid);
  if (!perfil?.dataProva || !perfil?.horasPorSemana) return null;

  const [allTopics, progresso] = await Promise.all([getAllTopics(), getAllUserTopicProgress(uid)]);
  const progressoMap = new Map(progresso.map((p) => [p.id, p]));

  const licoesConcluidas = allTopics.filter((t) => (progressoMap.get(t.id)?.masteryPercent ?? 0) >= 80).length;
  const licoesRestantes = allTopics.length - licoesConcluidas;
  const horasRestantesEstimadas = (licoesRestantes * TEMPO_MEDIO_POR_LICAO_MIN) / 60;

  const hoje = new Date();
  const dataProva = new Date(perfil.dataProva);
  const semanasAteProva = Math.max(0.5, (dataProva - hoje) / (1000 * 60 * 60 * 24 * 7));

  const horasNecessariasPorSemana = Math.round((horasRestantesEstimadas / semanasAteProva) * 10) / 10;
  const minutosNecessariosPorDia = Math.round((horasNecessariasPorSemana * 60) / 7);

  let status;
  if (horasNecessariasPorSemana <= perfil.horasPorSemana * 0.9) status = "folga";
  else if (horasNecessariasPorSemana <= perfil.horasPorSemana * 1.1) status = "no_ritmo";
  else status = "precisa_ajustar";

  return {
    dataProva: perfil.dataProva,
    horasPorSemanaDisponiveis: perfil.horasPorSemana,
    licoesConcluidas,
    totalLicoes: allTopics.length,
    horasRestantesEstimadas: Math.round(horasRestantesEstimadas * 10) / 10,
    semanasAteProva: Math.round(semanasAteProva * 10) / 10,
    horasNecessariasPorSemana,
    minutosNecessariosPorDia,
    status, // "folga" | "no_ritmo" | "precisa_ajustar"
  };
}
