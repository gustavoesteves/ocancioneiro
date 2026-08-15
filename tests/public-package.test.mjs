import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { decisionRecordHash } from "../lib/editorial-dossier.mjs";
import { stagePublicAssets } from "../scripts/stage-public-assets.mjs";
import { verifyPublicPackage } from "../scripts/verify-public-package.mjs";

function dossier({ allowed, path: assetPath }) {
  const decision = {
    id: "decisao-aceita",
    status: "aceita",
    justification: "Fixture aceita.",
    decidedBy: "editor",
    decidedAt: "2026-08-13",
    reviews: [
      {
        conflictOfInterest: false,
        reviewedAt: "2026-08-13",
        reviewedBy: "revisor",
        role: "revisor",
        summary: "Revisao independente.",
      },
    ],
  };
  const permission = allowed ? "permitida" : "bloqueada";

  return {
    schemaVersion: 1,
    publicCatalogId: allowed ? "permitida" : "bloqueada",
    work: {
      id: allowed ? "obra-permitida" : "obra-bloqueada",
      preferredTitle: allowed ? "Permitida" : "Bloqueada",
      creators: [{ name: "Compositor", role: "composer" }],
    },
    curation: {
      status: "em_revisao",
      currentDecisionId: decision.id,
      decisions: [{ ...decision, recordHash: decisionRecordHash(decision) }],
    },
    editions: [
      {
        id: "edicao",
        status: "valida",
        title: allowed ? "Permitida" : "Bloqueada",
      },
    ],
    assets: [
      {
        id: "asset",
        editionId: "edicao",
        type: "musicxml",
        status: "valido",
        path: assetPath,
        checksum: "a".repeat(64),
        checksumAlgorithm: "sha256",
        generatedAt: "2026-08-13",
        generatedBy: "fixture",
      },
    ],
    rights: {
      status: allowed ? "liberado" : "bloqueado",
      actions: {
        exibir_metadados: "permitida",
        exibir_partitura: permission,
        reproduzir_playback: permission,
        imprimir: permission,
        distribuir_musicxml: permission,
      },
    },
  };
}

async function projectFixture() {
  const projectRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "o-cancioneiro-public-package-"),
  );
  const publicDirectory = path.join(projectRoot, "public");
  const dossierDirectory = path.join(projectRoot, "data", "dossiers");
  await fs.mkdir(path.join(publicDirectory, "musicxml"), { recursive: true });
  await fs.mkdir(dossierDirectory, { recursive: true });
  await fs.writeFile(path.join(publicDirectory, "favicon.svg"), "<svg/>");
  await fs.writeFile(path.join(publicDirectory, "musicxml", "permitida.musicxml"), "permitida");
  await fs.writeFile(path.join(publicDirectory, "musicxml", "bloqueada.musicxml"), "bloqueada");
  await fs.writeFile(
    path.join(dossierDirectory, "obra-permitida.json"),
    JSON.stringify(dossier({ allowed: true, path: "/musicxml/permitida.musicxml" })),
  );
  await fs.writeFile(
    path.join(dossierDirectory, "obra-bloqueada.json"),
    JSON.stringify(dossier({ allowed: false, path: "/musicxml/bloqueada.musicxml" })),
  );
  await fs.writeFile(
    path.join(publicDirectory, "catalog.json"),
    JSON.stringify({
      schemaVersion: 2,
      songs: [
        {
          id: "permitida",
          title: "Permitida",
          composer: "Compositor",
          genre: "Teste",
          key: "C maior",
          level: "Teste",
          instrumentation: "Melodia e cifras",
          source: "Fixture",
          musicxml: "/musicxml/permitida.musicxml",
          notes: "",
          chords: [],
          tags: [],
          availability: {
            status: "disponivel",
            reason: "Disponivel.",
            actions: {
              exibir_partitura: true,
              reproduzir_playback: true,
              imprimir: true,
              baixar_pdf: false,
              distribuir_musicxml: true,
            },
          },
        },
        {
          id: "bloqueada",
          title: "Bloqueada",
          composer: "Compositor",
          genre: "Teste",
          key: "Nao informado",
          level: "Teste",
          instrumentation: "Lead sheet",
          source: "Fixture",
          notes: "",
          chords: [],
          tags: [],
          availability: {
            status: "bloqueada",
            reason: "Indisponivel.",
            actions: {
              exibir_partitura: false,
              reproduzir_playback: false,
              imprimir: false,
              baixar_pdf: false,
              distribuir_musicxml: false,
            },
          },
        },
      ],
    }),
  );

  return projectRoot;
}

test("stages only MusicXML assets explicitly authorized by the catalog", async () => {
  const projectRoot = await projectFixture();
  const outputDirectory = path.join(projectRoot, "package");

  await stagePublicAssets({ outputDirectory, projectRoot });
  const result = await verifyPublicPackage({ outputDirectory, projectRoot });

  assert.equal(result.assetCount, 1);
  await fs.access(path.join(outputDirectory, "musicxml", "permitida.musicxml"));
  await assert.rejects(
    () => fs.access(path.join(outputDirectory, "musicxml", "bloqueada.musicxml")),
    /ENOENT/,
  );
});

test("rejects a package containing a blocked MusicXML URL", async () => {
  const projectRoot = await projectFixture();
  const outputDirectory = path.join(projectRoot, "package");
  await stagePublicAssets({ outputDirectory, projectRoot });
  await fs.copyFile(
    path.join(projectRoot, "public", "musicxml", "bloqueada.musicxml"),
    path.join(outputDirectory, "musicxml", "bloqueada.musicxml"),
  );

  await assert.rejects(
    () => verifyPublicPackage({ outputDirectory, projectRoot }),
    /bloqueado, mas presente no pacote/,
  );
});

test("allows historical or blocked MusicXML only in the source tree", async () => {
  const projectRoot = await projectFixture();

  const result = await verifyPublicPackage({
    outputDirectory: path.join(projectRoot, "public"),
    projectRoot,
    sourceTree: true,
  });

  assert.equal(result.assetCount, 1);
  await fs.access(path.join(projectRoot, "public", "musicxml", "bloqueada.musicxml"));
});

test("rejects the local importer route and code in a library-only package", async () => {
  const projectRoot = await projectFixture();
  const outputDirectory = path.join(projectRoot, "package");
  await stagePublicAssets({ outputDirectory, projectRoot });
  await fs.mkdir(path.join(outputDirectory, "import"), { recursive: true });
  await fs.writeFile(
    path.join(outputDirectory, "import", "index.html"),
    "<script>fetch('/api/import');fetch('http://127.0.0.1:47631')</script><p>Importar MusicXML</p>",
  );

  await assert.rejects(
    () =>
      verifyPublicPackage({
        libraryOnly: true,
        outputDirectory,
        projectRoot,
      }),
    /expoe a rota local de importacao|contem codigo da ferramenta local/,
  );
});

test("rejects a private capture directory copied into the public package", async () => {
  const projectRoot = await projectFixture();
  const outputDirectory = path.join(projectRoot, "package");
  await stagePublicAssets({ outputDirectory, projectRoot });
  const leakedDirectory = path.join(
    outputDirectory,
    ".local",
    "cancioneiro",
    "captures",
    "capture_test_0000000001",
  );
  await fs.mkdir(leakedDirectory, { recursive: true });
  await fs.writeFile(
    path.join(leakedDirectory, "raw.musicxml"),
    "conteudo privado",
  );

  await assert.rejects(
    () => verifyPublicPackage({ outputDirectory, projectRoot }),
    /expoe a area privada local/,
  );
});
