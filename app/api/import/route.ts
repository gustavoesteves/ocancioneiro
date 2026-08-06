import { promises as fs } from "node:fs";
import path from "node:path";
import { main as generateCatalog } from "../../../scripts/generate-catalog.mjs";
import {
  assertMusicXmlDocument,
  defaultEditorialFields,
  metadataFromMusicXml,
  musicXmlWithDisplayMetadata,
  slugify,
} from "../../../lib/musicxml-metadata.mjs";

type ImportPayload = {
  editorial?: {
    genre?: string;
    level?: string;
    notes?: string;
    source?: string;
    tags?: string[];
  };
  id?: string;
  overwrite?: boolean;
  xml?: string;
};

const localHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

function isLocalRequest(request: Request) {
  const url = new URL(request.url);
  return localHosts.has(url.hostname);
}

function textField(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function tagsField(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
    .filter(Boolean);
}

async function writeJsonAtomically(filePath: string, value: unknown) {
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  try {
    await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await fs.rename(temporaryPath, filePath);
  } finally {
    await fs.rm(temporaryPath, { force: true });
  }
}

async function writeTextAtomically(filePath: string, value: string) {
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  try {
    await fs.writeFile(temporaryPath, value, "utf8");
    await fs.rename(temporaryPath, filePath);
  } finally {
    await fs.rm(temporaryPath, { force: true });
  }
}

async function readEditorialManifest(editorialPath: string) {
  try {
    return JSON.parse(await fs.readFile(editorialPath, "utf8")) as {
      songs?: Record<string, unknown>;
    };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return { songs: {} };
    }
    throw error;
  }
}

export async function POST(request: Request) {
  if (!isLocalRequest(request)) {
    return Response.json(
      { error: "Importacao disponivel apenas em ambiente local." },
      { status: 403 },
    );
  }

  try {
    const payload = (await request.json()) as ImportPayload;
    const xml = typeof payload.xml === "string" ? payload.xml : "";

    if (!xml.trim()) {
      return Response.json({ error: "xml e obrigatorio" }, { status: 400 });
    }

    assertMusicXmlDocument("import.musicxml", xml);
    const metadata = metadataFromMusicXml(xml, "import.musicxml");
    const displayXml = musicXmlWithDisplayMetadata(xml, "import.musicxml");
    const id = slugify(payload.id || metadata.id);

    if (!id) {
      return Response.json({ error: "id invalido" }, { status: 400 });
    }

    const projectRoot = process.cwd();
    const musicXmlPath = path.join(
      projectRoot,
      "public",
      "musicxml",
      `${id}.musicxml`,
    );
    const editorialPath = path.join(projectRoot, "data", "editorial.json");

    if (!payload.overwrite) {
      try {
        await fs.access(musicXmlPath);
        return Response.json(
          {
            error: `public/musicxml/${id}.musicxml ja existe. Marque sobrescrever para atualizar.`,
          },
          { status: 409 },
        );
      } catch (error) {
        if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
          throw error;
        }
      }
    }

    await fs.mkdir(path.dirname(musicXmlPath), { recursive: true });
    await writeTextAtomically(musicXmlPath, displayXml);

    const manifest = await readEditorialManifest(editorialPath);
    const songs = {
      ...(manifest.songs ?? {}),
      [id]: {
        genre: textField(payload.editorial?.genre, defaultEditorialFields.genre),
        level: textField(payload.editorial?.level, defaultEditorialFields.level),
        notes:
          typeof payload.editorial?.notes === "string"
            ? payload.editorial.notes
            : defaultEditorialFields.notes,
        source: textField(payload.editorial?.source, defaultEditorialFields.source),
        tags: tagsField(payload.editorial?.tags),
      },
    };

    await writeJsonAtomically(editorialPath, { ...manifest, songs });
    await generateCatalog();

    return Response.json({
      catalog: "public/catalog.json",
      editorial: `data/editorial.json#songs.${id}`,
      id,
      musicxml: `/musicxml/${id}.musicxml`,
      path: `public/musicxml/${id}.musicxml`,
      title: metadata.title,
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro inesperado" },
      { status: 500 },
    );
  }
}
