import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  PUBLIC_CATALOG_SCHEMA_VERSION,
  parseCatalog,
} from "../lib/catalog.mjs";
import {
  publicCatalogFromDossiers,
} from "../lib/dossier-catalog-projection.mjs";
import {
  assertMusicXmlDocument,
  chordsFromMusicXml,
  decodeXml,
  defaultEditorialFields,
  instrumentationFromMusicXml,
  keyFromMusicXml,
  metadataFromMusicXml,
  slugify,
} from "../lib/musicxml-metadata.mjs";
import { loadEditorialDossiers } from "./validate-dossiers.mjs";

export { chordsFromMusicXml, decodeXml };

const editorialFields = new Set(["genre", "level", "notes", "source", "tags"]);

export function sourceHash(xml) {
  return createHash("sha256").update(xml).digest("hex");
}

export function fallbackIdFromFile(filePath, hash, projectRoot = process.cwd()) {
  const musicXmlDirectory = path.join(projectRoot, "public", "musicxml");
  const relativePath = path.relative(musicXmlDirectory, filePath);
  const withoutExtension = relativePath.slice(
    0,
    -path.extname(relativePath).length,
  );
  return slugify(withoutExtension) || `peca-${hash.slice(0, 12)}`;
}

async function listMusicXmlFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return listMusicXmlFiles(entryPath);
      }

      if (entry.isFile() && /\.(musicxml|xml)$/i.test(entry.name)) {
        return [entryPath];
      }

      return [];
    }),
  );

  return files.flat();
}

async function readExistingCatalog(catalogPath) {
  try {
    const catalog = parseCatalog(
      JSON.parse(await fs.readFile(catalogPath, "utf8")),
      { allowLegacy: true },
    );
    return catalog.songs;
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function readEditorialManifest(editorialPath) {
  try {
    return validateEditorialManifest(
      JSON.parse(await fs.readFile(editorialPath, "utf8")),
    );
  } catch (error) {
    if (error.code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateEditorialManifest(manifest) {
  const issues = [];

  if (!isRecord(manifest)) {
    throw new Error("data/editorial.json deve conter um objeto");
  }

  const topLevelFields = Object.keys(manifest);
  const invalidTopLevelFields = topLevelFields.filter((field) => field !== "songs");
  invalidTopLevelFields.forEach((field) => {
    issues.push(`campo desconhecido em data/editorial.json: ${field}`);
  });

  if (!isRecord(manifest.songs)) {
    issues.push("data/editorial.json deve conter um objeto songs");
  } else {
    Object.entries(manifest.songs).forEach(([id, entry]) => {
      const prefix = `songs.${id}`;

      if (!id.trim()) {
        issues.push("songs contem um id vazio");
        return;
      }

      if (!isRecord(entry)) {
        issues.push(`${prefix} deve ser um objeto`);
        return;
      }

      Object.keys(entry)
        .filter((field) => !editorialFields.has(field))
        .forEach((field) => {
          issues.push(`${prefix}.${field} nao e um campo editorial valido`);
        });

      ["genre", "level", "source"].forEach((field) => {
        if (
          entry[field] !== undefined &&
          (typeof entry[field] !== "string" || entry[field].trim().length === 0)
        ) {
          issues.push(`${prefix}.${field} deve ser texto nao vazio`);
        }
      });

      if (entry.notes !== undefined && typeof entry.notes !== "string") {
        issues.push(`${prefix}.notes deve ser texto`);
      }

      if (
        entry.tags !== undefined &&
        (!Array.isArray(entry.tags) ||
          !entry.tags.every(
            (tag) => typeof tag === "string" && tag.trim().length > 0,
          ))
      ) {
        issues.push(`${prefix}.tags deve ser um array de textos nao vazios`);
      }
    });
  }

  if (issues.length > 0) {
    throw new Error(`Manifesto editorial invalido:\n- ${issues.join("\n- ")}`);
  }

  return manifest.songs;
}

function warnAboutUnusedEditorialEntries(editorialManifest, songs) {
  const songIds = new Set(songs.map((song) => song.id));
  const unusedIds = Object.keys(editorialManifest).filter((id) => !songIds.has(id));

  if (unusedIds.length > 0) {
    console.warn(
      `Aviso: entradas editoriais sem MusicXML correspondente: ${unusedIds.join(
        ", ",
      )}`,
    );
  }
}

export function editorialTodoReport(songs, editorialManifest) {
  return songs
    .map((song) => {
      const manifestEntry = editorialManifest[song.id];
      const defaultFields = [];

      if (!manifestEntry) {
        defaultFields.push("genre", "level", "source", "notes", "tags");
      } else {
        for (const field of ["genre", "level", "source"]) {
          if (song[field] === defaultEditorialFields[field]) {
            defaultFields.push(field);
          }
        }

        if (song.notes === defaultEditorialFields.notes) {
          defaultFields.push("notes");
        }

        if (song.tags.length === 0) {
          defaultFields.push("tags");
        }
      }

      return {
        defaultFields,
        hasEditorialEntry: Boolean(manifestEntry),
        id: song.id,
        title: song.title,
      };
    })
    .filter((item) => item.defaultFields.length > 0);
}

function printEditorialTodoReport(songs, editorialManifest) {
  const report = editorialTodoReport(songs, editorialManifest);

  if (report.length === 0) {
    console.log("Metadados editoriais completos para todas as musicas.");
    return;
  }

  console.log("\nPendencias editoriais:");
  report.forEach((item) => {
    const status = item.hasEditorialEntry
      ? `campos em aberto: ${item.defaultFields.join(", ")}`
      : "sem entrada em data/editorial.json";
    console.log(`- ${item.id} (${item.title}): ${status}`);
  });

  const missingEntries = report.filter((item) => !item.hasEditorialEntry);
  if (missingEntries.length === 0) return;

  console.log("\nSugestao para data/editorial.json:");
  missingEntries.forEach((item) => {
    const snippet = {
      [item.id]: {
        genre: defaultEditorialFields.genre,
        level: defaultEditorialFields.level,
        notes: "",
        source: defaultEditorialFields.source,
        tags: [],
      },
    };
    console.log(JSON.stringify(snippet, null, 2));
  });
}

function publicPathFromFile(filePath, projectRoot = process.cwd()) {
  const relativePath = path.relative(path.join(projectRoot, "public"), filePath);
  return `/${relativePath.split(path.sep).join("/")}`;
}

function editorialFromManifest(editorialManifest, id, existingEntry) {
  return editorialManifest[id] ?? existingEntry ?? {};
}

export function buildSongEntry(
  filePath,
  xml,
  existingEntry,
  hash,
  editorialManifest = {},
  projectRoot = process.cwd(),
) {
  const filename = path.basename(filePath);
  const publicPath = publicPathFromFile(filePath, projectRoot);
  const fallbackId = fallbackIdFromFile(filePath, hash, projectRoot);
  const sourceMetadata = metadataFromMusicXml(xml, filename);
  const id = existingEntry?.id || fallbackId;
  const editorial = editorialFromManifest(editorialManifest, id, existingEntry);

  return {
    id,
    title: sourceMetadata.title,
    composer: sourceMetadata.composer,
    genre: editorial.genre || defaultEditorialFields.genre,
    key: keyFromMusicXml(xml),
    level: editorial.level || defaultEditorialFields.level,
    instrumentation: instrumentationFromMusicXml(xml),
    source: editorial.source || defaultEditorialFields.source,
    musicxml: publicPath,
    notes: editorial.notes || defaultEditorialFields.notes,
    chords: chordsFromMusicXml(xml),
    tags: Array.isArray(editorial.tags)
      ? editorial.tags
      : defaultEditorialFields.tags,
    sourceHash: hash,
  };
}

async function writeCatalogAtomically(catalogPath, contents) {
  const temporaryPath = `${catalogPath}.${process.pid}.tmp`;
  try {
    await fs.writeFile(temporaryPath, contents, "utf8");
    await fs.rename(temporaryPath, catalogPath);
  } finally {
    await fs.rm(temporaryPath, { force: true });
  }
}

export function matchExistingEntries(inputs, existingSongs) {
  const existingByPath = new Map(
    existingSongs.map((song) => [song.musicxml, song]),
  );
  const existingByHash = new Map();
  existingSongs.forEach((song) => {
    if (!song.sourceHash) return;
    const matches = existingByHash.get(song.sourceHash) ?? [];
    matches.push(song);
    existingByHash.set(song.sourceHash, matches);
  });

  const claimedExistingEntries = new Set();
  const matchesByPath = new Map();

  for (const input of inputs) {
    const exactMatch = existingByPath.get(input.publicPath);
    if (exactMatch) {
      matchesByPath.set(input.publicPath, exactMatch);
      claimedExistingEntries.add(exactMatch);
    }
  }

  for (const input of inputs) {
    if (matchesByPath.has(input.publicPath)) continue;
    const hashMatches = (existingByHash.get(input.hash) ?? []).filter(
      (song) => !claimedExistingEntries.has(song),
    );
    if (hashMatches.length === 1) {
      matchesByPath.set(input.publicPath, hashMatches[0]);
      claimedExistingEntries.add(hashMatches[0]);
    }
  }

  return matchesByPath;
}

export function buildCatalog(_generatedSongs, dossiers = []) {
  const projectedSongs = publicCatalogFromDossiers(dossiers).songs;
  const songs = [...projectedSongs];

  songs.sort((first, second) =>
    first.title.localeCompare(second.title, "pt-BR", { sensitivity: "base" }),
  );

  return parseCatalog({ schemaVersion: PUBLIC_CATALOG_SCHEMA_VERSION, songs });
}

export async function main({ check = false, projectRoot = process.cwd() } = {}) {
  const musicXmlDirectory = path.join(projectRoot, "public", "musicxml");
  const catalogPath = path.join(projectRoot, "public", "catalog.json");
  const editorialPath = path.join(projectRoot, "data", "editorial.json");
  const dossierDirectory = path.join(projectRoot, "data", "dossiers");
  const existingSongs = await readExistingCatalog(catalogPath);
  const editorialManifest = await readEditorialManifest(editorialPath);
  const dossierEntries = await loadEditorialDossiers(dossierDirectory);
  const dossiers = dossierEntries.map((entry) => entry.dossier);
  const files = await listMusicXmlFiles(musicXmlDirectory);

  const inputs = await Promise.all(
    files.map(async (filePath) => {
      const xml = await fs.readFile(filePath, "utf8");
      const publicPath = publicPathFromFile(filePath, projectRoot);
      assertMusicXmlDocument(filePath, xml);
      return { filePath, hash: sourceHash(xml), publicPath, xml };
    }),
  );

  const matchesByPath = matchExistingEntries(inputs, existingSongs);

  const songs = inputs.map(({ filePath, hash, publicPath, xml }) =>
    buildSongEntry(
      filePath,
      xml,
      matchesByPath.get(publicPath),
      hash,
      editorialManifest,
      projectRoot,
    ),
  );

  const catalog = buildCatalog(songs, dossiers);
  const contents = `${JSON.stringify(catalog, null, 2)}\n`;

  warnAboutUnusedEditorialEntries(editorialManifest, catalog.songs);
  printEditorialTodoReport(catalog.songs, editorialManifest);

  if (check) {
    const currentContents = await fs.readFile(catalogPath, "utf8");
    if (currentContents !== contents) {
      throw new Error(
        "public/catalog.json esta desatualizado. Rode `npm run catalog:generate`.",
      );
    }
  } else {
    await writeCatalogAtomically(catalogPath, contents);
  }

  console.log(
    check
      ? `Catalogo validado com ${catalog.songs.length} musica(s).`
      : `Catalogo atualizado com ${catalog.songs.length} musica(s).`,
  );
}

const invokedModule = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : null;

if (import.meta.url === invokedModule) {
  main({ check: process.argv.includes("--check") }).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
