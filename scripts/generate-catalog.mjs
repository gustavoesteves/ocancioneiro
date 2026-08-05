import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseCatalog } from "../lib/catalog.mjs";

const projectRoot = process.cwd();
const musicXmlDirectory = path.join(projectRoot, "public", "musicxml");
const catalogPath = path.join(projectRoot, "public", "catalog.json");

const defaultEditorialFields = {
  genre: "Nao classificado",
  level: "Nao classificado",
  notes: "",
  source: "Acervo",
  tags: [],
};

const keyNames = {
  "-7": "Cb",
  "-6": "Gb",
  "-5": "Db",
  "-4": "Ab",
  "-3": "Eb",
  "-2": "Bb",
  "-1": "F",
  0: "C",
  1: "G",
  2: "D",
  3: "A",
  4: "E",
  5: "B",
  6: "F#",
  7: "C#",
};

export function decodeXml(text) {
  const namedEntities = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    quot: '"',
  };

  return text.replace(
    /&(#x[0-9a-f]+|#[0-9]+|amp|apos|gt|lt|quot);/gi,
    (entity, code) => {
      if (code.startsWith("#x") || code.startsWith("#X")) {
        return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
      }
      if (code.startsWith("#")) {
        return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
      }
      return namedEntities[code.toLowerCase()];
    },
  );
}

function textFromTag(xml, tagName) {
  const match = xml.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`));
  return match ? decodeXml(match[1].replace(/<[^>]+>/g, "").trim()) : "";
}

function textFromCreator(xml, creatorType) {
  const creatorPattern = new RegExp(
    `<creator[^>]*type=["']${creatorType}["'][^>]*>([\\s\\S]*?)</creator>`,
    "i",
  );
  const match = xml.match(creatorPattern);
  return match ? decodeXml(match[1].replace(/<[^>]+>/g, "").trim()) : "";
}

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function sourceHash(xml) {
  return createHash("sha256").update(xml).digest("hex");
}

export function fallbackIdFromFile(filePath, hash) {
  const relativePath = path.relative(musicXmlDirectory, filePath);
  const withoutExtension = relativePath.slice(
    0,
    -path.extname(relativePath).length,
  );
  return slugify(withoutExtension) || `peca-${hash.slice(0, 12)}`;
}

function titleFromFilename(filename) {
  return path
    .basename(filename, path.extname(filename))
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function keyFromMusicXml(xml) {
  const fifths = textFromTag(xml, "fifths");
  const mode = textFromTag(xml, "mode");

  if (!fifths || !(fifths in keyNames)) {
    return "Nao informado";
  }

  return `${keyNames[fifths]} ${mode === "minor" ? "menor" : "maior"}`;
}

function instrumentationFromMusicXml(xml) {
  const partNames = [...xml.matchAll(/<part-name[^>]*>([\s\S]*?)<\/part-name>/g)]
    .map((match) => decodeXml(match[1].replace(/<[^>]+>/g, "").trim()))
    .filter(Boolean);

  if (partNames.length === 0) {
    return "Nao informado";
  }

  return [...new Set(partNames)].join(", ");
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

async function readExistingCatalog() {
  try {
    const catalog = parseCatalog(
      JSON.parse(await fs.readFile(catalogPath, "utf8")),
    );
    return catalog.songs;
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

function publicPathFromFile(filePath) {
  const relativePath = path.relative(path.join(projectRoot, "public"), filePath);
  return `/${relativePath.split(path.sep).join("/")}`;
}

function assertMusicXmlDocument(filePath, xml) {
  const root = xml.match(/<score-(partwise|timewise)\b[^>]*>/i)?.[1];
  if (!root || !new RegExp(`</score-${root}>\\s*$`, "i").test(xml)) {
    throw new Error(`${filePath} nao contem um documento MusicXML completo`);
  }
}

export function buildSongEntry(filePath, xml, existingEntry, hash) {
  const filename = path.basename(filePath);
  const publicPath = publicPathFromFile(filePath);
  const fallbackId = fallbackIdFromFile(filePath, hash);
  const title =
    textFromTag(xml, "work-title") ||
    textFromTag(xml, "movement-title") ||
    titleFromFilename(filename);

  return {
    id: existingEntry?.id || fallbackId,
    title,
    composer:
      textFromCreator(xml, "composer") ||
      textFromTag(xml, "creator") ||
      "Nao informado",
    genre: existingEntry?.genre || defaultEditorialFields.genre,
    key: keyFromMusicXml(xml),
    level: existingEntry?.level || defaultEditorialFields.level,
    instrumentation: instrumentationFromMusicXml(xml),
    source: existingEntry?.source || defaultEditorialFields.source,
    musicxml: publicPath,
    notes: existingEntry?.notes || defaultEditorialFields.notes,
    tags: Array.isArray(existingEntry?.tags)
      ? existingEntry.tags
      : defaultEditorialFields.tags,
    sourceHash: hash,
  };
}

async function writeCatalogAtomically(contents) {
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

export async function main({ check = false } = {}) {
  const existingSongs = await readExistingCatalog();
  const files = await listMusicXmlFiles(musicXmlDirectory);

  const inputs = await Promise.all(
    files.map(async (filePath) => {
      const xml = await fs.readFile(filePath, "utf8");
      const publicPath = publicPathFromFile(filePath);
      assertMusicXmlDocument(filePath, xml);
      return { filePath, hash: sourceHash(xml), publicPath, xml };
    }),
  );

  const matchesByPath = matchExistingEntries(inputs, existingSongs);

  const songs = inputs.map(({ filePath, hash, publicPath, xml }) =>
    buildSongEntry(filePath, xml, matchesByPath.get(publicPath), hash),
  );

  songs.sort((first, second) =>
    first.title.localeCompare(second.title, "pt-BR", { sensitivity: "base" }),
  );

  const catalog = parseCatalog({ songs });
  const contents = `${JSON.stringify(catalog, null, 2)}\n`;

  if (check) {
    const currentContents = await fs.readFile(catalogPath, "utf8");
    if (currentContents !== contents) {
      throw new Error(
        "public/catalog.json esta desatualizado. Rode `npm run catalog:generate`.",
      );
    }
  } else {
    await writeCatalogAtomically(contents);
  }

  console.log(
    check
      ? `Catalogo validado com ${songs.length} musica(s).`
      : `Catalogo atualizado com ${songs.length} musica(s).`,
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
