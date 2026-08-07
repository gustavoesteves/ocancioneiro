import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseEditorialDossier } from "../lib/editorial-dossier.mjs";

export const defaultDossierDirectory = path.join(
  process.cwd(),
  "data",
  "dossiers",
);

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

export async function listDossierFiles(directory = defaultDossierDirectory) {
  if (!(await pathExists(directory))) {
    return [];
  }

  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return listDossierFiles(entryPath);
      }

      if (entry.isFile() && entry.name.endsWith(".json")) {
        return [entryPath];
      }

      return [];
    }),
  );

  return files.flat().sort();
}

export async function loadEditorialDossiers(
  directory = defaultDossierDirectory,
) {
  const files = await listDossierFiles(directory);
  const dossiers = [];
  const issues = [];
  const workIds = new Map();

  for (const filePath of files) {
    try {
      const dossier = parseEditorialDossier(
        JSON.parse(await fs.readFile(filePath, "utf8")),
      );
      dossiers.push({ dossier, filePath });

      const existingPath = workIds.get(dossier.work.id);
      if (existingPath) {
        issues.push(
          `${path.relative(directory, filePath)} duplica work.id ${dossier.work.id} de ${path.relative(directory, existingPath)}`,
        );
      } else {
        workIds.set(dossier.work.id, filePath);
      }
    } catch (error) {
      const relativePath = path.relative(directory, filePath);
      issues.push(
        `${relativePath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (issues.length > 0) {
    throw new Error(`Dossies editoriais invalidos:\n- ${issues.join("\n- ")}`);
  }

  return dossiers;
}

export async function main({ directory = defaultDossierDirectory } = {}) {
  const dossiers = await loadEditorialDossiers(directory);
  console.log(`Dossies editoriais validados: ${dossiers.length}`);
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
