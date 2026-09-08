// seed-cyber.js
// Popula o conteúdo global do módulo Cybersecurity:
//   content/cyberTracks/items   — as 12 trilhas
//   content/cyberLessons/items  — lições de cada trilha (teoria / lab / quiz)
//   content/cyberLabs/items     — laboratórios práticos (checklist educacional)
//
// Mesmo padrão dos outros seeds: só grava se ainda não populado (flag em
// content/meta) e exige que as regras liberem escrita em content/** pro UID admin.
// Nada aqui inventa progresso — são só definições de conteúdo. O progresso do
// usuário vive em users/{uid}/cyberProgress e users/{uid}/cyberLabProgress.

import { doc, getDoc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

// ---------- TRILHAS ----------
// cor: hex usado só no card da trilha (validado no cliente antes de ir pro style).
const tracks = [
  { id: "fundamentos", ordem: 1, nome: "Fundamentos de Cybersecurity", icone: "🛡️", cor: "#3E6B6B", descricao: "CIA, ameaças, vetores de ataque, defesa em profundidade e postura de segurança." },
  { id: "redes-protocolos", ordem: 2, nome: "Redes e Protocolos", icone: "🌐", cor: "#4f9cf9", descricao: "TCP/IP sob a ótica de segurança: portas, handshakes, DNS, ARP e o que cada um revela." },
  { id: "linux-seg", ordem: 3, nome: "Linux para Segurança", icone: "🐧", cor: "#5B8266", descricao: "Permissões, usuários, serviços, logs e hardening de servidores Linux." },
  { id: "windows-seg", ordem: 4, nome: "Windows para Segurança", icone: "🪟", cor: "#4f9cf9", descricao: "Event Logs, contas, GPO, serviços e artefatos de investigação no Windows." },
  { id: "seg-redes", ordem: 5, nome: "Segurança de Redes", icone: "🔥", cor: "#C97B4A", descricao: "Firewall, ACL, VPN, segurança de camada 2 e segmentação." },
  { id: "soc-blueteam", ordem: 6, nome: "SOC / Blue Team", icone: "🖥️", cor: "#9b63f8", descricao: "Triagem de alertas, timeline, correlação de eventos e resposta defensiva." },
  { id: "web-security", ordem: 7, nome: "Web Security", icone: "🕸️", cor: "#e93d86", descricao: "OWASP Top 10, autenticação, sessões e cabeçalhos HTTP de segurança." },
  { id: "cloud-security", ordem: 8, nome: "Cloud Security", icone: "☁️", cor: "#4f9cf9", descricao: "Modelo de responsibilidade compartilhada, IAM, exposição de buckets e logging na nuvem." },
  { id: "resposta-incidentes", ordem: 9, nome: "Resposta a Incidentes", icone: "🚨", cor: "#ef5562", descricao: "Ciclo de IR (NIST), contenção, erradicação, recuperação e lições aprendidas." },
  { id: "criptografia", ordem: 10, nome: "Criptografia", icone: "🔐", cor: "#5B8266", descricao: "Simétrica, assimétrica, hashing, certificados e TLS na prática." },
  { id: "pentest-basico", ordem: 11, nome: "Pentest Básico (educacional)", icone: "🧪", cor: "#f1b94b", descricao: "Metodologia e reconhecimento — SOMENTE em ambientes próprios/autorizados e isolados." },
  { id: "governanca", ordem: 12, nome: "Governança e Compliance", icone: "📄", cor: "#92a6b0", descricao: "Políticas, frameworks (ISO 27001, NIST CSF), LGPD e gestão de risco." },
];

// ---------- LIÇÕES ----------
// tipo: "teoria" | "lab" | "quiz". ccnaTopicId liga a uma lição da trilha CCNA
// quando o assunto é o mesmo (evita duplicar conteúdo). labId aponta pra um
// laboratório em content/cyberLabs.
const lessons = [
  // Fundamentos
  { id: "cy-fund-01", trackId: "fundamentos", ordem: 1, nome: "A tríade CIA: confidencialidade, integridade, disponibilidade", tipo: "teoria" },
  { id: "cy-fund-02", trackId: "fundamentos", ordem: 2, nome: "Ameaça, vulnerabilidade e risco — as diferenças", tipo: "teoria" },
  { id: "cy-fund-03", trackId: "fundamentos", ordem: 3, nome: "Vetores de ataque comuns e engenharia social", tipo: "teoria" },
  { id: "cy-fund-04", trackId: "fundamentos", ordem: 4, nome: "Defesa em profundidade e o modelo de camadas", tipo: "teoria" },
  { id: "cy-fund-05", trackId: "fundamentos", ordem: 5, nome: "AAA: autenticação, autorização e accounting", tipo: "teoria", ccnaTopicId: "m38-02" },
  { id: "cy-fund-06", trackId: "fundamentos", ordem: 6, nome: "Modelos Zero Trust e menor privilégio", tipo: "teoria" },
  { id: "cy-fund-07", trackId: "fundamentos", ordem: 7, nome: "Kill chain e MITRE ATT&CK (visão geral)", tipo: "teoria" },
  { id: "cy-fund-08", trackId: "fundamentos", ordem: 8, nome: "Quiz — Fundamentos de Cybersecurity", tipo: "quiz" },

  // Redes e Protocolos
  { id: "cy-net-01", trackId: "redes-protocolos", ordem: 1, nome: "Portas, sockets e o handshake TCP visto pelo defensor", tipo: "teoria", ccnaTopicId: "m34-01" },
  { id: "cy-net-02", trackId: "redes-protocolos", ordem: 2, nome: "DNS: resolução, exfiltração e tunneling", tipo: "teoria", ccnaTopicId: "m03-04" },
  { id: "cy-net-03", trackId: "redes-protocolos", ordem: 3, nome: "ARP e ataques de camada 2 (spoofing, MITM)", tipo: "teoria", ccnaTopicId: "m09-01" },
  { id: "cy-net-04", trackId: "redes-protocolos", ordem: 4, nome: "Lab — Análise de tráfego com Wireshark", tipo: "lab", labId: "cylab-wireshark" },

  // Linux para Segurança
  { id: "cy-lin-01", trackId: "linux-seg", ordem: 1, nome: "Usuários, grupos e o modelo de permissões", tipo: "teoria" },
  { id: "cy-lin-02", trackId: "linux-seg", ordem: 2, nome: "Serviços, systemd e superfície de ataque", tipo: "teoria" },
  { id: "cy-lin-03", trackId: "linux-seg", ordem: 3, nome: "Logs do sistema: journald, /var/log e auditd", tipo: "teoria", ccnaTopicId: "m42-01" },
  { id: "cy-lin-04", trackId: "linux-seg", ordem: 4, nome: "Lab — Hardening de servidor Linux", tipo: "lab", labId: "cylab-hardening-linux" },

  // Windows para Segurança
  { id: "cy-win-01", trackId: "windows-seg", ordem: 1, nome: "Contas, SIDs e grupos privilegiados", tipo: "teoria" },
  { id: "cy-win-02", trackId: "windows-seg", ordem: 2, nome: "Windows Event Log: IDs que importam numa investigação", tipo: "teoria" },
  { id: "cy-win-03", trackId: "windows-seg", ordem: 3, nome: "Persistência e artefatos comuns no Windows", tipo: "teoria" },
  { id: "cy-win-04", trackId: "windows-seg", ordem: 4, nome: "Lab — Investigação de logs Windows", tipo: "lab", labId: "cylab-logs-windows" },

  // Segurança de Redes
  { id: "cy-sr-01", trackId: "seg-redes", ordem: 1, nome: "Firewall stateful vs stateless e políticas", tipo: "teoria" },
  { id: "cy-sr-02", trackId: "seg-redes", ordem: 2, nome: "ACLs como controle de segurança", tipo: "teoria", ccnaTopicId: "m36-02" },
  { id: "cy-sr-03", trackId: "seg-redes", ordem: 3, nome: "VPNs: IPsec, TLS e quando usar cada uma", tipo: "teoria", ccnaTopicId: "m48-02" },
  { id: "cy-sr-04", trackId: "seg-redes", ordem: 4, nome: "Segurança de camada 2: Port Security e DHCP Snooping", tipo: "teoria", ccnaTopicId: "m40-01" },

  // SOC / Blue Team
  { id: "cy-soc-01", trackId: "soc-blueteam", ordem: 1, nome: "O que é um SOC e os papéis do time (N1, N2, N3)", tipo: "teoria" },
  { id: "cy-soc-02", trackId: "soc-blueteam", ordem: 2, nome: "Tipos de alertas e severidade", tipo: "teoria" },
  { id: "cy-soc-03", trackId: "soc-blueteam", ordem: 3, nome: "Timeline, correlação e a pergunta 'o que aconteceu antes?'", tipo: "teoria" },
  { id: "cy-soc-04", trackId: "soc-blueteam", ordem: 4, nome: "Classificando um alerta: verdadeiro positivo, falso positivo, investigar", tipo: "teoria" },
  { id: "cy-soc-05", trackId: "soc-blueteam", ordem: 5, nome: "Lab — Investigação de alerta SOC (do início ao fim)", tipo: "lab", labId: "cylab-alerta-soc" },

  // Web Security
  { id: "cy-web-01", trackId: "web-security", ordem: 1, nome: "OWASP Top 10: visão geral e como pensar em cada categoria", tipo: "teoria" },
  { id: "cy-web-02", trackId: "web-security", ordem: 2, nome: "Injeção (SQLi) e por que parametrizar consultas resolve", tipo: "teoria" },
  { id: "cy-web-03", trackId: "web-security", ordem: 3, nome: "XSS, CSRF e o papel dos cabeçalhos de segurança (CSP, etc.)", tipo: "teoria" },
  { id: "cy-web-04", trackId: "web-security", ordem: 4, nome: "Autenticação, sessões e armazenamento seguro de senhas", tipo: "teoria" },

  // Cloud Security
  { id: "cy-cloud-01", trackId: "cloud-security", ordem: 1, nome: "Modelo de responsabilidade compartilhada", tipo: "teoria" },
  { id: "cy-cloud-02", trackId: "cloud-security", ordem: 2, nome: "IAM na nuvem: papéis, políticas e menor privilégio", tipo: "teoria" },
  { id: "cy-cloud-03", trackId: "cloud-security", ordem: 3, nome: "Exposição acidental: buckets públicos e metadados", tipo: "teoria" },
  { id: "cy-cloud-04", trackId: "cloud-security", ordem: 4, nome: "Logging e trilhas de auditoria (CloudTrail e equivalentes)", tipo: "teoria" },

  // Resposta a Incidentes
  { id: "cy-ir-01", trackId: "resposta-incidentes", ordem: 1, nome: "O ciclo de resposta a incidentes (NIST 800-61)", tipo: "teoria" },
  { id: "cy-ir-02", trackId: "resposta-incidentes", ordem: 2, nome: "Contenção: curto prazo vs longo prazo", tipo: "teoria" },
  { id: "cy-ir-03", trackId: "resposta-incidentes", ordem: 3, nome: "Coleta de evidências e cadeia de custódia", tipo: "teoria" },
  { id: "cy-ir-04", trackId: "resposta-incidentes", ordem: 4, nome: "Post-mortem sem culpa e lições aprendidas", tipo: "teoria" },

  // Criptografia
  { id: "cy-crypto-01", trackId: "criptografia", ordem: 1, nome: "Simétrica vs assimétrica: para que serve cada uma", tipo: "teoria" },
  { id: "cy-crypto-02", trackId: "criptografia", ordem: 2, nome: "Funções de hash e onde NÃO usar hash", tipo: "teoria" },
  { id: "cy-crypto-03", trackId: "criptografia", ordem: 3, nome: "Certificados, cadeia de confiança e PKI", tipo: "teoria" },
  { id: "cy-crypto-04", trackId: "criptografia", ordem: 4, nome: "TLS: o handshake e o que ele garante", tipo: "teoria" },

  // Pentest Básico (educacional)
  { id: "cy-pt-01", trackId: "pentest-basico", ordem: 1, nome: "Ética, escopo e autorização — a regra número um", tipo: "teoria" },
  { id: "cy-pt-02", trackId: "pentest-basico", ordem: 2, nome: "Metodologia: recon, enumeração, exploração, pós-exploração", tipo: "teoria" },
  { id: "cy-pt-03", trackId: "pentest-basico", ordem: 3, nome: "Reconhecimento passivo vs ativo (em ambiente próprio)", tipo: "teoria" },
  { id: "cy-pt-04", trackId: "pentest-basico", ordem: 4, nome: "Relatório de pentest: o entregável que importa", tipo: "teoria" },

  // Governança e Compliance
  { id: "cy-gov-01", trackId: "governanca", ordem: 1, nome: "Política, norma, procedimento e diretriz", tipo: "teoria" },
  { id: "cy-gov-02", trackId: "governanca", ordem: 2, nome: "Frameworks: ISO 27001 e NIST CSF", tipo: "teoria" },
  { id: "cy-gov-03", trackId: "governanca", ordem: 3, nome: "LGPD: princípios e bases legais", tipo: "teoria" },
  { id: "cy-gov-04", trackId: "governanca", ordem: 4, nome: "Gestão de risco: identificar, avaliar, tratar, monitorar", tipo: "teoria" },
];

// ---------- LABORATÓRIOS ----------
const labs = [
  {
    id: "cylab-wireshark", trackId: "redes-protocolos", nome: "Análise de tráfego com Wireshark",
    descricao: "Abra uma captura de exemplo e localize indícios de atividade suspeita.",
    dificuldade: "intermediario", tempoMin: 40, ferramenta: "Wireshark",
    ambiente: "Captura .pcap de exemplo — nenhum tráfego real é capturado pelo app.",
    checklist: [
      "Aplicar um filtro de exibição por protocolo (ex.: dns, http, tcp.flags.syn==1)",
      "Seguir o fluxo TCP de uma conversa suspeita (Follow > TCP Stream)",
      "Identificar o host de origem e o de destino do evento",
      "Registrar a conclusão: o que a captura indica e o que faltaria confirmar",
    ],
  },
  {
    id: "cylab-logs-windows", trackId: "windows-seg", nome: "Investigação de logs Windows",
    descricao: "Percorra um conjunto de eventos e reconstrua o que aconteceu numa conta.",
    dificuldade: "intermediario", tempoMin: 35, ferramenta: "Event Viewer / logs de exemplo",
    ambiente: "Logs de exemplo fornecidos pelo lab — não lê o Windows do usuário.",
    checklist: [
      "Localizar as tentativas de logon falhas (Event ID 4625) e o horário",
      "Encontrar o logon bem-sucedido que veio depois (Event ID 4624) e o tipo de logon",
      "Verificar se houve criação de conta ou mudança de grupo (4720 / 4728 / 4732)",
      "Classificar: verdadeiro positivo, falso positivo ou necessita investigação",
    ],
  },
  {
    id: "cylab-hardening-linux", trackId: "linux-seg", nome: "Hardening de servidor Linux",
    descricao: "Aplique um checklist de boas práticas num servidor de laboratório.",
    dificuldade: "basico", tempoMin: 30, ferramenta: "Shell em VM de laboratório",
    ambiente: "Executar somente numa VM/servidor próprio de laboratório.",
    checklist: [
      "Desabilitar login de root por SSH e exigir chave (PermitRootLogin no / autenticação por chave)",
      "Revisar serviços em escuta (ss -tulpn) e desligar o que não é necessário",
      "Configurar um firewall de host (ufw/nftables) com política default deny",
      "Garantir que os logs de autenticação estão sendo gravados e rotacionados",
    ],
  },
  {
    id: "cylab-hardening-windows", trackId: "windows-seg", nome: "Hardening de Windows",
    descricao: "Reforce contas, serviços e políticas de auditoria numa máquina de laboratório.",
    dificuldade: "intermediario", tempoMin: 35, ferramenta: "Windows de laboratório",
    ambiente: "Executar somente numa máquina Windows própria de laboratório.",
    checklist: [
      "Renomear/desativar a conta Administrador local e revisar o grupo Administradores",
      "Ativar a política de auditoria para logon, gestão de contas e alterações de política",
      "Revisar tarefas agendadas e serviços com início automático",
      "Habilitar o firewall do Windows nos três perfis",
    ],
  },
  {
    id: "cylab-firewall", trackId: "seg-redes", nome: "Regras de firewall e ACL",
    descricao: "Escreva e valide uma política de filtragem para um cenário dado.",
    dificuldade: "basico", tempoMin: 25, ferramenta: "Simulador de ACL do CCNA Study OS",
    ambiente: "Simulador interno — nenhuma regra é aplicada a equipamento real.",
    checklist: [
      "Definir o objetivo da política (o que permitir, o que negar)",
      "Escrever as regras da mais específica para a mais genérica",
      "Confirmar a posição de aplicação (entrada vs saída, perto da origem vs destino)",
      "Testar casos que devem passar e casos que devem ser bloqueados",
    ],
  },
  {
    id: "cylab-dns", trackId: "redes-protocolos", nome: "Análise de DNS",
    descricao: "Investigue consultas de DNS de exemplo em busca de padrões anômalos.",
    dificuldade: "intermediario", tempoMin: 30, ferramenta: "Logs de DNS de exemplo",
    ambiente: "Conjunto de consultas de exemplo — não faz resolução real em massa.",
    checklist: [
      "Separar consultas legítimas de padrões suspeitos (subdomínios longos, alta frequência)",
      "Identificar possíveis indícios de tunneling ou exfiltração",
      "Correlacionar o host que originou as consultas com outros eventos",
      "Registrar a hipótese e o próximo passo de verificação",
    ],
  },
  {
    id: "cylab-auth", trackId: "windows-seg", nome: "Análise de autenticação",
    descricao: "Reconstrua uma sequência de eventos de autenticação e classifique o resultado.",
    dificuldade: "basico", tempoMin: 25, ferramenta: "Logs de autenticação de exemplo",
    ambiente: "Logs de exemplo do lab.",
    checklist: [
      "Contar tentativas falhas e o intervalo entre elas",
      "Verificar se o sucesso veio da mesma origem das falhas",
      "Checar o horário contra o padrão normal do usuário",
      "Classificar: força bruta, senha esquecida ou acesso legítimo",
    ],
  },
  {
    id: "cylab-alerta-soc", trackId: "soc-blueteam", nome: "Investigação de alerta SOC",
    descricao: "Um alerta chegou. Analise as evidências, monte a timeline e feche o ticket.",
    dificuldade: "avancado", tempoMin: 50, ferramenta: "SOC Lab do CCNA Study OS (Fase 2)",
    ambiente: "Cenário e logs 100% fictícios, IPs de documentação (RFC 5737).",
    checklist: [
      "Ler o alerta e listar as evidências disponíveis",
      "Montar a linha do tempo dos eventos",
      "Identificar origem, destino e ação",
      "Classificar o alerta e escrever a conclusão com a justificativa",
    ],
  },
  {
    id: "cylab-siem", trackId: "soc-blueteam", nome: "Playground SIEM",
    descricao: "Receba um lote de logs e construa filtros e consultas para achar o evento-chave.",
    dificuldade: "intermediario", tempoMin: 40, ferramenta: "Playground SIEM (Fase 3)",
    ambiente: "Logs fictícios — não conecta a nenhum SIEM corporativo.",
    checklist: [
      "Entender o schema dos eventos (campos disponíveis)",
      "Escrever um filtro que isole a janela de tempo do incidente",
      "Agrupar por host/usuário para achar o outlier",
      "Salvar a consulta e descrever o achado",
    ],
  },
  {
    id: "cylab-ssh", trackId: "seg-redes", nome: "SSH seguro", ccnaTopicId: "m06-02",
    descricao: "Configure acesso remoto seguro num equipamento de laboratório.",
    dificuldade: "basico", tempoMin: 20, ferramenta: "Simulador CLI do CCNA Study OS",
    ambiente: "Simulador interno.",
    checklist: [
      "Definir hostname e domain-name e gerar o par de chaves RSA",
      "Criar usuário local com senha forte (secret)",
      "Restringir as linhas VTY a 'transport input ssh'",
      "Validar que Telnet foi recusado",
    ],
  },
  {
    id: "cylab-syslog", trackId: "linux-seg", nome: "Centralização de logs (Syslog)", ccnaTopicId: "m42-01",
    descricao: "Envie logs de um dispositivo para um coletor central de laboratório.",
    dificuldade: "basico", tempoMin: 20, ferramenta: "Simulador CLI / lab",
    ambiente: "Ambiente de laboratório próprio.",
    checklist: [
      "Ativar timestamps com data/hora nos logs",
      "Apontar o dispositivo para o coletor Syslog (logging host)",
      "Escolher o nível de severidade a enviar (logging trap)",
      "Confirmar que os eventos chegam no coletor",
    ],
  },
  {
    id: "cylab-l2", trackId: "seg-redes", nome: "Segurança de camada 2", ccnaTopicId: "m41-01",
    descricao: "Proteja o acesso de borda contra abusos comuns de L2.",
    dificuldade: "intermediario", tempoMin: 30, ferramenta: "Simulador CLI do CCNA Study OS",
    ambiente: "Simulador interno.",
    checklist: [
      "Habilitar Port Security com aprendizado sticky nas portas de acesso",
      "Definir o modo de violação adequado ao cenário",
      "Habilitar DHCP Snooping na VLAN e marcar só o uplink como trusted",
      "Habilitar Dynamic ARP Inspection apoiada no DHCP Snooping",
    ],
  },
];

export async function seedCyberIfNeeded() {
  const metaRef = doc(db, "content", "meta");
  const metaSnap = await getDoc(metaRef);
  if (metaSnap.exists() && metaSnap.data().cyberSeededV1) {
    console.log("[seed] Cybersecurity já populado, pulando.");
    return { seeded: false };
  }

  const batch = writeBatch(db);
  tracks.forEach((t) => batch.set(doc(db, "content", "cyberTracks", "items", t.id), t));
  lessons.forEach((l) => batch.set(doc(db, "content", "cyberLessons", "items", l.id), l));
  labs.forEach((lab) => batch.set(doc(db, "content", "cyberLabs", "items", lab.id), lab));
  batch.set(
    metaRef,
    { cyberSeededV1: true, cyberCounts: { tracks: tracks.length, lessons: lessons.length, labs: labs.length }, cyberSeededV1At: serverTimestamp() },
    { merge: true }
  );

  await batch.commit();
  console.log(`[seed] ✅ Cybersecurity: ${tracks.length} trilhas, ${lessons.length} lições, ${labs.length} labs`);
  return { seeded: true };
}
