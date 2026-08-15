const REQUIRED_TEXT_FIELDS = [
  "id",
  "title",
  "composer",
  "genre",
  "key",
  "level",
  "instrumentation",
  "source",
];

export const PUBLIC_CATALOG_SCHEMA_VERSION = 2;

const AVAILABILITY_STATUSES = new Set([
  "disponivel",
  "sem_edicao",
  "em_revisao",
  "bloqueada",
]);

const PUBLIC_ACTIONS = [
  "exibir_partitura",
  "reproduzir_playback",
  "imprimir",
  "baixar_pdf",
  "distribuir_musicxml",
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
 * @property {{kind: "lead_sheet" | "partitura_instrumental_original", instrument?: "piano" | "violao"}} notationProfile
 * @property {string} source
 * @property {string | undefined} [musicxml]
 * @property {string} notes
 * @property {string[]} chords
 * @property {string[]} tags
 * @property {string | undefined} [sourceHash]
 * @property {{status: "disponivel" | "sem_edicao" | "em_revisao" | "bloqueada", reason: string, actions: {exibir_partitura: boolean, reproduzir_playback: boolean, imprimir: boolean, baixar_pdf: boolean, distribuir_musicxml: boolean}}} availability
 */

/** @typedef {{ schemaVersion: 2, songs: Song[] }} Catalog */

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
 * @param {{allowLegacy?: boolean}} [options]
 * @returns {Catalog}
 */
export function parseCatalog(value, { allowLegacy = false } = {}) {
  const issues = [];

  if (!isRecord(value) || !Array.isArray(value.songs)) {
    throw new CatalogValidationError(["songs deve ser um array"]);
  }

  const isLegacy = value.schemaVersion === undefined;
  if (
    value.schemaVersion !== PUBLIC_CATALOG_SCHEMA_VERSION &&
    !(allowLegacy && isLegacy)
  ) {
    issues.push(
      `schemaVersion deve ser ${PUBLIC_CATALOG_SCHEMA_VERSION}`,
    );
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

    if (
      allowLegacy &&
      isLegacy &&
      (typeof candidate.musicxml !== "string" || !candidate.musicxml.trim())
    ) {
      issues.push(`${prefix}.musicxml deve ser texto nao vazio`);
    }

    if (typeof candidate.notes !== "string") {
      issues.push(`${prefix}.notes deve ser texto`);
    }

    if (candidate.notationProfile === undefined) {
      candidate.notationProfile = { kind: "lead_sheet" };
    } else if (!isRecord(candidate.notationProfile)) {
      issues.push(`${prefix}.notationProfile deve ser um objeto`);
    } else if (
      !new Set(["lead_sheet", "partitura_instrumental_original"]).has(
        candidate.notationProfile.kind,
      )
    ) {
      issues.push(`${prefix}.notationProfile.kind possui valor invalido`);
    } else if (
      candidate.notationProfile.kind === "partitura_instrumental_original" &&
      !new Set(["piano", "violao"]).has(candidate.notationProfile.instrument)
    ) {
      issues.push(`${prefix}.notationProfile.instrument possui valor invalido`);
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

    if (!allowLegacy || !isLegacy) {
      if (!isRecord(candidate.availability)) {
        issues.push(`${prefix}.availability deve ser um objeto`);
      } else {
        if (!AVAILABILITY_STATUSES.has(candidate.availability.status)) {
          issues.push(`${prefix}.availability.status possui valor invalido`);
        }
        if (
          typeof candidate.availability.reason !== "string" ||
          !candidate.availability.reason.trim()
        ) {
          issues.push(`${prefix}.availability.reason deve ser texto nao vazio`);
        }

        const actions = candidate.availability.actions;
        if (!isRecord(actions)) {
          issues.push(`${prefix}.availability.actions deve ser um objeto`);
        } else {
          PUBLIC_ACTIONS.forEach((action) => {
            if (typeof actions[action] !== "boolean") {
              issues.push(
                `${prefix}.availability.actions.${action} deve ser booleano`,
              );
            }
          });

          const deliversMusicXml =
            actions.exibir_partitura === true ||
            actions.reproduzir_playback === true ||
            actions.imprimir === true ||
            actions.distribuir_musicxml === true;

          if (deliversMusicXml && typeof candidate.musicxml !== "string") {
            issues.push(
              `${prefix}.musicxml e obrigatorio para as acoes publicas permitidas`,
            );
          }
          if (!deliversMusicXml && candidate.musicxml !== undefined) {
            issues.push(
              `${prefix}.musicxml nao pode expor asset sem acao publica permitida`,
            );
          }
          if (
            actions.exibir_partitura === true &&
            actions.imprimir !== true
          ) {
            issues.push(
              `${prefix} nao pode exibir partitura sem permitir impressao na arquitetura estatica`,
            );
          }
          if (actions.imprimir === true && actions.exibir_partitura !== true) {
            issues.push(
              `${prefix} nao pode permitir impressao sem exibir partitura`,
            );
          }
          if (
            (actions.exibir_partitura === true ||
              actions.reproduzir_playback === true ||
              actions.imprimir === true) &&
            actions.distribuir_musicxml !== true
          ) {
            issues.push(
              `${prefix} entrega MusicXML ao navegador sem permitir sua distribuicao`,
            );
          }
          if (actions.baixar_pdf === true) {
            issues.push(
              `${prefix}.availability.actions.baixar_pdf ainda nao possui asset publico suportado`,
            );
          }
        }
      }
    }

    if (candidate.musicxml !== undefined) {
      if (typeof candidate.musicxml !== "string") {
        issues.push(`${prefix}.musicxml deve ser texto`);
      } else {
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
