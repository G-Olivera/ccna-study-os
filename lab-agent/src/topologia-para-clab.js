// topologia-para-clab.js
// Converte a topologia desenhada no app (módulo Topologia) em um lab do Containerlab.
//
// Regra de segurança: o app NUNCA manda YAML. Ele manda a topologia (tipos de
// equipamento + conexões) e só este arquivo decide imagens, binds e comandos.
// Tipos fora da lista abaixo são recusados.

import { config } from "./config.js";

// tipo no app  →  papel no lab real
const PAPEIS = {
  router: "frr",
  switchL3: "frr",
  firewall: "frr",
  switchL2: "switch",
  pc: "host",
  laptop: "host",
  server: "host",
  ap: "host",
};

const RE_IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

export function nomeDoLab(topologiaId) {
  const limpo = String(topologiaId || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16);
  if (!limpo) throw new ErroTopologia("Salve a topologia antes de subir o lab.");
  return `ccna-${limpo}`;
}

export class ErroTopologia extends Error {}

export function mascaraParaPrefixo(mascara) {
  if (/^\d{1,2}$/.test(String(mascara))) return Number(mascara);
  if (!RE_IPV4.test(mascara || "")) return null;
  const bits = mascara.split(".").map((o) => Number(o).toString(2).padStart(8, "0")).join("");
  if (!/^1*0*$/.test(bits)) return null;
  return bits.indexOf("0") === -1 ? 32 : bits.indexOf("0");
}

// Aceita "10.0.0.1/30", "10.0.0.1 255.255.255.252" ou ip + máscara separados.
export function paraCidr(ip, mascara) {
  if (!ip) return null;
  let [end, resto] = String(ip).trim().split(/[\s/]+/);
  resto = resto || mascara;
  const prefixo = mascaraParaPrefixo(resto);
  if (!RE_IPV4.test(end) || prefixo == null) return null;
  return `${end}/${prefixo}`;
}

function nomeDoNo(nome, usados) {
  const base = String(nome || "no").replace(/[^A-Za-z0-9_-]/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "no";
  let candidato = base;
  for (let i = 2; usados.has(candidato.toLowerCase()); i++) candidato = `${base}-${i}`;
  usados.add(candidato.toLowerCase());
  return candidato;
}

// --------- arquivos de config do FRR ---------

const DAEMONS_FRR = `zebra=yes
bgpd=yes
ospfd=yes
ospf6d=yes
ripd=yes
ripngd=yes
eigrpd=yes
staticd=yes
vrrpd=yes
isisd=no
pimd=no
ldpd=no
nhrpd=no
babeld=no
sharpd=no
pbrd=no
bfdd=no
fabricd=no
pathd=no
vtysh_enable=yes
zebra_options="  -A 127.0.0.1 -s 90000000"
bgpd_options="   -A 127.0.0.1"
ospfd_options="  -A 127.0.0.1"
ospf6d_options=" -A ::1"
ripd_options="   -A 127.0.0.1"
ripngd_options=" -A ::1"
eigrpd_options=" -A 127.0.0.1"
staticd_options="-A 127.0.0.1"
vrrpd_options="  -A 127.0.0.1"
`;

function frrConf(hostname, interfaces, preconfig) {
  const linhas = ["frr defaults traditional", `hostname ${hostname}`, "log stdout", "service integrated-vtysh-config", "!"];
  for (const i of interfaces) {
    linhas.push(`interface ${i.eth}`, ` description ${i.descricao}`);
    if (preconfig && i.cidr) linhas.push(` ip address ${i.cidr}`);
    linhas.push("exit", "!");
  }
  return linhas.join("\n") + "\n";
}

// --------- conversão principal ---------

export function converter(topologia, { topologiaId, preconfig = false } = {}) {
  const lab = nomeDoLab(topologiaId);
  const dispositivos = Array.isArray(topologia?.dispositivos) ? topologia.dispositivos : [];
  const conexoes = Array.isArray(topologia?.conexoes) ? topologia.conexoes : [];
  const avisos = [];

  const nos = new Map(); // deviceId -> info
  const nomesUsados = new Set();
  for (const d of dispositivos) {
    const papel = PAPEIS[d?.tipo];
    if (!papel) {
      avisos.push(`"${d?.nome || d?.tipo}" (${d?.tipo}) não tem equivalente real e ficou de fora.`);
      continue;
    }
    nos.set(d.id, {
      device: d,
      papel,
      no: nomeDoNo(d.nome, nomesUsados),
      nomesInterfaces: (d.interfaces || []).map((i) => String(i?.nome || "").toLowerCase()),
      usadas: new Map(), // ethN -> nome no app
      reservadas: new Set(), // ethN de interfaces nomeadas que aparecem em alguma conexão
    });
  }
  if (nos.size === 0) throw new ErroTopologia("A topologia não tem equipamentos suportados no lab real.");
  if (nos.size > config.maxNos) throw new ErroTopologia(`Máximo de ${config.maxNos} equipamentos por lab.`);

  // Interfaces com nome conhecido ficam com ethN fixo (posição na lista do app + 1);
  // as desconhecidas (ex.: "NIC") pegam o menor ethN livre.
  for (const c of conexoes) {
    for (const [devId, nomeIf] of [[c.origemId, c.origemInterface], [c.destinoId, c.destinoInterface]]) {
      const info = nos.get(devId);
      const idx = info ? info.nomesInterfaces.indexOf(String(nomeIf || "").toLowerCase()) : -1;
      if (idx >= 0) info.reservadas.add(`eth${idx + 1}`);
    }
  }

  function alocarEth(info, nomeInterface) {
    const idx = info.nomesInterfaces.indexOf(String(nomeInterface || "").toLowerCase());
    let eth = idx >= 0 ? `eth${idx + 1}` : null;
    if (eth && info.usadas.has(eth)) throw new ErroTopologia(`${info.no}: a interface ${nomeInterface} está em mais de uma conexão.`);
    if (!eth) {
      let k = 1;
      while (info.usadas.has(`eth${k}`) || info.reservadas.has(`eth${k}`)) k++;
      eth = `eth${k}`;
    }
    info.usadas.set(eth, nomeInterface || eth);
    return eth;
  }

  const links = [];
  for (const c of conexoes) {
    const a = nos.get(c.origemId);
    const b = nos.get(c.destinoId);
    if (!a || !b) continue;
    const ethA = alocarEth(a, c.origemInterface);
    const ethB = alocarEth(b, c.destinoInterface);
    links.push({ endpoints: [`${a.no}:${ethA}`, `${b.no}:${ethB}`], _desc: [b.no, a.no] });
  }

  const clabNodes = {};
  const arquivos = []; // { caminho relativo ao dir do lab, conteudo, manterSeExistir }
  const mapa = {};

  for (const [id, info] of nos) {
    const d = info.device;
    const interfaces = [...info.usadas.entries()]
      .sort((x, y) => Number(x[0].slice(3)) - Number(y[0].slice(3)))
      .map(([eth, nomeApp]) => {
        const objApp = (d.interfaces || []).find((i) => String(i?.nome).toLowerCase() === String(nomeApp).toLowerCase());
        const link = links.find((l) => l.endpoints.some((e) => e === `${info.no}:${eth}`));
        const vizinho = link ? (link.endpoints[0].startsWith(`${info.no}:`) ? link._desc[0] : link._desc[1]) : "";
        return { eth, nomeApp, cidr: paraCidr(objApp?.ip, objApp?.mascara || d.mascara), descricao: `link-${vizinho}` };
      });

    mapa[id] = { no: info.no, papel: info.papel, interfaces: Object.fromEntries(interfaces.map((i) => [i.nomeApp, i.eth])) };

    if (info.papel === "frr") {
      clabNodes[info.no] = { kind: "linux", image: config.imagens.frr, binds: [`frr/${info.no}:/etc/frr`] };
      arquivos.push(
        { caminho: `frr/${info.no}/daemons`, conteudo: DAEMONS_FRR },
        { caminho: `frr/${info.no}/vtysh.conf`, conteudo: "service integrated-vtysh-config\n" },
        { caminho: `frr/${info.no}/frr.conf`, conteudo: frrConf(info.no, interfaces, preconfig), manterSeExistir: true }
      );
    } else if (info.papel === "switch") {
      const exec = ["ip link add br0 type bridge", "ip link set br0 up"];
      for (const i of interfaces) exec.push(`ip link set ${i.eth} master br0`, `ip link set ${i.eth} up`);
      clabNodes[info.no] = { kind: "linux", image: config.imagens.host, exec };
    } else {
      const exec = [];
      const primeira = interfaces[0];
      const cidr = paraCidr(d.ip, d.mascara) || primeira?.cidr;
      if (primeira && cidr) {
        exec.push(`ip addr add ${cidr} dev ${primeira.eth}`);
        if (RE_IPV4.test(d.gateway || "")) exec.push(`ip route replace default via ${d.gateway} dev ${primeira.eth}`);
      } else if (primeira) {
        avisos.push(`${info.no}: sem IP definido — configure no terminal com "ip addr add".`);
      }
      clabNodes[info.no] = { kind: "linux", image: config.imagens.host, ...(exec.length ? { exec } : {}) };
    }
  }

  const clab = {
    name: lab,
    topology: { nodes: clabNodes, links: links.map(({ endpoints }) => ({ endpoints })) },
  };
  return { lab, clab, arquivos, mapa, avisos };
}
