// seed-labs.js
// Popula content/labs/items com laboratórios que incluem uma sequência de comandos
// e a saída simulada de cada um — alimenta o simulador de CLI (cli-simulator.js).
// Mesmo padrão de seed das outras coleções: só grava uma vez.

import { doc, getDoc, setDoc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

const labsExemplo = [
  {
    id: "lab-2.1-vlan",
    topicId: "m08-01",
    titulo: "Configuração básica de VLANs e Trunk 802.1Q",
    ferramenta: "EVE-NG",
    dispositivo: "Switch",
    promptInicial: "Switch>",
    topologiaDescricao: "2 switches (SW1, SW2) conectados por trunk, cada um com 2 hosts em VLANs diferentes (10 e 20).",
    comandos: [
      { instrucao: "Entre no modo privilegiado.", cmd: "enable", saida: "", promptDepois: "Switch#" },
      { instrucao: "Entre no modo de configuração global.", cmd: "configure terminal", saida: "Enter configuration commands, one per line.  End with CNTL/Z.", promptDepois: "Switch(config)#" },
      { instrucao: "Crie a VLAN 10.", cmd: "vlan 10", saida: "", promptDepois: "Switch(config-vlan)#" },
      { instrucao: "Dê um nome à VLAN 10.", cmd: "name VENDAS", saida: "", promptDepois: "Switch(config-vlan)#" },
      { instrucao: "Volte pro modo de configuração global.", cmd: "exit", saida: "", promptDepois: "Switch(config)#" },
      { instrucao: "Entre na interface fa0/24 (porta do trunk).", cmd: "interface fa0/24", saida: "", promptDepois: "Switch(config-if)#" },
      { instrucao: "Coloque a porta em modo trunk.", cmd: "switchport mode trunk", saida: "", promptDepois: "Switch(config-if)#" },
      { instrucao: "Permita as VLANs 10 e 20 nesse trunk.", cmd: "switchport trunk allowed vlan 10,20", saida: "", promptDepois: "Switch(config-if)#" },
      { instrucao: "Saia do modo de configuração.", cmd: "end", saida: "", promptDepois: "Switch#" },
      { instrucao: "Confirme as VLANs criadas.", cmd: "show vlan brief", saida: "VLAN Name                             Status    Ports\n---- -------------------------------- --------- -------\n1    default                          active    Fa0/1, Fa0/2\n10   VENDAS                           active\n20   TI                               active", promptDepois: "Switch#" },
    ],
    errosComuns: [
      "Esquecer de permitir a VLAN no trunk (`switchport trunk allowed vlan`) — tráfego não passa.",
      "Deixar a porta como `dynamic auto` dos dois lados — trunk não negocia.",
      "Nativa VLAN diferente nas duas pontas do trunk — gera warning de mismatch.",
    ],
  },
  {
    id: "lab-3.3-ospf",
    topicId: "m22-01",
    titulo: "OSPFv2 de área única entre 3 roteadores",
    ferramenta: "PNETLab",
    dispositivo: "Router",
    promptInicial: "Router>",
    topologiaDescricao: "R1 — R2 — R3 em topologia linear, todos na área 0.",
    comandos: [
      { instrucao: "Entre no modo privilegiado.", cmd: "enable", saida: "", promptDepois: "Router#" },
      { instrucao: "Entre no modo de configuração global.", cmd: "configure terminal", saida: "Enter configuration commands, one per line.  End with CNTL/Z.", promptDepois: "Router(config)#" },
      { instrucao: "Habilite o OSPF processo 1.", cmd: "router ospf 1", saida: "", promptDepois: "Router(config-router)#" },
      { instrucao: "Defina o router-id manualmente.", cmd: "router-id 1.1.1.1", saida: "", promptDepois: "Router(config-router)#" },
      { instrucao: "Anuncie a rede na área 0.", cmd: "network 10.0.0.0 0.0.0.3 area 0", saida: "", promptDepois: "Router(config-router)#" },
      { instrucao: "Saia do modo de configuração.", cmd: "end", saida: "", promptDepois: "Router#" },
      { instrucao: "Verifique os vizinhos OSPF formados.", cmd: "show ip ospf neighbor", saida: "Neighbor ID     Pri   State           Dead Time   Address         Interface\n2.2.2.2           1   FULL/BDR        00:00:38    10.0.0.2        GigabitEthernet0/0", promptDepois: "Router#" },
    ],
    errosComuns: [
      "Wildcard mask errada na rede anunciada (inverter máscara com wildcard).",
      "Roteadores em áreas diferentes sem querer — vizinhança nunca forma.",
      "Interface passiva mal configurada, impedindo formação de vizinhança onde não devia.",
    ],
  },
  {
    id: "lab-4.1-nat",
    topicId: "m43-03",
    titulo: "NAT dinâmico com PAT (sobrecarga)",
    ferramenta: "EVE-NG",
    dispositivo: "Router",
    promptInicial: "Router>",
    topologiaDescricao: "R1 com interface interna (LAN) e externa (simulando internet), 2 hosts na LAN.",
    comandos: [
      { instrucao: "Entre no modo privilegiado.", cmd: "enable", saida: "", promptDepois: "Router#" },
      { instrucao: "Entre no modo de configuração global.", cmd: "configure terminal", saida: "Enter configuration commands, one per line.  End with CNTL/Z.", promptDepois: "Router(config)#" },
      { instrucao: "Entre na interface interna (LAN).", cmd: "interface g0/0", saida: "", promptDepois: "Router(config-if)#" },
      { instrucao: "Marque essa interface como NAT inside.", cmd: "ip nat inside", saida: "", promptDepois: "Router(config-if)#" },
      { instrucao: "Volte e entre na interface externa.", cmd: "interface g0/1", saida: "", promptDepois: "Router(config-if)#" },
      { instrucao: "Marque essa interface como NAT outside.", cmd: "ip nat outside", saida: "", promptDepois: "Router(config-if)#" },
      { instrucao: "Saia pro modo global.", cmd: "exit", saida: "", promptDepois: "Router(config)#" },
      { instrucao: "Crie uma ACL definindo a rede interna a traduzir.", cmd: "access-list 1 permit 192.168.1.0 0.0.0.255", saida: "", promptDepois: "Router(config)#" },
      { instrucao: "Configure o NAT com sobrecarga (PAT).", cmd: "ip nat inside source list 1 interface g0/1 overload", saida: "", promptDepois: "Router(config)#" },
      { instrucao: "Saia do modo de configuração.", cmd: "end", saida: "", promptDepois: "Router#" },
      { instrucao: "Verifique as traduções ativas.", cmd: "show ip nat translations", saida: "Pro Inside global      Inside local       Outside local      Outside global\ntcp 203.0.113.1:1024   192.168.1.10:1024  8.8.8.8:80         8.8.8.8:80", promptDepois: "Router#" },
    ],
    errosComuns: [
      "Esquecer de marcar uma das interfaces como inside/outside — NAT não traduz nada.",
      "ACL mal escrita cobrindo a rede errada.",
      "Esquecer `overload` — permite só 1 tradução simultânea em vez de várias com portas diferentes.",
    ],
  },
  {
    id: "lab-5.4-acl",
    topicId: "m36-02",
    titulo: "ACL estendida bloqueando tráfego específico",
    ferramenta: "PNETLab",
    dispositivo: "Router",
    promptInicial: "Router>",
    topologiaDescricao: "R1 entre duas redes, bloqueando acesso HTTP de uma sub-rede específica ao servidor.",
    comandos: [
      { instrucao: "Entre no modo privilegiado.", cmd: "enable", saida: "", promptDepois: "Router#" },
      { instrucao: "Entre no modo de configuração global.", cmd: "configure terminal", saida: "Enter configuration commands, one per line.  End with CNTL/Z.", promptDepois: "Router(config)#" },
      { instrucao: "Bloqueie tráfego HTTP dessa sub-rede ao servidor.", cmd: "access-list 101 deny tcp 192.168.10.0 0.0.0.255 host 192.168.20.100 eq 80", saida: "", promptDepois: "Router(config)#" },
      { instrucao: "Permita todo o resto do tráfego.", cmd: "access-list 101 permit ip any any", saida: "", promptDepois: "Router(config)#" },
      { instrucao: "Entre na interface de entrada do tráfego.", cmd: "interface g0/0", saida: "", promptDepois: "Router(config-if)#" },
      { instrucao: "Aplique a ACL na direção de entrada.", cmd: "ip access-group 101 in", saida: "", promptDepois: "Router(config-if)#" },
      { instrucao: "Saia do modo de configuração.", cmd: "end", saida: "", promptDepois: "Router#" },
      { instrucao: "Verifique os contadores da ACL.", cmd: "show access-lists 101", saida: "Extended IP access list 101\n    10 deny tcp 192.168.10.0 0.0.0.255 host 192.168.20.100 eq www (3 matches)\n    20 permit ip any any (128 matches)", promptDepois: "Router#" },
    ],
    errosComuns: [
      "Aplicar a ACL do lado errado (in vs out).",
      "Esquecer o `permit ip any any` no final — bloqueia tudo sem querer (deny implícito).",
      "Ordem das regras errada — regra mais específica precisa vir antes da mais genérica.",
    ],
  },
  {
    id: "lab-2.4-etherchannel",
    topicId: "m10-03",
    titulo: "EtherChannel com LACP entre dois switches",
    ferramenta: "EVE-NG",
    dispositivo: "Switch",
    promptInicial: "Switch>",
    topologiaDescricao: "SW1 e SW2 conectados por 2 links físicos agrupados em 1 EtherChannel lógico.",
    comandos: [
      { instrucao: "Entre no modo privilegiado.", cmd: "enable", saida: "", promptDepois: "Switch#" },
      { instrucao: "Entre no modo de configuração global.", cmd: "configure terminal", saida: "Enter configuration commands, one per line.  End with CNTL/Z.", promptDepois: "Switch(config)#" },
      { instrucao: "Selecione as duas interfaces físicas de uma vez.", cmd: "interface range g0/1-2", saida: "", promptDepois: "Switch(config-if-range)#" },
      { instrucao: "Agrupe as interfaces em LACP ativo.", cmd: "channel-group 1 mode active", saida: "Creating a port-channel interface Port-channel 1", promptDepois: "Switch(config-if-range)#" },
      { instrucao: "Saia pro modo global.", cmd: "exit", saida: "", promptDepois: "Switch(config)#" },
      { instrucao: "Entre na interface lógica Port-channel 1.", cmd: "interface port-channel 1", saida: "", promptDepois: "Switch(config-if)#" },
      { instrucao: "Configure a Port-channel como trunk.", cmd: "switchport mode trunk", saida: "", promptDepois: "Switch(config-if)#" },
      { instrucao: "Saia do modo de configuração.", cmd: "end", saida: "", promptDepois: "Switch#" },
      { instrucao: "Verifique se o canal formou corretamente.", cmd: "show etherchannel summary", saida: "Group  Port-channel  Protocol    Ports\n------+-------------+-----------+-----------------------------------------------\n1      Po1(SU)         LACP      Gi0/1(P) Gi0/2(P)", promptDepois: "Switch#" },
    ],
    errosComuns: [
      "Modos LACP incompatíveis entre os switches (active-active ou active-passive funcionam; passive-passive não forma o canal).",
      "Interfaces com configurações diferentes (velocidade, duplex, VLAN) antes de agrupar — o channel não sobe.",
    ],
  },
  {
    id: "lab-45-hsrp",
    topicId: "m45-01",
    titulo: "Redundância de gateway com HSRP",
    ferramenta: "PNETLab",
    dispositivo: "Router",
    promptInicial: "Router>",
    topologiaDescricao: "R1 e R2 compartilhando um gateway virtual pra mesma LAN, com R1 como ativo.",
    comandos: [
      { instrucao: "Entre no modo privilegiado.", cmd: "enable", saida: "", promptDepois: "Router#" },
      { instrucao: "Entre no modo de configuração global.", cmd: "configure terminal", saida: "Enter configuration commands, one per line.  End with CNTL/Z.", promptDepois: "Router(config)#" },
      { instrucao: "Entre na interface LAN.", cmd: "interface g0/0", saida: "", promptDepois: "Router(config-if)#" },
      { instrucao: "Configure o grupo HSRP 1 com o IP virtual.", cmd: "standby 1 ip 192.168.1.1", saida: "", promptDepois: "Router(config-if)#" },
      { instrucao: "Defina a prioridade pra esse roteador ser o ativo.", cmd: "standby 1 priority 110", saida: "", promptDepois: "Router(config-if)#" },
      { instrucao: "Habilite preempção (assumir o papel ativo quando disponível de novo).", cmd: "standby 1 preempt", saida: "", promptDepois: "Router(config-if)#" },
      { instrucao: "Saia do modo de configuração.", cmd: "end", saida: "", promptDepois: "Router#" },
      { instrucao: "Verifique o status do HSRP.", cmd: "show standby brief", saida: "Interface   Grp  Pri P State    Active          Standby         Virtual IP\nGi0/0       1    110 P Active   local           192.168.1.2     192.168.1.1", promptDepois: "Router#" },
    ],
    errosComuns: [
      "Esquecer de configurar o mesmo IP virtual e número de grupo nos dois roteadores — eles não formam par.",
      "Não habilitar preempt — o roteador de maior prioridade não retoma o papel ativo depois de voltar de uma falha.",
    ],
  },
  {
    id: "lab-27-ipv6static",
    topicId: "m27-02",
    titulo: "Rota estática IPv6",
    ferramenta: "EVE-NG",
    dispositivo: "Router",
    promptInicial: "Router>",
    topologiaDescricao: "R1 — R2 com endereçamento IPv6, anunciando uma rota estática pra rede remota.",
    comandos: [
      { instrucao: "Entre no modo privilegiado.", cmd: "enable", saida: "", promptDepois: "Router#" },
      { instrucao: "Entre no modo de configuração global.", cmd: "configure terminal", saida: "Enter configuration commands, one per line.  End with CNTL/Z.", promptDepois: "Router(config)#" },
      { instrucao: "Habilite o roteamento IPv6 unicast.", cmd: "ipv6 unicast-routing", saida: "", promptDepois: "Router(config)#" },
      { instrucao: "Crie a rota estática pra rede remota via o próximo salto.", cmd: "ipv6 route 2001:db8:2::/64 2001:db8:12::2", saida: "", promptDepois: "Router(config)#" },
      { instrucao: "Saia do modo de configuração.", cmd: "end", saida: "", promptDepois: "Router#" },
      { instrucao: "Verifique a tabela de rotas IPv6.", cmd: "show ipv6 route static", saida: "S   2001:DB8:2::/64 [1/0]\n     via 2001:DB8:12::2", promptDepois: "Router#" },
    ],
    errosComuns: [
      "Esquecer o `ipv6 unicast-routing` — sem isso o roteador não encaminha pacotes IPv6 entre interfaces.",
      "Confundir o endereço de rede de destino com o do próximo salto na hora de digitar a rota.",
    ],
  },
  {
    id: "lab-33-wlc",
    topicId: "m33-01",
    titulo: "Configuração básica de um WLC",
    ferramenta: "PNETLab",
    dispositivo: "WLC",
    promptInicial: "WLC>",
    topologiaDescricao: "Um WLC gerenciando um AP lightweight, criando uma WLAN pra clientes wireless.",
    comandos: [
      { instrucao: "Entre no modo privilegiado.", cmd: "enable", saida: "", promptDepois: "WLC#" },
      { instrucao: "Entre no modo de configuração global.", cmd: "configure terminal", saida: "Enter configuration commands, one per line.  End with CNTL/Z.", promptDepois: "WLC(config)#" },
      { instrucao: "Crie o perfil de WLAN com nome e SSID.", cmd: "wlan ESTUDANTES 1 ESTUDANTES", saida: "", promptDepois: "WLC(config-wlan)#" },
      { instrucao: "Defina a segurança como WPA2/WPA3.", cmd: "security wpa wpa2 wpa3", saida: "", promptDepois: "WLC(config-wlan)#" },
      { instrucao: "Ative essa WLAN.", cmd: "no shutdown", saida: "", promptDepois: "WLC(config-wlan)#" },
      { instrucao: "Saia do modo de configuração.", cmd: "end", saida: "", promptDepois: "WLC#" },
      { instrucao: "Verifique as WLANs configuradas.", cmd: "show wlan summary", saida: "WLAN ID  WLAN Profile Name / SSID   Status   Interface\n1        ESTUDANTES / ESTUDANTES    UP       management", promptDepois: "WLC#" },
    ],
    errosComuns: [
      "Esquecer de dar `no shutdown` na WLAN — ela fica criada mas inativa.",
      "Não vincular a WLAN a uma Policy Tag/interface correta — os clientes não recebem IP.",
    ],
  },
];

export async function seedLabsIfNeeded() {
  const metaRef = doc(db, "content", "meta");
  const metaSnap = await getDoc(metaRef);

  if (metaSnap.exists() && metaSnap.data().labsSeededV3) {
    console.log("[seed] Labs já populados, pulando.");
    return { seeded: false };
  }

  const batch = writeBatch(db);
  labsExemplo.forEach((lab) => {
    const ref = doc(db, "content", "labs", "items", lab.id);
    batch.set(ref, lab);
  });
  batch.set(metaRef, { labsSeededV3: true, labsCount: labsExemplo.length, labsSeededV3At: serverTimestamp() }, { merge: true });

  await batch.commit();
  console.log(`[seed] ✅ ${labsExemplo.length} labs gravados`);
  return { seeded: true, count: labsExemplo.length };
}
