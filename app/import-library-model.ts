export type ImportLibrarySong = {
  composer: string;
  id: string;
  musicxml?: string;
  title: string;
};

export type ImportLibraryDossier = {
  assetCount: number;
  creators: { name: string; role: string }[];
  editionCount: number;
  projectionIssues: string[];
  publicCatalogId: string | null;
  publicable: boolean;
  status: string;
  title: string;
  workId: string;
};

export type ImportLibraryFilter =
  | "all"
  | "blocked"
  | "no_asset"
  | "published"
  | "review";

export type ImportLibraryEntry<
  Song extends ImportLibrarySong = ImportLibrarySong,
  Dossier extends ImportLibraryDossier = ImportLibraryDossier,
> = {
  blocked: boolean;
  creator: string;
  dossier: Dossier | null;
  key: string;
  searchText: string;
  song: Song | null;
  title: string;
};

export function normalizeImportSearch(value: string) {
  return value
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function dossierIsBlocked(dossier: ImportLibraryDossier) {
  return dossier.projectionIssues.some((issue) =>
    /bloque|direito|permiss/i.test(issue),
  );
}

export function buildImportLibraryEntries<
  Song extends ImportLibrarySong,
  Dossier extends ImportLibraryDossier,
>(songs: Song[], dossiers: Dossier[]): ImportLibraryEntry<Song, Dossier>[] {
  const songsById = new Map(songs.map((song) => [song.id, song]));
  const matchedSongIds = new Set<string>();
  const entries: ImportLibraryEntry<Song, Dossier>[] = dossiers.map((dossier) => {
    const song = dossier.publicCatalogId
      ? (songsById.get(dossier.publicCatalogId) ?? null)
      : null;
    if (song) matchedSongIds.add(song.id);
    const creator =
      song?.composer || dossier.creators.map((item) => item.name).join(", ") ||
      "Autoria nao informada";
    const title = dossier.title || song?.title || dossier.workId;
    return {
      blocked: dossierIsBlocked(dossier),
      creator,
      dossier,
      key: dossier.workId,
      searchText: normalizeImportSearch(
        [
          title,
          creator,
          dossier.workId,
          dossier.publicCatalogId,
          song?.id,
        ]
          .filter(Boolean)
          .join(" "),
      ),
      song,
      title,
    };
  });

  for (const song of songs) {
    if (matchedSongIds.has(song.id)) continue;
    entries.push({
      blocked: false,
      creator: song.composer,
      dossier: null,
      key: `catalog:${song.id}`,
      searchText: normalizeImportSearch(
        [song.title, song.composer, song.id].join(" "),
      ),
      song,
      title: song.title,
    });
  }

  return entries.sort((left, right) =>
    left.title.localeCompare(right.title, "pt-BR", { sensitivity: "base" }),
  );
}

export function filterImportLibraryEntries<
  Song extends ImportLibrarySong,
  Dossier extends ImportLibraryDossier,
>(
  entries: ImportLibraryEntry<Song, Dossier>[],
  { filter, query }: { filter: ImportLibraryFilter; query: string },
) {
  const normalizedQuery = normalizeImportSearch(query);
  return entries.filter((entry) => {
    if (normalizedQuery && !entry.searchText.includes(normalizedQuery)) return false;
    switch (filter) {
      case "published":
        return Boolean(entry.song && entry.dossier?.publicable);
      case "review":
        return Boolean(entry.dossier && !entry.dossier.publicable && !entry.blocked);
      case "blocked":
        return entry.blocked;
      case "no_asset":
        return entry.song === null;
      default:
        return true;
    }
  });
}
