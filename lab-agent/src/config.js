// config.js — tudo que o agente lê do ambiente (/etc/lab-agent.env via systemd).

const lista = (v, padrao = "") => (v ?? padrao).split(",").map((s) => s.trim()).filter(Boolean);

export const config = {
  porta: Number(process.env.PORT || 8787),
  host: process.env.HOST || "127.0.0.1", // só o Caddy (local) fala com o agente

  // Firebase: o agente só aceita ID tokens deste projeto e destes UIDs.
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || "ccna-study-os",
  uidsPermitidos: lista(process.env.ALLOWED_UIDS),
  exigirMfa: (process.env.REQUIRE_MFA ?? "true") === "true",

  origensPermitidas: lista(process.env.ALLOWED_ORIGINS, "https://g-olivera.github.io"),

  dirLabs: process.env.LABS_DIR || "/var/lib/lab-agent/labs",
  maxLabs: Number(process.env.MAX_LABS || 3),
  maxNos: Number(process.env.MAX_NODES || 16),

  imagens: {
    frr: process.env.IMAGE_FRR || "quay.io/frrouting/frr:10.2.1",
    host: process.env.IMAGE_HOST || "ghcr.io/hellt/network-multitool:latest",
  },
};

if (config.uidsPermitidos.length === 0) {
  console.error("[config] ALLOWED_UIDS vazio — nenhum usuário conseguirá usar o agente.");
}
