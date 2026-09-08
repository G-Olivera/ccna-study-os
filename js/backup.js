// backup.js
// Exporta e importa todos os dados pessoais do usuário (Firestore) num único
// arquivo JSON. Serve como cópia de segurança e pra migrar de conta/aparelho.
// Não inclui os PDFs de livros locais (ficam só no IndexedDB do navegador e são
// grandes demais); inclui o progresso de leitura, que fica no Firestore.

import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  writeBatch,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

// Subcoleções de users/{uid} que entram no backup.
const COLECOES = [
  "transacoes",
  "gastosFixos",
  "categoriasFinanceiras",
  "cartoes",
  "metasGasto",
  "metasGastoGrupo",
  "metasGastoCategoria",
  "tarefas",
  "topics",
  "questionAttempts",
  "simulados",
  "dailyPlans",
  "labProgress",
  "activityLog",
  "topologias",
  "srsCards",
  "conquistas",
  "leituras",
];

// Timestamp do Firestore -> string ISO (pra caber no JSON de forma legível).
function serializar(valor) {
  if (valor == null) return valor;
  if (typeof valor?.toDate === "function") return valor.toDate().toISOString();
  if (Array.isArray(valor)) return valor.map(serializar);
  if (typeof valor === "object") {
    const out = {};
    for (const [k, v] of Object.entries(valor)) out[k] = serializar(v);
    return out;
  }
  return valor;
}

export async function exportarTudo(uid) {
  const dados = {
    formato: "ccna-study-os-backup",
    versao: 1,
    exportadoEm: new Date().toISOString(),
    perfil: null,
    preferencias: null,
    colecoes: {},
  };

  const [perfilSnap, prefSnap] = await Promise.all([
    getDoc(doc(db, "users", uid)),
    getDoc(doc(db, "users", uid, "config", "preferencias")),
  ]);
  dados.perfil = perfilSnap.exists() ? serializar(perfilSnap.data()) : null;
  dados.preferencias = prefSnap.exists() ? serializar(prefSnap.data()) : null;

  await Promise.all(
    COLECOES.map(async (c) => {
      const snap = await getDocs(collection(db, "users", uid, c));
      dados.colecoes[c] = snap.docs.map((d) => ({ id: d.id, ...serializar(d.data()) }));
    })
  );

  return dados;
}

export function contarItens(dados) {
  return Object.values(dados?.colecoes || {}).reduce((soma, arr) => soma + (arr?.length || 0), 0);
}

/**
 * Regrava os documentos do backup no Firestore (merge — não apaga o que já existe
 * e não está no arquivo). `colecoes` opcional restringe o que importar.
 */
export async function importarTudo(uid, dados, { colecoes } = {}) {
  if (dados?.formato !== "ccna-study-os-backup") {
    throw new Error("Arquivo não parece ser um backup do CCNA Study OS.");
  }

  const alvo = colecoes || Object.keys(dados.colecoes || {});
  let gravados = 0;

  for (const c of alvo) {
    const itens = dados.colecoes?.[c] || [];
    for (let i = 0; i < itens.length; i += 400) {
      const lote = itens.slice(i, i + 400);
      const batch = writeBatch(db);
      for (const item of lote) {
        if (!item?.id) continue;
        const { id, ...resto } = item;
        batch.set(doc(db, "users", uid, c, id), resto, { merge: true });
      }
      await batch.commit();
      gravados += lote.length;
    }
  }

  if (dados.preferencias) {
    await setDoc(
      doc(db, "users", uid, "config", "preferencias"),
      { ...dados.preferencias, atualizadoEm: serverTimestamp() },
      { merge: true }
    );
  }

  return gravados;
}
