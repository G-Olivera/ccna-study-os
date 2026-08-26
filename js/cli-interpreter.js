// cli-interpreter.js
// Interpretador de um subconjunto de comandos estilo Cisco IOS, que opera
// diretamente sobre o objeto de um dispositivo da Topologia (mutação real,
// não comparação de texto fixo como no simulador dos exercícios antigos).
//
// Objetivo: permitir "praticar CLI" contra a topologia que o usuário desenhou,
// vendo os campos de Interfaces/Propriedades mudarem de verdade — sem emular
// protocolos de rede de fato (isso fica pra uma fase futura de integração
// com EVE-NG/PNETLab/CML).

const EHSWITCH = (tipo) => tipo === "switchL2" || tipo === "switchL3";
const EHROTEADOR = (tipo) => tipo === "router";

export function criarSessaoCLI(device) {
  let modo = "user"; // user | priv | config | config-if | config-vlan | config-router
  let interfaceAtual = null;
  let vlanAtual = null;

  function prompt() {
    const host = device.nome || "Device";
    if (modo === "user") return `${host}>`;
    if (modo === "priv") return `${host}#`;
    if (modo === "config") return `${host}(config)#`;
    if (modo === "config-if") return `${host}(config-if)#`;
    if (modo === "config-vlan") return `${host}(config-vlan)#`;
    if (modo === "config-router") return `${host}(config-router)#`;
    return `${host}>`;
  }

  function acharInterface(nome) {
    const alvo = nome.trim().toLowerCase();
    return (device.interfaces || []).find((i) => i.nome.toLowerCase() === alvo || i.nome.toLowerCase().replace(/\s+/g, "") === alvo.replace(/\s+/g, ""));
  }

  function anexarLinha(campo, linha) {
    device.propriedades = device.propriedades || {};
    const atual = device.propriedades[campo] || "";
    device.propriedades[campo] = atual ? `${atual}\n${linha}` : linha;
  }

  function gerarShowRunningConfig() {
    const linhas = [`hostname ${device.nome}`, "!"];
    (device.interfaces || []).forEach((i) => {
      linhas.push(`interface ${i.nome}`);
      if (i.ip) linhas.push(` ip address ${i.ip}`);
      linhas.push(i.status === "up" ? " no shutdown" : " shutdown");
      if (i.descricao && i.descricao !== "Disponível") linhas.push(` description ${i.descricao}`);
      linhas.push("!");
    });
    const p = device.propriedades || {};
    if (p.vlans) linhas.push(...p.vlans.split("\n").map((l) => `vlan-config: ${l}`), "!");
    if (p.ospf) linhas.push(...p.ospf.split("\n").map((l) => `router ospf: ${l}`), "!");
    if (p.rotas) linhas.push(...p.rotas.split("\n").map((l) => `ip route: ${l}`), "!");
    return linhas.join("\n");
  }

  function gerarShowIpInterfaceBrief() {
    const linhas = ["Interface              IP-Address      Status"];
    (device.interfaces || []).forEach((i) => {
      linhas.push(`${i.nome.padEnd(22)} ${(i.ip || "unassigned").padEnd(16)} ${i.status === "up" ? "up" : i.status === "admin" ? "administratively down" : "down"}`);
    });
    return linhas.join("\n");
  }

  function executar(linhaBruta) {
    const linha = linhaBruta.trim();
    if (!linha) return null;
    const partes = linha.split(/\s+/);
    const cmd = partes[0].toLowerCase();

    // Comandos universais de navegação
    if (linha.toLowerCase() === "enable" || linha.toLowerCase() === "en") {
      if (modo === "user") modo = "priv";
      return { tipo: "saida", texto: "" };
    }
    if (linha.toLowerCase() === "end") {
      modo = "priv";
      interfaceAtual = null;
      vlanAtual = null;
      return { tipo: "saida", texto: "" };
    }
    if (linha.toLowerCase() === "exit") {
      if (modo === "config-if" || modo === "config-vlan" || modo === "config-router") modo = "config";
      else if (modo === "config") modo = "priv";
      else if (modo === "priv") modo = "user";
      interfaceAtual = null;
      vlanAtual = null;
      return { tipo: "saida", texto: "" };
    }
    if ((linha.toLowerCase() === "configure terminal" || linha.toLowerCase() === "conf t") && modo === "priv") {
      modo = "config";
      return { tipo: "saida", texto: "Enter configuration commands, one per line.  End with CNTL/Z." };
    }

    // show (modo priv ou superior)
    if (cmd === "show" || cmd === "sh") {
      const resto = partes.slice(1).join(" ").toLowerCase();
      if (resto.startsWith("running-config") || resto.startsWith("run")) return { tipo: "saida", texto: gerarShowRunningConfig() };
      if (resto.startsWith("ip interface brief") || resto.startsWith("ip int brief") || resto.startsWith("ip int br")) return { tipo: "saida", texto: gerarShowIpInterfaceBrief() };
      if (resto.startsWith("vlan")) return { tipo: "saida", texto: device.propriedades?.vlans || "Nenhuma VLAN configurada ainda." };
      return { tipo: "erro", texto: "% Comando 'show' não reconhecido nesta versão simplificada." };
    }

    // hostname (config)
    if (cmd === "hostname" && modo === "config") {
      device.nome = partes.slice(1).join(" ") || device.nome;
      return { tipo: "saida", texto: "" };
    }

    // interface (config) -> config-if
    if (cmd === "interface" || cmd === "int") {
      if (modo !== "config") return { tipo: "erro", texto: "% Entre em 'configure terminal' primeiro." };
      const nomeIf = partes.slice(1).join(" ");
      const iface = acharInterface(nomeIf);
      if (!iface) {
        const disponiveis = (device.interfaces || []).map((i) => i.nome).join(", ") || "nenhuma";
        return { tipo: "erro", texto: `% Interface "${nomeIf}" não existe neste equipamento. Disponíveis: ${disponiveis}` };
      }
      interfaceAtual = iface;
      modo = "config-if";
      return { tipo: "saida", texto: "" };
    }

    // dentro de config-if
    if (modo === "config-if" && interfaceAtual) {
      if (cmd === "ip" && partes[1]?.toLowerCase() === "address") {
        const ip = partes[2], mascara = partes[3];
        if (!ip || !mascara) return { tipo: "erro", texto: "% Uso: ip address <endereço> <máscara>" };
        interfaceAtual.ip = `${ip} ${mascara}`;
        return { tipo: "saida", texto: "" };
      }
      if (linha.toLowerCase() === "no shutdown" || linha.toLowerCase() === "no shut") {
        interfaceAtual.status = "up";
        return { tipo: "saida", texto: `%LINK-3-UPDOWN: Interface ${interfaceAtual.nome}, changed state to up` };
      }
      if (linha.toLowerCase() === "shutdown" || linha.toLowerCase() === "shut") {
        interfaceAtual.status = "admin";
        return { tipo: "saida", texto: `%LINK-5-CHANGED: Interface ${interfaceAtual.nome}, changed state to administratively down` };
      }
      if (cmd === "description") {
        interfaceAtual.descricao = partes.slice(1).join(" ");
        return { tipo: "saida", texto: "" };
      }
      if (linha.toLowerCase().startsWith("switchport mode trunk") && EHSWITCH(device.tipo)) {
        anexarLinha("trunks", `${interfaceAtual.nome}: trunk`);
        return { tipo: "saida", texto: "" };
      }
      if (linha.toLowerCase().startsWith("switchport mode access") && EHSWITCH(device.tipo)) {
        const vlanId = partes[partes.length - 1];
        anexarLinha("vlans", `${interfaceAtual.nome}: access VLAN ${vlanId}`);
        return { tipo: "saida", texto: "" };
      }
    }

    // vlan (config, switch) -> config-vlan
    if (cmd === "vlan" && modo === "config" && EHSWITCH(device.tipo)) {
      vlanAtual = partes[1];
      modo = "config-vlan";
      return { tipo: "saida", texto: "" };
    }
    if (modo === "config-vlan" && cmd === "name") {
      anexarLinha("vlans", `${vlanAtual} ${partes.slice(1).join(" ")}`);
      return { tipo: "saida", texto: "" };
    }

    // router ospf (config, roteador) -> config-router
    if (cmd === "router" && partes[1]?.toLowerCase() === "ospf" && modo === "config" && EHROTEADOR(device.tipo)) {
      modo = "config-router";
      anexarLinha("ospf", `Process ID ${partes[2] || "1"}`);
      return { tipo: "saida", texto: "" };
    }
    if (modo === "config-router" && cmd === "network") {
      anexarLinha("ospf", `network ${partes.slice(1).join(" ")}`);
      return { tipo: "saida", texto: "" };
    }

    // ip route (config, roteador)
    if (cmd === "ip" && partes[1]?.toLowerCase() === "route" && modo === "config" && EHROTEADOR(device.tipo)) {
      anexarLinha("rotas", `ip route ${partes.slice(2).join(" ")}`);
      return { tipo: "saida", texto: "" };
    }

    return { tipo: "erro", texto: `% Invalid input detected. Comando não reconhecido no modo atual (${modo}).` };
  }

  return { prompt, executar };
}

/** Gera o roteiro de comandos que produziria o estado ATUAL do dispositivo — usado
 * pelo botão "Gerar comandos" (nível 2 de integração: topologia → exercício de CLI). */
export function gerarComandosEquivalentes(device) {
  const linhas = ["enable", "configure terminal", `hostname ${device.nome}`];
  (device.interfaces || []).forEach((i) => {
    linhas.push(`interface ${i.nome}`);
    if (i.ip) linhas.push(` ip address ${i.ip}`);
    linhas.push(i.status === "up" ? " no shutdown" : " shutdown");
    if (i.descricao && i.descricao !== "Disponível") linhas.push(` description ${i.descricao}`);
    linhas.push("exit");
  });
  const p = device.propriedades || {};
  if (p.vlans) {
    p.vlans.split("\n").forEach((l) => {
      const [id, ...resto] = l.trim().split(" ");
      if (id && /^\d+$/.test(id)) {
        linhas.push(`vlan ${id}`);
        if (resto.length) linhas.push(` name ${resto.join(" ")}`);
        linhas.push("exit");
      }
    });
  }
  if (p.ospf) {
    const processo = p.ospf.match(/Process ID (\d+)/)?.[1] || "1";
    linhas.push(`router ospf ${processo}`);
    p.ospf
      .split("\n")
      .filter((l) => l.startsWith("network"))
      .forEach((l) => linhas.push(` ${l}`));
    linhas.push("exit");
  }
  if (p.rotas) p.rotas.split("\n").forEach((l) => linhas.push(l));
  linhas.push("end", "write memory");
  return linhas.join("\n");
}
