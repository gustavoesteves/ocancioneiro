import { promises as fs } from "node:fs";
import path from "node:path";

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

function decodeXml(text) {
  return text
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
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

function slugifyFilename(filename) {
  return path
    .basename(filename, path.extname(filename))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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
    const catalog = JSON.parse(await fs.readFile(catalogPath, "utf8"));
    return Array.isArray(catalog.songs) ? catalog.songs : [];
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

function buildSongEntry(filePath, xml, existingEntry) {
  const filename = path.basename(filePath);
  const publicPath = publicPathFromFile(filePath);
  const fallbackId = slugifyFilename(filename);
  const title =
    textFromTag(xml, "work-title") ||
    textFromTag(xml, "movement-title") ||
    titleFromFilename(filename);

  return {
    id: existingEntry?.id || fallbackId,
    title: existingEntry?.title || title,
    composer:
      existingEntry?.composer ||
      textFromCreator(xml, "composer") ||
      textFromTag(xml, "creator") ||
      "Nao informado",
    genre: existingEntry?.genre || defaultEditorialFields.genre,
    key: existingEntry?.key || keyFromMusicXml(xml),
    level: existingEntry?.level || defaultEditorialFields.level,
    instrumentation:
      existingEntry?.instrumentation || instrumentationFromMusicXml(xml),
    source: existingEntry?.source || defaultEditorialFields.source,
    musicxml: publicPath,
    notes: existingEntry?.notes || defaultEditorialFields.notes,
    tags: Array.isArray(existingEntry?.tags)
      ? existingEntry.tags
      : defaultEditorialFields.tags,
  };
}

async function main() {
  const existingSongs = await readExistingCatalog();
  const existingByPath = new Map(
    existingSongs.map((song) => [song.musicxml, song]),
  );
  const files = await listMusicXmlFiles(musicXmlDirectory);

  const songs = await Promise.all(
    files.map(async (filePath) => {
      const xml = await fs.readFile(filePath, "utf8");
      const publicPath = publicPathFromFile(filePath);

      return buildSongEntry(filePath, xml, existingByPath.get(publicPath));
    }),
  );

  songs.sort((first, second) =>
    first.title.localeCompare(second.title, "pt-BR", { sensitivity: "base" }),
  );

  await fs.writeFile(
    catalogPath,
    `${JSON.stringify({ songs }, null, 2)}\n`,
    "utf8",
  );

  console.log(`Catalogo atualizado com ${songs.length} musica(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
