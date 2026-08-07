import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { migrateCatalogToDossiers } from "../lib/catalog-dossier-migration.mjs";

const projectRoot = process.cwd();
const defaultCatalogPath = path.join(projectRoot, "public", "catalog.json");
const defaultDossierDirectory = path.join(projectRoot, "data", "dossiers");

function parseArgs(argv) {
  const options = {
    catalogPath: defaultCatalogPath,
    check: false,
    dossierDirectory: defaultDossierDirectory,
    migratedAt: "2026-08-07",
    write: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      options.check = true;
    } else if (arg === "--write") {
      options.write = true;
    } else if (arg === "--catalog") {
      options.catalogPath = path.resolve(argv[index + 1]);
      index += 1;
    } else if (arg === "--out") {
      options.dossierDirectory = path.resolve(argv[index + 1]);
      index += 1;
    } else if (arg === "--date") {
      options.migratedAt = argv[index + 1];
      index += 1;
    } else {
      throw new Error(`Argumento desconhecido: ${arg}`);
    }
  }

  if (options.check && options.write) {
    throw new Error("Use --check ou --write, nao ambos.");
  }

  return options;
}

function dossierPathFor(directory, dossier) {
  return path.join(directory, `${dossier.work.id}.json`);
}

async function readExistingFile(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function writeJsonAtomically(filePath, contents) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  try {
    await fs.writeFile(temporaryPath, contents, "utf8");
    await fs.rename(temporaryPath, filePath);
  } finally {
    await fs.rm(temporaryPath, { force: true });
  }
}

export async function migrationPlan({
  catalogPath = defaultCatalogPath,
  dossierDirectory = defaultDossierDirectory,
  migratedAt = "2026-08-07",
} = {}) {
  const catalog = JSON.parse(await fs.readFile(catalogPath, "utf8"));
  const { dossiers, report } = migrateCatalogToDossiers(catalog, { migratedAt });
  const files = [];

  for (const dossier of dossiers) {
    const filePath = dossierPathFor(dossierDirectory, dossier);
    const contents = `${JSON.stringify(dossier, null, 2)}\n`;
    const existing = await readExistingFile(filePath);
    const action =
      existing === null ? "create" : existing === contents ? "unchanged" : "update";
    files.push({
      action,
      contents,
      filePath,
      id: dossier.publicCatalogId,
      title: dossier.work.preferredTitle,
    });
  }

  return {
    files,
    report,
  };
}

export async function applyMigrationPlan(plan) {
  for (const file of plan.files) {
    if (file.action === "unchanged") continue;
    await writeJsonAtomically(file.filePath, file.contents);
  }
}

function formatPlan(plan) {
  const counts = plan.files.reduce(
    (accumulator, file) => {
      accumulator[file.action] += 1;
      return accumulator;
    },
    { create: 0, unchanged: 0, update: 0 },
  );
  const lines = [
    `Dossies planejados: ${plan.files.length}`,
    `- criar: ${counts.create}`,
    `- atualizar: ${counts.update}`,
    `- sem mudanca: ${counts.unchanged}`,
  ];

  const changed = plan.files.filter((file) => file.action !== "unchanged");
  if (changed.length > 0) {
    lines.push("", "Arquivos pendentes:");
    changed.forEach((file) => {
      lines.push(`- ${file.action}: ${file.filePath}`);
    });
  }

  const pending = plan.report.filter((item) => item.pending.length > 0);
  if (pending.length > 0) {
    lines.push("", "Revisao humana:");
    pending.forEach((item) => {
      lines.push(`- ${item.id} (${item.title}): ${item.pending.join(", ")}`);
    });
  }

  return lines.join("\n");
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const plan = await migrationPlan(options);
  const pendingWrites = plan.files.filter((file) => file.action !== "unchanged");

  console.log(formatPlan(plan));

  if (options.check && pendingWrites.length > 0) {
    throw new Error(
      "Migracao de dossies pendente. Rode `npm run dossiers:migrate -- --write` para gravar.",
    );
  }

  if (options.write) {
    await applyMigrationPlan(plan);
    console.log("Dossies migrados gravados.");
  } else if (!options.check) {
    console.log("Simulacao concluida. Nenhum arquivo foi alterado.");
  }
}

const invokedModule = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : null;

if (import.meta.url === invokedModule) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
