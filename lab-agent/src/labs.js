// labs.js — sobe, derruba e inspeciona labs (Containerlab + Docker).

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile, access, chmod, rm, readFile } from "node:fs/promises";
import path from "node:path";
import Docker from "dockerode";
import { PassThrough } from "node:stream";
import { config } from "./config.js";
import { converter, ErroTopologia } from "./topologia-para-clab.js";

const execFileP = promisify(execFile);
export const docker = new Docker({ socketPath: "/var/run/docker.sock" });

const RE_LAB = /^ccna-[a-z0-9]{1,16}$/;
const ocupados = new Set(); // labs em deploy/destroy agora

export function validarLab(lab) {
  if (!RE_LAB.test(lab)) throw new ErroTopologia("Nome de lab inválido.");
  return lab;
}

const dirDoLab = (lab) => path.join(config.dirLabs, validarLab(lab));
const existe = (p) => access(p).then(() => true, () => false);

async function clab(args, timeoutMs = 10 * 60_000) {
  const { stdout, stderr } = await execFileP("containerlab", args, { timeout: timeoutMs, maxBuffer: 20 * 1024 * 1024 });
  return `${stdout}\n${stderr}`;
}

async function labsAtivos() {
  const conts = await docker.listContainers({ all: true, filters: { label: ["containerlab"] } });
  return new Set(conts.map((c) => c.Labels.containerlab).filter((l) => RE_LAB.test(l)));
}

export async function subirLab(topologia, opcoes) {
  const { lab, clab: definicao, arquivos, mapa, avisos } = converter(topologia, opcoes);
  if (ocupados.has(lab)) throw new ErroTopologia("Esse lab já está sendo processado. Aguarde.");

  const ativos = await labsAtivos();
  if (!ativos.has(lab) && ativos.size >= config.maxLabs) {
    throw new ErroTopologia(`Já existem ${ativos.size} labs no ar (máximo ${config.maxLabs}). Derrube um antes.`);
  }

  ocupados.add(lab);
  try {
    const dir = dirDoLab(lab);
    if (opcoes.resetar) await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });

    for (const a of arquivos) {
      const destino = path.join(dir, a.caminho);
      if (!destino.startsWith(dir + path.sep)) continue;
      await mkdir(path.dirname(destino), { recursive: true });
      await chmod(path.dirname(destino), 0o777); // o FRR roda como usuário "frr" e precisa gravar (write memory)
      if (a.manterSeExistir && (await existe(destino))) continue;
      await writeFile(destino, a.conteudo, { mode: 0o666 });
    }

    // JSON é YAML válido — evita depender de um gerador de YAML.
    const arquivoTopo = path.join(dir, "topology.clab.yml");
    await writeFile(arquivoTopo, JSON.stringify(definicao, null, 2));
    await writeFile(path.join(dir, "mapa.json"), JSON.stringify({ mapa, avisos }, null, 2));

    await clab(["deploy", "-t", arquivoTopo, "--reconfigure"]);
    return { lab, mapa, avisos, status: await statusLab(lab) };
  } finally {
    ocupados.delete(lab);
  }
}

export async function derrubarLab(lab) {
  const dir = dirDoLab(lab);
  const arquivoTopo = path.join(dir, "topology.clab.yml");
  if (!(await existe(arquivoTopo))) return { lab, removido: false };
  if (ocupados.has(lab)) throw new ErroTopologia("Esse lab já está sendo processado. Aguarde.");
  ocupados.add(lab);
  try {
    // mantém frr/<nó>/frr.conf: o que você salvou com "write memory" volta no próximo deploy
    await clab(["destroy", "-t", arquivoTopo, "--cleanup"]);
    return { lab, removido: true };
  } finally {
    ocupados.delete(lab);
  }
}

// Roda um comando dentro do container e devolve stdout+stderr.
export async function executar(container, cmd, timeoutMs = 15_000) {
  const exec = await container.exec({ Cmd: cmd, AttachStdout: true, AttachStderr: true, Tty: false });
  const stream = await exec.start({ hijack: true, stdin: false });
  const saida = new PassThrough();
  let texto = "";
  saida.on("data", (b) => (texto += b.toString()));
  docker.modem.demuxStream(stream, saida, saida);
  await new Promise((resolve) => {
    const t = setTimeout(() => { stream.destroy(); resolve(); }, timeoutMs);
    stream.on("end", () => { clearTimeout(t); resolve(); });
    stream.on("error", () => { clearTimeout(t); resolve(); });
  });
  const { ExitCode } = await exec.inspect();
  return { texto, codigo: ExitCode };
}

export async function containerDoNo(lab, no) {
  validarLab(lab);
  const [c] = await docker.listContainers({
    all: true,
    filters: { label: [`containerlab=${lab}`, `clab-node-name=${no}`] },
  });
  return c ? docker.getContainer(c.Id) : null;
}

export async function statusLab(lab) {
  validarLab(lab);
  const conts = await docker.listContainers({ all: true, filters: { label: [`containerlab=${lab}`] } });
  let mapaSalvo = {};
  try {
    mapaSalvo = JSON.parse(await readFile(path.join(dirDoLab(lab), "mapa.json"), "utf8"));
  } catch { /* lab nunca subiu */ }

  const nos = await Promise.all(
    conts.map(async (c) => {
      const no = c.Labels["clab-node-name"];
      const rodando = c.State === "running";
      let interfaces = {};
      if (rodando) {
        const { texto } = await executar(docker.getContainer(c.Id), [
          "sh", "-c", 'for i in /sys/class/net/eth*; do [ -e "$i" ] && echo "$(basename $i) $(cat $i/operstate)"; done',
        ], 5_000).catch(() => ({ texto: "" }));
        for (const linha of texto.trim().split("\n")) {
          const [eth, estado] = linha.trim().split(/\s+/);
          if (eth && eth !== "eth0") interfaces[eth] = estado; // eth0 = gerência do containerlab
        }
      }
      return { no, estado: c.State, rodando, interfaces };
    })
  );

  return { lab, noAr: nos.some((n) => n.rodando), processando: ocupados.has(lab), nos, ...mapaSalvo };
}

const RE_IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

export async function ping(lab, no, destino) {
  if (!RE_IPV4.test(destino || "")) throw new ErroTopologia("Destino precisa ser um IPv4.");
  const c = await containerDoNo(lab, no);
  if (!c) throw new ErroTopologia("Equipamento não encontrado no lab.");
  const { texto, codigo } = await executar(c, ["ping", "-c", "3", "-W", "1", destino], 10_000);
  return { ok: codigo === 0, saida: texto };
}
