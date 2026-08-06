const REQUIRED_TEXT_FIELDS = [
  "id",
  "title",
  "composer",
  "genre",
  "key",
  "level",
  "instrumentation",
  "source",
  "musicxml",
];

/**
 * @typedef {object} Song
 * @property {string} id
 * @property {string} title
 * @property {string} composer
 * @property {string} genre
 * @property {string} key
 * @property {string} level
 * @property {string} instrumentation
 * @property {string} source
 * @property {string} musicxml
 * @property {string} notes
 * @property {string[]} chords
 * @property {string[]} tags
 * @property {string | undefined} [sourceHash]
 */

/** @typedef {{ songs: Song[] }} Catalog */

export class CatalogValidationError extends Error {
  /** @param {string[]} issues */
  constructor(issues) {
    super(`Catalogo invalido:\n- ${issues.join("\n- ")}`);
    this.name = "CatalogValidationError";
    this.issues = issues;
  }
}

/** @param {unknown} value */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** @param {string} value */
function isSafeMusicXmlPath(value) {
  if (!value.startsWith("/musicxml/") || value.includes("\\")) {
    return false;
  }

  try {
    const decodedPath = decodeURIComponent(value);
    return !decodedPath
      .split("/")
      .some((segment) => segment === "." || segment === "..");
  } catch {
    return false;
  }
}

/**
 * Validates the catalog at the boundary where JSON enters the application.
 * @param {unknown} value
 * @returns {Catalog}
 */
export function parseCatalog(value) {
  const issues = [];

  if (!isRecord(value) || !Array.isArray(value.songs)) {
    throw new CatalogValidationError(["songs deve ser um array"]);
  }

  const ids = new Set();
  const paths = new Set();

  value.songs.forEach((candidate, index) => {
    const prefix = `songs[${index}]`;

    if (!isRecord(candidate)) {
      issues.push(`${prefix} deve ser um objeto`);
      return;
    }

    for (const field of REQUIRED_TEXT_FIELDS) {
      if (
        typeof candidate[field] !== "string" ||
        candidate[field].trim().length === 0
      ) {
        issues.push(`${prefix}.${field} deve ser texto nao vazio`);
      }
    }

    if (typeof candidate.notes !== "string") {
      issues.push(`${prefix}.notes deve ser texto`);
    }

    if (candidate.chords === undefined) {
      candidate.chords = [];
    } else if (
      !Array.isArray(candidate.chords) ||
      !candidate.chords.every(
        (chord) => typeof chord === "string" && chord.trim().length > 0,
      )
    ) {
      issues.push(`${prefix}.chords deve ser um array de textos nao vazios`);
    }

    if (
      !Array.isArray(candidate.tags) ||
      !candidate.tags.every(
        (tag) => typeof tag === "string" && tag.trim().length > 0,
      )
    ) {
      issues.push(`${prefix}.tags deve ser um array de textos nao vazios`);
    }

    if (
      candidate.sourceHash !== undefined &&
      (typeof candidate.sourceHash !== "string" ||
        !/^[a-f0-9]{64}$/.test(candidate.sourceHash))
    ) {
      issues.push(`${prefix}.sourceHash deve ser um SHA-256 hexadecimal`);
    }

    if (typeof candidate.id === "string") {
      if (ids.has(candidate.id)) {
        issues.push(`${prefix}.id duplicado: ${candidate.id}`);
      }
      ids.add(candidate.id);
    }

    if (typeof candidate.musicxml === "string") {
      if (!isSafeMusicXmlPath(candidate.musicxml)) {
        issues.push(
          `${prefix}.musicxml deve apontar para um caminho seguro em /musicxml/`,
        );
      }
      if (paths.has(candidate.musicxml)) {
        issues.push(`${prefix}.musicxml duplicado: ${candidate.musicxml}`);
      }
      paths.add(candidate.musicxml);
    }
  });

  if (issues.length > 0) {
    throw new CatalogValidationError(issues);
  }

  return /** @type {Catalog} */ (value);
}

/**
 * @param {Song[]} songs
 * @param {string} query
 * @param {string} level
 * @param {string} genre
 */
export function filterSongs(songs, query, level, genre) {
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");

  return songs.filter((song) => {
    const matchesQuery =
      normalizedQuery.length === 0 ||
      [
        song.title,
        song.composer,
        song.genre,
        song.key,
        song.instrumentation,
        song.chords.join(" "),
        song.tags.join(" "),
      ]
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(normalizedQuery);

    const matchesLevel = level === "Todos" || song.level === level;
    const matchesGenre = genre === "Todos" || song.genre === genre;

    return matchesQuery && matchesLevel && matchesGenre;
  });
}

/**
 * @param {Song[]} filteredSongs
 * @param {string | null} activeSongId
 * @returns {Song | null}
 */
export function resolveActiveSong(filteredSongs, activeSongId) {
  return (
    filteredSongs.find((song) => song.id === activeSongId) ??
    filteredSongs[0] ??
    null
  );
}
