import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  checkDocLinks,
  linksFromMarkdown,
} from "../scripts/check-doc-links.mjs";

async function fixtureProject(files) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "o-cancioneiro-docs-"));

  await Promise.all(
    Object.entries(files).map(async ([relativePath, contents]) => {
      const filePath = path.join(root, relativePath);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, contents);
    }),
  );

  return root;
}

test("extracts markdown links and ignores fenced examples", () => {
  assert.deepEqual(
    linksFromMarkdown(`
[Ok](docs/alvo.md)

\`\`\`md
[Ignorado](docs/ausente.md)
\`\`\`
`),
    [{ href: "docs/alvo.md", index: 1 }],
  );
});

test("validates relative document links and anchors", async () => {
  const projectRoot = await fixtureProject({
    "README.md": "[Doc](docs/alvo.md#secao-principal)",
    "docs/alvo.md": "# Secao principal\n",
  });

  const result = await checkDocLinks({ projectRoot });

  assert.deepEqual(result.issues, []);
  assert.equal(result.checkedFiles, 2);
});

test("reports missing internal links", async () => {
  const projectRoot = await fixtureProject({
    "README.md": "[Quebrado](docs/ausente.md)",
  });

  const result = await checkDocLinks({ projectRoot });

  assert.deepEqual(result.issues, [
    "README.md:1: link interno nao encontrado: docs/ausente.md",
  ]);
});
