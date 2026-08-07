// labs.js
// Busca laboratórios e controla o progresso do checklist do usuário
// (comandos, topologias, erros comuns já vêm no doc do lab — ver seed-labs.js).

import { collection, doc, getDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { upsertLabProgress } from "./data-schema.js";

export async function getLabById(labId) {
  const snap = await getDoc(doc(db, "content", "labs", "items", labId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getLabsByTopic(topicId) {
  const q = query(collection(db, "content", "labs", "items"), where("topicId", "==", topicId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getUserLabProgress(uid, labId) {
  const snap = await getDoc(doc(db, "users", uid, "labProgress", labId));
  return snap.exists() ? snap.data() : { stepsCompletos: [], status: "nao_iniciado" };
}

/** Marca um passo específico do checklist como concluído. */
export async function marcarPassoConcluido(uid, labId, stepIndex, totalSteps) {
  const atual = await getUserLabProgress(uid, labId);
  const stepsCompletos = new Set(atual.stepsCompletos || []);
  stepsCompletos.add(stepIndex);

  const status = stepsCompletos.size >= totalSteps ? "concluido" : "em_andamento";

  await upsertLabProgress(uid, labId, {
    stepsCompletos: Array.from(stepsCompletos),
    status,
    ultimaAtualizacao: new Date().toISOString(),
  });

  return { stepsCompletos: Array.from(stepsCompletos), status };
}

/** Registra um erro cometido durante o lab (alimenta o banco de erros / dashboard). */
export async function registrarErroNoLab(uid, labId, descricaoErro) {
  const atual = await getUserLabProgress(uid, labId);
  const erros = [...(atual.errosRegistrados || []), { descricaoErro, data: new Date().toISOString() }];
  await upsertLabProgress(uid, labId, { errosRegistrados: erros });
  return erros;
}
