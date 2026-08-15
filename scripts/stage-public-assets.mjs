import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCatalog } from "../lib/catalog.mjs";

function relativePublicPath(publicPath) {
  return decodeURIComponent(publicPath).replace(/^\/+/, "");
}

export async function stagePublicAssets({
  outputDirectory,
  projectRoot = process.cwd(),
} = {}) {
  if (!outputDirectory) {
    throw new Error("Diretorio do pacote publico e obrigatorio");
  }

  const absoluteOutput = path.resolve(projectRoot, outputDirectory);
  const publicDirectory = path.join(projectRoot, "public");
  const catalog = parseCatalog(
    JSON.parse(await fs.readFile(path.join(publicDirectory, "catalog.json"), "utf8")),
  );

  await fs.mkdir(absoluteOutput, { recursive: true });
  await fs.rm(path.join(absoluteOutput, "musicxml"), {
    force: true,
    recursive: true,
  });
  await fs.copyFile(
    path.join(publicDirectory, "catalog.json"),
    path.join(absoluteOutput, "catalog.json"),
  );
  await fs.copyFile(
    path.join(publicDirectory, "favicon.svg"),
    path.join(absoluteOutput, "favicon.svg"),
  );

  let assetCount = 0;
  for (const song of catalog.songs) {
    if (!song.availability.actions.distribuir_musicxml || !song.musicxml) {
      continue;
    }

    const relativePath = relativePublicPath(song.musicxml);
    const sourcePath = path.join(publicDirectory, relativePath);
    const destinationPath = path.join(absoluteOutput, relativePath);
    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    await fs.copyFile(sourcePath, destinationPath);
    assetCount += 1;
  }

  return {
    assetCount,
    catalogCount: catalog.songs.length,
    outputDirectory: absoluteOutput,
  };
}

export async function main() {
  const outputDirectory = process.argv[2];
  const result = await stagePublicAssets({ outputDirectory });
  console.log(
    `Assets publicos preparados: ${result.catalogCount} obra(s), ${result.assetCount} MusicXML autorizado(s).`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
