import { promises as fs } from "node:fs";
import path from "node:path";

async function isProjectRoot(candidate) {
  if (typeof candidate !== "string" || !candidate.trim()) return false;
  const root = path.resolve(candidate);
  const [rootStat, publicStat, dossiersStat] = await Promise.all([
    fs.stat(root).catch(() => null),
    fs.stat(path.join(root, "public")).catch(() => null),
    fs.stat(path.join(root, "data", "dossiers")).catch(() => null),
  ]);
  return Boolean(
    rootStat?.isDirectory() &&
      publicStat?.isDirectory() &&
      dossiersStat?.isDirectory(),
  );
}

export async function resolveLocalProjectRoot({
  cwd = process.cwd(),
  env = process.env,
} = {}) {
  const candidates = [
    env.CANCIONEIRO_PROJECT_ROOT,
    cwd,
    env.INIT_CWD,
    env.PWD,
  ];
  const seen = new Set();

  for (const candidate of candidates) {
    if (typeof candidate !== "string" || !candidate.trim()) continue;
    const resolved = path.resolve(candidate);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    if (await isProjectRoot(resolved)) return fs.realpath(resolved);
  }

  throw new Error(
    "Raiz local do Cancioneiro nao encontrada. Inicie com npm run dev na raiz do repositorio ou configure CANCIONEIRO_PROJECT_ROOT.",
  );
}
