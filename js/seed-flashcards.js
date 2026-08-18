// seed-flashcards.js
// Popula content/flashcards/items — mesmo padrão de seed das outras coleções.
// Formato: { id, topicId, categoria, front, back }
// front/back alimentam o SRS (srs-engine.js cria os cards do usuário a partir daqui).

import { doc, getDoc, setDoc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

const flashcards = [
  // IPv4
  { id: "fc-ipv4-01", topicId: "m13-02", categoria: "IPv4", front: "Quantos hosts utilizáveis tem uma rede /28?", back: "14 hosts utilizáveis (2^4 - 2)." },
  { id: "fc-ipv4-02", topicId: "m13-01", categoria: "IPv4", front: "Qual a máscara em CIDR equivalente a 255.255.255.192?", back: "/26" },
  { id: "fc-ipv4-03", topicId: "m12-01", categoria: "IPv4", front: "Faixa de endereços privados classe A?", back: "10.0.0.0 – 10.255.255.255" },

  // IPv6
  { id: "fc-ipv6-01", topicId: "m25-02", categoria: "IPv6", front: "Qual o prefixo padrão de uma rede IPv6 link-local?", back: "fe80::/10" },
  { id: "fc-ipv6-02", topicId: "m26-01", categoria: "IPv6", front: "Como se abrevia 2001:0db8:0000:0000:0000:0000:0000:0001?", back: "2001:db8::1" },

  // VLAN
  { id: "fc-vlan-01", topicId: "m08-01", categoria: "VLAN", front: "Qual comando cria a VLAN 20 com nome TI?", back: "vlan 20 / name TI" },
  { id: "fc-vlan-02", topicId: "m08-02", categoria: "VLAN", front: "Qual protocolo faz o encapsulamento de trunk padrão da indústria?", back: "802.1Q" },
  { id: "fc-vlan-03", topicId: "m08-04", categoria: "VLAN", front: "O que é a VLAN nativa em um trunk 802.1Q?", back: "A VLAN cujo tráfego trafega sem tag no trunk." },

  // STP
  { id: "fc-stp-01", topicId: "m09-02", categoria: "STP", front: "Qual switch é eleito Root Bridge?", back: "O de menor Bridge ID (prioridade + MAC)." },
  { id: "fc-stp-02", topicId: "m09-04", categoria: "STP", front: "Quais os estados de porta no RSTP?", back: "Discarding, Learning, Forwarding." },
  { id: "fc-stp-03", topicId: "m10-02", categoria: "STP", front: "O que é BPDU Guard?", back: "Recurso que desativa a porta se receber uma BPDU em porta de acesso (PortFast)." },

  // OSPF
  { id: "fc-ospf-01", topicId: "m22-01", categoria: "OSPF", front: "Qual o comando para anunciar uma rede na área 0 do OSPF?", back: "network <rede> <wildcard> area 0" },
  { id: "fc-ospf-02", topicId: "m24-03", categoria: "OSPF", front: "Qual métrica o OSPF usa por padrão?", back: "Custo, baseado na largura de banda da interface (referência 100 Mbps)." },
  { id: "fc-ospf-03", topicId: "m24-01", categoria: "OSPF", front: "Quais os estados de vizinhança do OSPF até Full?", back: "Down → Init → 2-Way → ExStart → Exchange → Loading → Full." },

  // ACL
  { id: "fc-acl-01", topicId: "m35-01", categoria: "ACL", front: "Qual a diferença entre ACL padrão e estendida?", back: "Padrão filtra só por IP de origem; estendida filtra origem, destino, protocolo e porta." },
  { id: "fc-acl-02", topicId: "m36-02", categoria: "ACL", front: "O que acontece se uma ACL não tiver nenhuma regra correspondente?", back: "É negado implicitamente (deny any implícito no final)." },
  { id: "fc-acl-03", topicId: "m35-03", categoria: "ACL", front: "Onde aplicar uma ACL estendida, mais perto da origem ou do destino?", back: "O mais perto possível da origem." },

  // NAT
  { id: "fc-nat-01", topicId: "m43-03", categoria: "NAT", front: "O que é PAT?", back: "Port Address Translation — vários IPs privados compartilham 1 IP público usando portas diferentes." },
  { id: "fc-nat-02", topicId: "m43-01", categoria: "NAT", front: "Qual comando marca uma interface como 'dentro' no NAT?", back: "ip nat inside" },

  // DHCP
  { id: "fc-dhcp-01", topicId: "m19-01", categoria: "DHCP", front: "Quais as 4 fases do processo DHCP?", back: "Discover, Offer, Request, Ack (DORA)." },
  { id: "fc-dhcp-02", topicId: "m19-01", categoria: "DHCP", front: "Pra que serve o DHCP Relay?", back: "Encaminhar requisições DHCP entre sub-redes diferentes, até um servidor DHCP remoto." },

  // Wireless
  { id: "fc-wifi-01", topicId: "m31-01", categoria: "Wireless", front: "Qual a diferença entre AP autônomo e AP lightweight?", back: "Autônomo funciona sozinho; lightweight depende de um WLC (Wireless LAN Controller)." },
  { id: "fc-wifi-02", topicId: "m31-02", categoria: "Wireless", front: "O que é roaming em redes wireless?", back: "Cliente muda de AP sem perder a conexão, mantendo a sessão ativa." },

  // Automation
  { id: "fc-auto-01", topicId: "m53-01", categoria: "Automation", front: "Qual formato de dados usa indentação (sem chaves) para estruturar dados?", back: "YAML" },
  { id: "fc-auto-02", topicId: "m52-01", categoria: "Automation", front: "Quais os métodos HTTP mais usados em REST APIs?", back: "GET, POST, PUT, DELETE." },
  { id: "fc-auto-03", topicId: "m50-01", categoria: "Automation", front: "O que caracteriza uma arquitetura controller-based (SDN)?", back: "Plano de controle centralizado num controller, separado do plano de dados dos switches/roteadores." },

  // Security
  { id: "fc-sec-01", topicId: "m41-01", categoria: "Security", front: "O que é DHCP Snooping?", back: "Recurso de segurança de camada 2 que bloqueia servidores DHCP não autorizados na rede." },
  { id: "fc-sec-02", topicId: "m40-01", categoria: "Security", front: "O que é Port Security?", back: "Limita/controla quais MAC addresses podem usar uma porta de switch." },
  { id: "fc-sec-03", topicId: "m32-02", categoria: "Security", front: "Qual a principal melhoria do WPA3 sobre o WPA2?", back: "Uso do SAE (Simultaneous Authentication of Equals), mais resistente a ataques offline de dicionário." },
  { id: "fc-sec-04", topicId: "m38-02", categoria: "Security", front: "O que significa AAA em segurança de rede?", back: "Authentication, Authorization, Accounting." },

  // Binário / Hexadecimal
  { id: "fc-bin-01", topicId: "m11-01", categoria: "Binário", front: "Qual o valor decimal de 11000000 em binário?", back: "192" },
  { id: "fc-bin-02", topicId: "m11-02", categoria: "Binário", front: "Quantos bits tem um endereço IPv6?", back: "128 bits (contra 32 bits do IPv4)." },

  // ARP e ICMP
  { id: "fc-arp-01", topicId: "m01-04", categoria: "ARP", front: "Para que serve o ARP?", back: "Descobrir o endereço MAC associado a um endereço IP conhecido na mesma rede local." },
  { id: "fc-icmp-01", topicId: "m20-02", categoria: "ICMP", front: "Qual comando usa ICMP pra mostrar o caminho até um destino, hop por hop?", back: "traceroute (ou tracert no Windows)." },

  // TCP
  { id: "fc-tcp-01", topicId: "m34-01", categoria: "TCP", front: "Como se chama o processo de 3 passos que estabelece uma conexão TCP?", back: "Three-way handshake: SYN, SYN-ACK, ACK." },

  // Segurança de porta e DHCP Snooping
  { id: "fc-portsec-01", topicId: "m40-02", categoria: "Security", front: "No Port Security, qual modo de violação descarta o tráfego mas NÃO desliga a porta?", back: "Restrict — descarta o tráfego e gera log, sem colocar a porta em err-disabled." },
  { id: "fc-dhcpsnoop-01", topicId: "m41-01", categoria: "Security", front: "No DHCP Snooping, o que é uma porta 'trusted'?", back: "Porta que pode enviar respostas DHCP (normalmente onde está o servidor DHCP real ou o uplink)." },

  // Wireless avançado
  { id: "fc-wlc-01", topicId: "m31-02", categoria: "Wireless", front: "Qual protocolo o AP lightweight usa pra se comunicar com o WLC?", back: "CAPWAP (Control and Provisioning of Wireless Access Points)." },
  { id: "fc-wlan-01", topicId: "m33-01", categoria: "Wireless", front: "O que é uma Policy Tag num WLC IOS-XE?", back: "Mapeia o perfil de WLAN ao perfil de política, aplicado aos APs." },

  // VPN / IPsec
  { id: "fc-vpn-01", topicId: "m48-02", categoria: "VPN", front: "O que o IPsec garante no tráfego entre dois pontos?", back: "Confidencialidade, integridade e autenticação dos pacotes IP." },
  { id: "fc-vpn-02", topicId: "m48-02", categoria: "VPN", front: "Qual a diferença entre VPN site-to-site e VPN de acesso remoto?", back: "Site-to-site conecta redes inteiras entre si; acesso remoto conecta um usuário individual a uma rede." },

  // QoS
  { id: "fc-qos-01", topicId: "m44-01", categoria: "QoS", front: "Qual tipo de tráfego é mais sensível a atraso e variação (jitter): voz ou dados?", back: "Voz — é o mais sensível a atraso, jitter e perda de pacotes." },
  { id: "fc-qos-02", topicId: "m44-02", categoria: "QoS", front: "Qual a diferença entre shaping e policing?", back: "Shaping enfileira o tráfego excedente pra enviar depois; policing simplesmente descarta o excedente." },

  // Gerenciamento (CDP/LLDP/Syslog/NTP)
  { id: "fc-cdp-01", topicId: "m42-03", categoria: "Gerenciamento", front: "Qual protocolo de descoberta é proprietário da Cisco, e qual é o padrão aberto equivalente?", back: "CDP é proprietário Cisco; LLDP é o padrão aberto (IEEE 802.1AB)." },
  { id: "fc-ntp-01", topicId: "m42-02", categoria: "Gerenciamento", front: "Pra que serve o NTP?", back: "Sincronizar o relógio dos dispositivos de rede com um horário confiável." },

  // Automação
  { id: "fc-config-mgmt-01", topicId: "m53-01", categoria: "Automation", front: "Ansible usa arquitetura agentless ou precisa de agente instalado no dispositivo gerenciado?", back: "Agentless — não precisa instalar nada no dispositivo gerenciado, usa SSH." },
  { id: "fc-nat64-01", topicId: "m43-01", categoria: "NAT", front: "Pra que serve o NAT64?", back: "Traduz endereços entre uma rede IPv6-only e uma rede IPv4, permitindo comunicação entre elas." },

  // Ethernet e CLI
  { id: "fc-eth-01", topicId: "m02-04", categoria: "Ethernet", front: "Qual o tamanho mínimo de um quadro Ethernet?", back: "64 bytes (sem contar preâmbulo)." },
  { id: "fc-eth-02", topicId: "m02-01", categoria: "Ethernet", front: "Qual padrão define Gigabit Ethernet em cobre?", back: "1000BASE-T (IEEE 802.3ab)." },
  { id: "fc-cli-01", topicId: "m04-02", categoria: "CLI", front: "Qual prompt indica que você está no modo privilegiado (enable) de um Cisco IOS?", back: "O símbolo # no final do prompt, ex: Switch#" },
  { id: "fc-cli-02", topicId: "m04-04", categoria: "CLI", front: "Qual comando salva a running-config na startup-config?", back: "copy running-config startup-config (ou write memory)." },

  // Switch: interfaces e gerenciamento
  { id: "fc-swint-01", topicId: "m07-02", categoria: "Switching", front: "O que acontece se as duas pontas de um link não concordarem no duplex?", back: "Duplex mismatch — gera erros de colisão tardia e degrada a performance." },
  { id: "fc-swmgmt-01", topicId: "m06-02", categoria: "Switching", front: "Qual comando configura o SSH pedindo geração de chaves RSA?", back: "crypto key generate rsa" },

  // Sub-redes avançado (VLSM, classful)
  { id: "fc-vlsm-01", topicId: "m15-01", categoria: "Subnetting", front: "O que o VLSM permite fazer que o subnetting clássico não permite?", back: "Usar máscaras de tamanhos diferentes em sub-redes diferentes da mesma rede, evitando desperdício de endereços." },
  { id: "fc-classful-01", topicId: "m12-01", categoria: "Subnetting", front: "Qual classe de endereço IPv4 vai de 128.0.0.0 a 191.255.255.255?", back: "Classe B." },

  // OSPF avançado
  { id: "fc-ospf-04", topicId: "m24-02", categoria: "OSPF", front: "Em uma rede multiacesso, quem o DR e o BDR evitam que formem adjacência total com todos?", back: "Evitam que TODOS os roteadores formem adjacência de todos-com-todos, reduzindo tráfego de LSA — os DROTHERs só formam adjacência com DR e BDR." },

  // IPv6 hosts
  { id: "fc-ipv6host-01", topicId: "m28-01", categoria: "IPv6", front: "O que é SLAAC?", back: "StateLess Address Auto Configuration — o host gera seu próprio endereço IPv6 usando o prefixo anunciado pelo roteador + seu identificador de interface." },
  { id: "fc-ipv6host-02", topicId: "m28-02", categoria: "IPv6", front: "Qual a diferença entre DHCPv6 stateful e stateless?", back: "Stateful atribui o endereço completo; stateless só fornece opções extras (como DNS), o endereço vem do SLAAC." },

  // Wireless segurança
  { id: "fc-wpa3-01", topicId: "m32-02", categoria: "Wireless", front: "Qual mecanismo o WPA3 usa no lugar do PSK do WPA2 pra ser mais resistente a ataques offline?", back: "SAE (Simultaneous Authentication of Equals), também chamado de Dragonfly." },

  // ACL cenários
  { id: "fc-aclcenario-01", topicId: "m37-01", categoria: "ACL", front: "Por que ACLs padrão devem ser aplicadas o mais perto possível do destino?", back: "Porque elas filtram só pela origem — aplicar perto da origem bloquearia esse tráfego de alcançar qualquer outro destino também." },

  // Segurança de dispositivos
  { id: "fc-radius-01", topicId: "m38-02", categoria: "Security", front: "Qual a diferença entre RADIUS e TACACS+?", back: "RADIUS combina autenticação e autorização e usa UDP; TACACS+ separa AAA em processos distintos e usa TCP, permitindo mais granularidade." },
  { id: "fc-devsec-01", topicId: "m39-01", categoria: "Security", front: "Qual comando criptografa as senhas em texto plano na configuração?", back: "service password-encryption" },

  // Gerenciamento: Syslog níveis
  { id: "fc-syslog-01", topicId: "m42-01", categoria: "Gerenciamento", front: "Qual nível de severidade do Syslog é mais crítico: 0 ou 7?", back: "0 (Emergency) é o mais crítico; 7 (Debugging) é o menos crítico — a escala é decrescente em gravidade." },

  // Arquitetura de rede
  { id: "fc-lanarq-01", topicId: "m47-01", categoria: "Arquitetura", front: "Quais as 3 camadas do modelo hierárquico clássico de LAN?", back: "Core, Distribution (distribuição) e Access (acesso)." },
  { id: "fc-wanarq-01", topicId: "m48-01", categoria: "Arquitetura", front: "Qual topologia WAN conecta cada site diretamente a todos os outros sites?", back: "Full mesh — mais resiliente, porém mais cara e complexa que hub-and-spoke." },
  { id: "fc-cloudarq-01", topicId: "m49-01", categoria: "Arquitetura", front: "Em qual modelo de nuvem o provedor gerencia só a infraestrutura, e você cuida do SO e aplicações?", back: "IaaS (Infrastructure as a Service)." },

  // SDN / Controller
  { id: "fc-sdn-01", topicId: "m50-02", categoria: "Automation", front: "Qual a principal diferença entre uma rede tradicional e uma controller-based?", back: "Na controller-based, o plano de controle é centralizado num controller; na tradicional, cada dispositivo toma decisões de forma independente e distribuída." },

  // Modelo TCP/IP e roteamento básico
  { id: "fc-tcpip-01", topicId: "m01-01", categoria: "Fundamentos", front: "Quantas camadas tem o modelo TCP/IP (versão simplificada)?", back: "4 camadas: Aplicação, Transporte, Internet e Acesso à Rede." },
  { id: "fc-wan-01", topicId: "m03-01", categoria: "Fundamentos", front: "O que é uma 'leased line' (linha dedicada) numa WAN?", back: "Um circuito ponto-a-ponto dedicado exclusivamente a um cliente, sempre disponível e com largura de banda fixa." },

  // Switching interno
  { id: "fc-swlearn-01", topicId: "m05-02", categoria: "Switching", front: "O que o switch faz quando recebe um quadro com MAC de origem desconhecido?", back: "Aprende esse MAC associando-o à porta de entrada, gravando na tabela de endereços MAC." },
  { id: "fc-stptimer-01", topicId: "m09-04", categoria: "STP", front: "Qual o tempo padrão do temporizador Max Age do STP clássico?", back: "20 segundos." },

  // Roteamento
  { id: "fc-router-01", topicId: "m16-01", categoria: "Roteamento", front: "Qual componente de um roteador Cisco armazena a running-config enquanto ele está ligado?", back: "A RAM (memória volátil — se apagar a energia, perde a configuração não salva)." },
  { id: "fc-iplan-01", topicId: "m18-01", categoria: "Roteamento", front: "O que significa 'router-on-a-stick'?", back: "Uma única interface física do roteador, dividida em subinterfaces com trunk, roteando entre várias VLANs." },
  { id: "fc-troubleshoot-01", topicId: "m20-01", categoria: "Roteamento", front: "Qual o primeiro passo típico ao diagnosticar um problema de conectividade IP?", back: "Verificar a camada física e o endereçamento IP local antes de investigar rotas mais distantes (abordagem de baixo pra cima ou de cima pra baixo)." },

  // IPv6 avançado
  { id: "fc-ipv6static-01", topicId: "m27-02", categoria: "IPv6", front: "Qual comando global habilita o roteamento IPv6 num roteador Cisco?", back: "ipv6 unicast-routing" },
  { id: "fc-ipv6route-01", topicId: "m29-02", categoria: "IPv6", front: "Como verificar as rotas IPv6 estáticas configuradas?", back: "show ipv6 route static" },

  // Wireless arquitetura
  { id: "fc-wlanbuild-01", topicId: "m30-02", categoria: "Wireless", front: "O que compõe uma WLAN, além do AP?", back: "SSID, autenticação/criptografia, e os clientes wireless conectados." },

  // ACL nomeada
  { id: "fc-aclnomeada-01", topicId: "m36-01", categoria: "ACL", front: "Qual a vantagem de uma ACL nomeada sobre uma numerada?", back: "Permite editar/remover linhas individuais sem recriar a ACL inteira, além de nomes mais descritivos." },

  // QoS
  { id: "fc-qos-03", topicId: "m44-01", categoria: "QoS", front: "O que é 'jitter' em QoS?", back: "A variação no tempo de chegada dos pacotes — prejudica muito chamadas de voz e vídeo." },

  // SNMP
  { id: "fc-snmp-01", topicId: "m46-01", categoria: "Gerenciamento", front: "Qual versão do SNMP introduziu autenticação e criptografia?", back: "SNMPv3." },

  // SD-Access
  { id: "fc-sdaccess-01", topicId: "m51-01", categoria: "Automation", front: "O que é o 'fabric' no contexto do Cisco SD-Access?", back: "A infraestrutura de rede lógica criada pelo controller, que separa o plano de identidade do dispositivo (endpoint) da topologia física." },

  // ===== COBERTURA COMPLETA — 1 flashcard por lição que ainda estava sem nenhum conteúdo =====
  { id: "fc-gap-01", topicId: "m01-02", categoria: "Fundamentos", front: "O que a camada de aplicação do TCP/IP faz?", back: "Fornece os protocolos que as aplicações usam pra trocar dados, como HTTP, HTTPS, DNS e SMTP." },
  { id: "fc-gap-02", topicId: "m01-03", categoria: "Fundamentos", front: "Como o TCP garante que dados perdidos sejam reenviados?", back: "Usa números de sequência e confirmações (ACKs); se o remetente não recebe ACK a tempo, reenvia o segmento." },
  { id: "fc-gap-03", topicId: "m01-05", categoria: "Fundamentos", front: "Quantas camadas tem o modelo OSI, e quantas o TCP/IP simplificado?", back: "OSI tem 7 camadas; o TCP/IP simplificado tem 4." },
  { id: "fc-gap-04", topicId: "m02-02", categoria: "Ethernet", front: "Por que quase não se fala mais em cabo crossover vs straight-through hoje em dia?", back: "Porque a maioria dos equipamentos modernos tem MDI-X automático, detectando e ajustando sozinho, independente do tipo de cabo." },
  { id: "fc-gap-05", topicId: "m02-03", categoria: "Ethernet", front: "Qual a diferença entre fibra monomodo e multimodo?", back: "Monomodo suporta distâncias muito maiores com um único feixe de luz; multimodo é mais barata mas limitada a distâncias curtas." },
  { id: "fc-gap-06", topicId: "m02-05", categoria: "Ethernet", front: "O que é comunicação full duplex?", back: "Permite enviar e receber dados simultaneamente, sem colisões — padrão em redes modernas com switches." },
  { id: "fc-gap-07", topicId: "m03-02", categoria: "WAN", front: "Por que Ethernet se tornou popular também como tecnologia WAN?", back: "Reduz custo e simplifica operação, já que a mesma tecnologia usada na LAN passa a interligar sites via provedores." },
  { id: "fc-gap-08", topicId: "m03-03", categoria: "Roteamento", front: "Qual pergunta um roteador responde pra cada pacote recebido?", back: "Qual é a melhor interface de saída pra alcançar o IP de destino, com base na tabela de rotas." },
  { id: "fc-gap-09", topicId: "m03-04", categoria: "Fundamentos", front: "Qual a diferença fundamental entre DNS e ARP?", back: "DNS traduz nome de domínio pra endereço IP; ARP traduz endereço IP pra endereço MAC na rede local." },
  { id: "fc-gap-10", topicId: "m04-01", categoria: "CLI", front: "Quais as formas comuns de acessar a CLI de um switch Cisco?", back: "Porta console (cabo direto), Telnet (inseguro) e SSH (seguro, recomendado)." },
  { id: "fc-gap-11", topicId: "m04-03", categoria: "CLI", front: "Como voltar do modo de configuração de interface direto pro modo privilegiado?", back: "Com o comando end (ou Ctrl+Z), que sai de qualquer submodo de configuração de uma vez." },
  { id: "fc-gap-12", topicId: "m05-01", categoria: "Switching", front: "Como o switch decide por qual porta encaminhar um quadro?", back: "Consulta a tabela de endereços MAC: se souber a porta do MAC de destino, envia só por ali; se não souber, faz flooding." },
  { id: "fc-gap-13", topicId: "m05-03", categoria: "Switching", front: "O que acontece quando um switch recebe um quadro pra um MAC que não está na tabela?", back: "Faz flooding — envia por todas as portas, exceto a de origem." },
  { id: "fc-gap-14", topicId: "m05-04", categoria: "Switching", front: "Por quanto tempo uma entrada fica na tabela de endereços MAC por padrão?", back: "300 segundos (5 minutos) de inatividade, depois é removida automaticamente (aging time)." },
  { id: "fc-gap-15", topicId: "m06-01", categoria: "Switching", front: "Qual comando define uma senha criptografada pro modo privilegiado (enable)?", back: "enable secret <senha>" },
  { id: "fc-gap-16", topicId: "m06-03", categoria: "Switching", front: "Por que um switch de camada 2 precisa de um endereço IP?", back: "Só pra gerenciamento remoto (SSH, SNMP) — o switch continua encaminhando quadros sem precisar de IP." },
  { id: "fc-gap-17", topicId: "m07-01", categoria: "Switching", front: "O que a autonegociação Ethernet tenta combinar entre os dois lados do link?", back: "Velocidade e modo duplex, automaticamente, sem configuração manual." },
  { id: "fc-gap-18", topicId: "m07-03", categoria: "Switching", front: "O que o comando shutdown faz numa interface?", back: "Desativa administrativamente a interface; o comando no shutdown a reativa." },
  { id: "fc-gap-19", topicId: "m07-04", categoria: "Switching", front: "Qual sintoma indica duplex mismatch entre dois dispositivos?", back: "Erros de colisão tardia (late collisions) e desempenho degradado, mesmo com o link fisicamente up." },
  { id: "fc-gap-20", topicId: "m08-03", categoria: "VLAN", front: "Pra que serve uma VLAN de voz dedicada?", back: "Separa o tráfego de telefone IP do tráfego de dados normal na mesma porta física, priorizando QoS pra voz." },
  { id: "fc-gap-21", topicId: "m09-01", categoria: "STP", front: "Por que uma rede com links redundantes entre switches precisa do STP?", back: "Sem STP, links redundantes causam loops de camada 2, gerando tempestades de broadcast que derrubam a rede." },
  { id: "fc-gap-22", topicId: "m10-01", categoria: "STP", front: "Do que é composto o Bridge ID no STP?", back: "Prioridade do switch (padrão 32768) + endereço MAC — o menor Bridge ID vence a eleição de root bridge." },
  { id: "fc-gap-23", topicId: "m12-02", categoria: "Subnetting", front: "Qual a máscara padrão de uma rede classe A?", back: "255.0.0.0 (/8)." },
  { id: "fc-gap-24", topicId: "m14-01", categoria: "Subnetting", front: "Como encontrar o endereço de rede de uma sub-rede a partir de um IP e máscara?", back: "Aplica um AND lógico bit a bit entre o endereço IP e a máscara de sub-rede." },
  { id: "fc-gap-25", topicId: "m14-02", categoria: "Subnetting", front: "Como calcular o endereço de broadcast de uma sub-rede?", back: "Coloca todos os bits de host em 1, mantendo os bits de rede — é o último endereço da faixa." },
  { id: "fc-gap-26", topicId: "m15-02", categoria: "Subnetting", front: "Qual o primeiro passo pra planejar VLSM numa topologia com vários segmentos?", back: "Listar todos os segmentos e a quantidade de hosts necessária em cada um, do maior pro menor, antes de alocar endereços." },
  { id: "fc-gap-27", topicId: "m16-02", categoria: "Roteamento", front: "Quais os dois status que uma interface de roteador precisa mostrar pra estar totalmente operacional?", back: "'up' (linha física) e 'up' (protocolo de linha) — visto em show ip interface brief como 'up/up'." },
  { id: "fc-gap-28", topicId: "m17-01", categoria: "Roteamento", front: "Qual comando configura o endereço IP numa interface de roteador?", back: "ip address <endereço> <máscara>, dentro do modo de configuração da interface." },
  { id: "fc-gap-29", topicId: "m17-03", categoria: "Roteamento", front: "O que torna uma rota estática 'flutuante'?", back: "Tem uma distância administrativa maior que a rota primária, então só é usada como backup se a rota principal cair." },
  { id: "fc-gap-30", topicId: "m18-02", categoria: "Roteamento", front: "O que é uma SVI (Switch Virtual Interface)?", back: "Uma interface virtual de VLAN configurada num switch de camada 3, permitindo roteamento entre VLANs sem link físico externo a um roteador." },
  { id: "fc-gap-31", topicId: "m19-02", categoria: "Fundamentos", front: "O que acontece quando o host tenta se comunicar com um IP fora da sua sub-rede?", back: "Envia o pacote para o gateway padrão configurado, que se encarrega de rotear." },
  { id: "fc-gap-32", topicId: "m21-01", categoria: "OSPF", front: "O que caracteriza um protocolo de roteamento link-state como o OSPF?", back: "Cada roteador constrói um mapa completo da topologia e calcula o menor caminho, em vez de confiar só nos vizinhos diretos." },
  { id: "fc-gap-33", topicId: "m22-02", categoria: "OSPF", front: "Qual comando mostra os vizinhos OSPF formados?", back: "show ip ospf neighbor" },
  { id: "fc-gap-34", topicId: "m23-01", categoria: "OSPF", front: "Pra que serve configurar uma interface como passiva no OSPF?", back: "Impede que a interface envie/receba pacotes Hello, evitando formar vizinhança onde não é necessário, mas ainda anuncia a rede." },
  { id: "fc-gap-35", topicId: "m23-02", categoria: "OSPF", front: "Qual comando propaga uma rota padrão para os outros roteadores OSPF?", back: "default-information originate, dentro do modo router ospf." },
  { id: "fc-gap-36", topicId: "m25-01", categoria: "IPv6", front: "Qual o principal motivo da criação do IPv6?", back: "O esgotamento do espaço de endereços IPv4 (que tem só ~4,3 bilhões de endereços)." },
  { id: "fc-gap-37", topicId: "m26-02", categoria: "IPv6", front: "Qual o tamanho de prefixo mais comum usado pra sub-redes IPv6 em LANs?", back: "/64 — deixa 64 bits pra identificador de interface, compatível com SLAAC." },
  { id: "fc-gap-38", topicId: "m27-01", categoria: "IPv6", front: "Qual comando configura um endereço IPv6 numa interface de roteador?", back: "ipv6 address <endereço>/<prefixo>" },
  { id: "fc-gap-39", topicId: "m29-01", categoria: "IPv6", front: "Qual a diferença principal entre OSPFv2 e OSPFv3?", back: "OSPFv2 roteia IPv4; OSPFv3 foi criado pra rotear IPv6, mantendo a mesma lógica link-state." },
  { id: "fc-gap-40", topicId: "m30-01", categoria: "Wireless", front: "O que é um BSS numa rede wireless?", back: "Basic Service Set — um único AP e os clientes conectados a ele." },
  { id: "fc-gap-41", topicId: "m31-03", categoria: "Wireless", front: "Qual a diferença entre modo local e FlexConnect num AP lightweight?", back: "Modo local envia todo tráfego pelo túnel CAPWAP até o WLC; FlexConnect permite encaminhamento local mesmo sem conexão com o WLC." },
  { id: "fc-gap-42", topicId: "m32-01", categoria: "Wireless", front: "Quais os 3 pilares de segurança que um protocolo wireless precisa garantir?", back: "Autenticação (quem pode entrar), privacidade/criptografia (dados ilegíveis a terceiros) e integridade (dados não alterados)." },
  { id: "fc-gap-43", topicId: "m32-03", categoria: "Wireless", front: "O que é 802.1X numa rede wireless corporativa?", back: "Um framework de autenticação porta-a-porta que usa EAP pra validar credenciais individuais antes de liberar acesso à rede." },
  { id: "fc-gap-44", topicId: "m33-02", categoria: "Wireless", front: "Pra que serve a Policy Tag num WLC baseado em IOS-XE?", back: "Associa um perfil de WLAN às configurações de política e RF aplicadas aos APs daquele grupo." },
  { id: "fc-gap-45", topicId: "m34-02", categoria: "Fundamentos", front: "Por que aplicações de streaming/voz costumam usar UDP em vez de TCP?", back: "UDP não tem handshake nem retransmissão, sendo mais rápido — perder um pacote ocasional é melhor que atrasar o áudio/vídeo esperando retransmissão." },
  { id: "fc-gap-46", topicId: "m34-03", categoria: "Fundamentos", front: "O que é 'windowing' no TCP?", back: "Mecanismo que controla quantos bytes podem ser enviados antes de esperar confirmação, ajustando a velocidade conforme a capacidade do receptor." },
  { id: "fc-gap-47", topicId: "m35-02", categoria: "ACL", front: "Como funciona uma wildcard mask numa ACL?", back: "É o inverso de uma máscara normal: bit 0 significa 'precisa bater exatamente', bit 1 significa 'não importa'." },
  { id: "fc-gap-48", topicId: "m37-02", categoria: "ACL", front: "Qual comando mostra quantas vezes cada linha de uma ACL foi correspondida?", back: "show access-lists (ou show ip access-lists), que mostra contadores de match por linha." },
  { id: "fc-gap-49", topicId: "m38-01", categoria: "Security", front: "Qual a diferença entre uma ameaça (threat) e uma vulnerabilidade?", back: "Vulnerabilidade é uma fraqueza no sistema; ameaça é algo que pode explorar essa fraqueza pra causar dano." },
  { id: "fc-gap-50", topicId: "m41-02", categoria: "Security", front: "O que o DAI (Dynamic ARP Inspection) previne?", back: "Ataques de ARP spoofing/poisoning, validando mensagens ARP contra a base de dados confiável do DHCP Snooping." },
  { id: "fc-gap-51", topicId: "m43-02", categoria: "NAT", front: "Qual a diferença entre NAT estático e NAT dinâmico?", back: "Estático mapeia um IP interno pra um IP externo fixo; dinâmico usa um pool de IPs externos, atribuídos conforme a demanda." },
  { id: "fc-gap-52", topicId: "m45-01", categoria: "FHRP", front: "O que o HSRP fornece pra uma rede?", back: "Um endereço IP de gateway virtual, compartilhado entre 2+ roteadores, garantindo gateway ativo mesmo se um roteador falhar." },
  { id: "fc-gap-53", topicId: "m46-02", categoria: "Gerenciamento", front: "Qual a principal diferença entre FTP e TFTP?", back: "FTP usa TCP, tem autenticação e é mais robusto; TFTP usa UDP, é mais simples e sem autenticação." },
  { id: "fc-gap-54", topicId: "m47-02", categoria: "Arquitetura", front: "Por que data centers modernos preferem arquitetura spine-leaf ao modelo hierárquico clássico?", back: "Garante latência previsível e uniforme entre qualquer par de dispositivos, já que todo leaf se conecta a todo spine." },
  { id: "fc-gap-55", topicId: "m49-02", categoria: "Arquitetura", front: "Quais as formas comuns de conectar uma rede corporativa a um provedor de nuvem?", back: "Internet pública com VPN, ou conexão dedicada privada tipo Direct Connect (AWS) / ExpressRoute (Azure)." },
  { id: "fc-gap-56", topicId: "m51-02", categoria: "Automation", front: "O que a política de fabric no SD-Access usa como base pra decisões, em vez de IP/porta?", back: "Identidade do usuário/dispositivo (grupo de segurança), permitindo políticas consistentes independente de onde o dispositivo se conecta." },
  { id: "fc-gap-57", topicId: "m52-02", categoria: "Automation", front: "Quais os tipos básicos de dados suportados em JSON?", back: "String, número, booleano, null, array (lista) e objeto (pares chave-valor)." },
  { id: "fc-gap-58", topicId: "m53-02", categoria: "Automation", front: "Qual o conceito central do Terraform como ferramenta de infraestrutura como código?", back: "Definir o estado desejado da infraestrutura em arquivos declarativos, e o Terraform calcula e aplica as mudanças necessárias pra chegar lá." },
];

export async function seedFlashcardsIfNeeded() {
  const metaRef = doc(db, "content", "meta");
  const metaSnap = await getDoc(metaRef);

  if (metaSnap.exists() && metaSnap.data().flashcardsSeededV6) {
    console.log("[seed] Flashcards já populados, pulando.");
    return { seeded: false };
  }

  const batch = writeBatch(db);
  flashcards.forEach((fc) => {
    const ref = doc(db, "content", "flashcards", "items", fc.id);
    batch.set(ref, fc);
  });
  batch.set(metaRef, { flashcardsSeededV6: true, flashcardsCount: flashcards.length, flashcardsSeededV6At: serverTimestamp() }, { merge: true });

  await batch.commit();
  console.log(`[seed] ✅ ${flashcards.length} flashcards gravados`);
  return { seeded: true, count: flashcards.length };
}
