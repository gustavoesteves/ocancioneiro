import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCatalog } from "../lib/catalog.mjs";
import { effectivePermission } from "../lib/editorial-dossier.mjs";
import { loadEditorialDossiers } from "./validate-dossiers.mjs";

function relativePublicPath(publicPath) {
  return decodeURIComponent(publicPath).replace(/^\/+/, "");
}

async function listFiles(directory) {
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(
      entries.map((entry) => {
        const entryPath = path.join(directory, entry.name);
        return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
      }),
    );
    return nested.flat();
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

function allowedMusicXmlPaths(catalog) {
  return new Set(
    catalog.songs
      .filter((song) => song.availability.actions.distribuir_musicxml)
      .map((song) => song.musicxml),
  );
}

function forbiddenDossierPaths(dossiers) {
  const forbidden = new Set();

  dossiers.forEach((dossier) => {
    (dossier.assets ?? []).forEach((asset) => {
      if (asset.type !== "musicxml" || typeof asset.path !== "string") return;

      const edition = (dossier.editions ?? []).find(
        (candidate) => candidate.id === asset.editionId,
      );
      const publicable =
        asset.status === "valido" &&
        edition?.status === "valida" &&
        effectivePermission(dossier.rights, "distribuir_musicxml") ===
          "permitida";

      if (!publicable) forbidden.add(asset.path);
    });
  });

  return forbidden;
}

export async function verifyPublicPackage({
  libraryOnly = false,
  outputDirectory,
  projectRoot = process.cwd(),
  sourceTree = false,
} = {}) {
  if (!outputDirectory) {
    throw new Error("Diretorio do pacote publico e obrigatorio");
  }

  const absoluteOutput = path.resolve(projectRoot, outputDirectory);
  const catalogPath = path.join(absoluteOutput, "catalog.json");
  const catalog = parseCatalog(JSON.parse(await fs.readFile(catalogPath, "utf8")));
  const dossierEntries = await loadEditorialDossiers(
    path.join(projectRoot, "data", "dossiers"),
  );
  const dossiers = dossierEntries.map((entry) => entry.dossier);
  const allowed = allowedMusicXmlPaths(catalog);
  const forbidden = forbiddenDossierPaths(dossiers);
  const issues = [];
  const packagedFiles = await listFiles(absoluteOutput);

  packagedFiles.forEach((filePath) => {
    const relative = path
      .relative(absoluteOutput, filePath)
      .split(path.sep)
      .join("/");
    if (relative === ".local" || relative.startsWith(".local/")) {
      issues.push(`${relative} expoe a area privada local`);
    }
  });

  if (libraryOnly) {
    const importRoutePattern = /(^|\/)import(?:\/|$)/;
    packagedFiles.forEach((filePath) => {
      const relative = path
        .relative(absoluteOutput, filePath)
        .split(path.sep)
        .join("/");
      if (importRoutePattern.test(relative)) {
        issues.push(`${relative} expoe a rota local de importacao`);
      }
    });

    const textAssets = packagedFiles.filter((filePath) =>
      /\.(?:html|js|mjs|cjs)$/i.test(filePath),
    );
    for (const filePath of textAssets) {
      const contents = await fs.readFile(filePath, "utf8");
      const localOnlyMarkers = [
        "/api/import",
        "Importar MusicXML",
        "127.0.0.1:47631",
        "cancioneiro.musescore.capture/1",
        "Capturar do MuseScore",
      ];
      if (localOnlyMarkers.some((marker) => contents.includes(marker))) {
        const relative = path
          .relative(absoluteOutput, filePath)
          .split(path.sep)
          .join("/");
        issues.push(`${relative} contem codigo da ferramenta local de importacao`);
      }
    }
  }

  for (const publicPath of allowed) {
    const assetPath = path.join(absoluteOutput, relativePublicPath(publicPath));
    try {
      const stats = await fs.stat(assetPath);
      if (!stats.isFile()) {
        issues.push(`${publicPath} nao e arquivo regular no pacote`);
      }
    } catch (error) {
      if (error.code === "ENOENT") {
        issues.push(`${publicPath} permitido, mas ausente do pacote`);
      } else {
        throw error;
      }
    }
  }

  if (!sourceTree) {
    for (const publicPath of forbidden) {
      const assetPath = path.join(absoluteOutput, relativePublicPath(publicPath));
      try {
        await fs.access(assetPath);
        issues.push(`${publicPath} bloqueado, mas presente no pacote`);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }

    const packagedMusicXml = await listFiles(path.join(absoluteOutput, "musicxml"));
    packagedMusicXml.forEach((filePath) => {
      const relative = path.relative(absoluteOutput, filePath).split(path.sep).join("/");
      const publicPath = `/${relative}`;
      if (!allowed.has(publicPath)) {
        issues.push(`${publicPath} esta no pacote sem entrada publica autorizada`);
      }
    });
  }

  if (issues.length > 0) {
    throw new Error(`Pacote publico inseguro:\n- ${issues.join("\n- ")}`);
  }

  return {
    assetCount: allowed.size,
    catalogCount: catalog.songs.length,
    outputDirectory: absoluteOutput,
  };
}

export async function main() {
  const outputDirectory = process.argv[2] ?? "github-pages";
  const result = await verifyPublicPackage({
    libraryOnly: process.argv.includes("--library-only"),
    outputDirectory,
    sourceTree: process.argv.includes("--source-tree"),
  });
  console.log(
    `Pacote publico validado: ${result.catalogCount} obra(s), ${result.assetCount} MusicXML autorizado(s).`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
