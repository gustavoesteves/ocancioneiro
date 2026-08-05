import {
  filterSongs,
  parseCatalog,
  resolveActiveSong,
} from "../lib/catalog.mjs";

export { filterSongs, parseCatalog, resolveActiveSong };

export type Catalog = ReturnType<typeof parseCatalog>;
export type Song = Catalog["songs"][number];
