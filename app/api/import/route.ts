import { promises as fs } from "node:fs";
import path from "node:path";
import { parseCatalog } from "../../../lib/catalog.mjs";
import { linkMusicXmlToDossier } from "../../../lib/dossier-musicxml-link.mjs";
import { summarizeEditorialDossiers } from "../../../lib/editorial-dossier-summary.mjs";
import {
  dossierConflictMessage,
  findDossierImportConflict,
} from "../../../lib/import-dossier-conflicts.mjs";
import { main as generateCatalog } from "../../../scripts/generate-catalog.mjs";
import { loadEditorialDossiers } from "../../../scripts/validate-dossiers.mjs";
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
  dossierWorkId?: string;
  id?: string;
  overwrite?: boolean;
  xml?: string;
};

type UpdatePayload = ImportPayload & {
  currentId?: string;
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

function projectPaths() {
  const projectRoot = process.cwd();

  return {
    catalogPath: path.join(projectRoot, "public", "catalog.json"),
    editorialPath: path.join(projectRoot, "data", "editorial.json"),
    musicXmlDirectory: path.join(projectRoot, "public", "musicxml"),
    projectRoot,
  };
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

async function readCatalog(catalogPath: string) {
  return parseCatalog(JSON.parse(await fs.readFile(catalogPath, "utf8")));
}

function editorialEntry(payload: ImportPayload) {
  return {
    genre: textField(payload.editorial?.genre, defaultEditorialFields.genre),
    level: textField(payload.editorial?.level, defaultEditorialFields.level),
    notes:
      typeof payload.editorial?.notes === "string"
        ? payload.editorial.notes
        : defaultEditorialFields.notes,
    source: textField(payload.editorial?.source, defaultEditorialFields.source),
    tags: tagsField(payload.editorial?.tags),
  };
}

function musicXmlPathFromPublicPath(projectRoot: string, publicPath: string) {
  const decodedPath = decodeURIComponent(publicPath.replace(/^\//, ""));
  const filePath = path.join(projectRoot, "public", decodedPath);
  const musicXmlDirectory = path.join(projectRoot, "public", "musicxml");
  const relativePath = path.relative(musicXmlDirectory, filePath);

  if (
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath) ||
    !/\.(musicxml|xml)$/i.test(filePath)
  ) {
    throw new Error("Caminho MusicXML inseguro");
  }

  return filePath;
}

async function prepareMusicXml(
  payloadXml: unknown,
  fallbackPath: string,
  fallbackFileName: string,
) {
  if (typeof payloadXml === "string" && payloadXml.trim()) {
    assertMusicXmlDocument(fallbackFileName, payloadXml);
    return musicXmlWithDisplayMetadata(payloadXml, fallbackFileName);
  }

  return fs.readFile(fallbackPath, "utf8");
}

async function renameExistingCatalogEntry(
  catalogPath: string,
  currentId: string,
  nextId: string,
  nextMusicXml: string,
) {
  if (currentId === nextId) return;

  const catalog = await readCatalog(catalogPath);
  const songs = catalog.songs.map((song) =>
    song.id === currentId
      ? { ...song, id: nextId, musicxml: nextMusicXml }
      : song,
  );

  await writeJsonAtomically(catalogPath, { songs });
}

function requireLocalRequest(request: Request) {
  if (isLocalRequest(request)) return null;

  return Response.json(
    { error: "Importacao disponivel apenas em ambiente local." },
    { status: 403 },
  );
}

export async function GET(request: Request) {
  const localError = requireLocalRequest(request);
  if (localError) return localError;

  try {
    const { catalogPath, editorialPath } = projectPaths();
    const [catalog, manifest, dossierEntries] = await Promise.all([
      readCatalog(catalogPath),
      readEditorialManifest(editorialPath),
      loadEditorialDossiers(),
    ]);

    return Response.json({
      dossiers: summarizeEditorialDossiers(dossierEntries),
      songs: catalog.songs.map((song) => ({
        ...song,
        editorial: manifest.songs?.[song.id] ?? {
          genre: song.genre,
          level: song.level,
          notes: song.notes,
          source: song.source,
          tags: song.tags,
        },
        path: `public${song.musicxml}`,
      })),
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro inesperado" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const localError = requireLocalRequest(request);
  if (localError) return localError;

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

    const { editorialPath, musicXmlDirectory } = projectPaths();
    const dossierEntries = await loadEditorialDossiers();
    const dossierWorkId =
      typeof payload.dossierWorkId === "string" ? payload.dossierWorkId.trim() : "";
    const dossierEntry = dossierWorkId
      ? dossierEntries.find((entry) => entry.dossier.work.id === dossierWorkId)
      : null;

    if (dossierWorkId && !dossierEntry) {
      return Response.json({ error: "Dossie editorial nao encontrado." }, { status: 404 });
    }

    const dossierConflict = findDossierImportConflict(dossierEntries, id);
    if (
      dossierConflict &&
      (!dossierEntry || dossierConflict.workId !== dossierEntry.dossier.work.id)
    ) {
      return Response.json(
        { error: dossierConflictMessage(dossierConflict) },
        { status: 409 },
      );
    }

    const musicXmlPath = path.join(
      musicXmlDirectory,
      `${id}.musicxml`,
    );

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

    if (dossierEntry) {
      const linkedDossier = linkMusicXmlToDossier(dossierEntry.dossier, {
        generatedAt: new Date().toISOString().slice(0, 10),
        publicId: id,
        publicPath: `/musicxml/${id}.musicxml`,
        xml: displayXml,
      });
      await writeJsonAtomically(dossierEntry.filePath, linkedDossier);
      await generateCatalog();

      return Response.json({
        catalog: "public/catalog.json",
        dossier: dossierEntry.filePath,
        id,
        musicxml: `/musicxml/${id}.musicxml`,
        path: `public/musicxml/${id}.musicxml`,
        title: metadata.title,
        workId: linkedDossier.work.id,
      });
    }

    const manifest = await readEditorialManifest(editorialPath);
    const songs = {
      ...(manifest.songs ?? {}),
      [id]: editorialEntry(payload),
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

export async function PUT(request: Request) {
  const localError = requireLocalRequest(request);
  if (localError) return localError;

  try {
    const payload = (await request.json()) as UpdatePayload;
    const currentId = slugify(payload.currentId || "");

    if (!currentId) {
      return Response.json({ error: "currentId e obrigatorio" }, { status: 400 });
    }

    const {
      catalogPath,
      editorialPath,
      musicXmlDirectory,
      projectRoot,
    } = projectPaths();
    const catalog = await readCatalog(catalogPath);
    const existingSong = catalog.songs.find((song) => song.id === currentId);

    if (!existingSong) {
      return Response.json({ error: "Musica nao encontrada" }, { status: 404 });
    }

    const nextId = slugify(payload.id || currentId);
    if (!nextId) {
      return Response.json({ error: "id invalido" }, { status: 400 });
    }
    if (nextId !== currentId) {
      const dossierConflict = findDossierImportConflict(
        await loadEditorialDossiers(),
        nextId,
      );
      if (dossierConflict) {
        return Response.json(
          { error: dossierConflictMessage(dossierConflict) },
          { status: 409 },
        );
      }
    }

    const currentMusicXmlPath = musicXmlPathFromPublicPath(
      projectRoot,
      existingSong.musicxml,
    );
    const nextMusicXmlPath = path.join(musicXmlDirectory, `${nextId}.musicxml`);
    const nextMusicXmlPublicPath = `/musicxml/${nextId}.musicxml`;
    const displayXml = await prepareMusicXml(
      payload.xml,
      currentMusicXmlPath,
      `${nextId}.musicxml`,
    );

    if (currentMusicXmlPath !== nextMusicXmlPath) {
      try {
        await fs.access(nextMusicXmlPath);
        return Response.json(
          {
            error: `public/musicxml/${nextId}.musicxml ja existe.`,
          },
          { status: 409 },
        );
      } catch (error) {
        if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
          throw error;
        }
      }
    }

    await fs.mkdir(path.dirname(nextMusicXmlPath), { recursive: true });
    await writeTextAtomically(nextMusicXmlPath, displayXml);

    if (currentMusicXmlPath !== nextMusicXmlPath) {
      await fs.rm(currentMusicXmlPath, { force: true });
    }

    const manifest = await readEditorialManifest(editorialPath);
    const songs = { ...(manifest.songs ?? {}) };
    delete songs[currentId];
    songs[nextId] = editorialEntry(payload);

    await writeJsonAtomically(editorialPath, { ...manifest, songs });
    await renameExistingCatalogEntry(
      catalogPath,
      currentId,
      nextId,
      nextMusicXmlPublicPath,
    );
    await generateCatalog();

    return Response.json({
      catalog: "public/catalog.json",
      editorial: `data/editorial.json#songs.${nextId}`,
      id: nextId,
      musicxml: nextMusicXmlPublicPath,
      path: `public/musicxml/${nextId}.musicxml`,
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro inesperado" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const localError = requireLocalRequest(request);
  if (localError) return localError;

  try {
    const url = new URL(request.url);
    const body =
      request.headers.get("content-type")?.includes("application/json")
        ? ((await request.json()) as { id?: string })
        : {};
    const id = slugify(body.id || url.searchParams.get("id") || "");

    if (!id) {
      return Response.json({ error: "id e obrigatorio" }, { status: 400 });
    }

    const { catalogPath, editorialPath, projectRoot } = projectPaths();
    const catalog = await readCatalog(catalogPath);
    const existingSong = catalog.songs.find((song) => song.id === id);

    if (!existingSong) {
      return Response.json({ error: "Musica nao encontrada" }, { status: 404 });
    }

    await fs.rm(musicXmlPathFromPublicPath(projectRoot, existingSong.musicxml), {
      force: true,
    });

    const manifest = await readEditorialManifest(editorialPath);
    const songs = { ...(manifest.songs ?? {}) };
    delete songs[id];
    await writeJsonAtomically(editorialPath, { ...manifest, songs });
    await generateCatalog();

    return Response.json({
      catalog: "public/catalog.json",
      deleted: id,
      editorial: `data/editorial.json#songs.${id}`,
      musicxml: existingSong.musicxml,
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro inesperado" },
      { status: 500 },
    );
  }
}
