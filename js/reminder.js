// reminder.js
// Lembrete diário usando a Notification API do navegador.
//
// LIMITAÇÃO IMPORTANTE (sem enrolação): como o app é um site estático, sem
// servidor próprio de push, o lembrete só dispara enquanto o app/aba estiver
// aberto (pode estar minimizado ou em outra aba, mas o navegador precisa
// estar rodando). Não é como notificação de app de loja, que acorda o
// celular mesmo com tudo fechado — isso exigiria infraestrutura paga de
// push que não faz parte do plano gratuito deste projeto.

const REMINDER_KEY = "ccna-study-os-lembrete-horario";
const REMINDER_ENABLED_KEY = "ccna-study-os-lembrete-ativo";

let intervaloVerificacao = null;
let ultimoDisparo = null; // evita disparar 2x no mesmo minuto/dia

export function getPermissaoAtual() {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission; // "granted" | "denied" | "default"
}

export async function pedirPermissao() {
  if (!("Notification" in window)) return "unsupported";
  return await Notification.requestPermission();
}

export function salvarHorarioLembrete(horario) {
  localStorage.setItem(REMINDER_KEY, horario); // formato "HH:MM"
}

export function getHorarioLembrete() {
  return localStorage.getItem(REMINDER_KEY) || "19:00";
}

export function setLembreteAtivo(ativo) {
  localStorage.setItem(REMINDER_ENABLED_KEY, ativo ? "1" : "0");
}

export function isLembreteAtivo() {
  return localStorage.getItem(REMINDER_ENABLED_KEY) === "1";
}

async function dispararNotificacao() {
  const titulo = "Hora de estudar CCNA 🎯";
  const opcoes = {
    body: "Seu momento de estudo de hoje está te esperando. Uma tarefa por vez.",
    icon: "icon-192.png",
    badge: "icon-192.png",
    tag: "ccna-lembrete-diario", // evita empilhar notificações duplicadas
  };

  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(titulo, opcoes);
    } else {
      new Notification(titulo, opcoes);
    }
  } catch (e) {
    console.warn("[Lembrete] Não foi possível mostrar a notificação:", e);
  }
}

/**
 * Inicia a verificação em segundo plano (a cada minuto) enquanto o app
 * estiver aberto. Chame uma vez após o login.
 */
export function iniciarVerificacaoLembrete() {
  if (intervaloVerificacao) clearInterval(intervaloVerificacao);

  intervaloVerificacao = setInterval(() => {
    if (!isLembreteAtivo() || getPermissaoAtual() !== "granted") return;

    const agora = new Date();
    const horaAtual = `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`;
    const chaveDeHoje = `${agora.toISOString().slice(0, 10)}-${horaAtual}`;

    if (horaAtual === getHorarioLembrete() && ultimoDisparo !== chaveDeHoje) {
      ultimoDisparo = chaveDeHoje;
      dispararNotificacao();
    }
  }, 30000); // confere a cada 30s (margem de segurança pro minuto exato)
}

export function pararVerificacaoLembrete() {
  if (intervaloVerificacao) clearInterval(intervaloVerificacao);
  intervaloVerificacao = null;
}
