import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { resolveLocalProjectRoot } from "../lib/local-project-root.mjs";

async function projectFixture() {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cancioneiro-root-"));
  await Promise.all([
    fs.mkdir(path.join(projectRoot, "public"), { recursive: true }),
    fs.mkdir(path.join(projectRoot, "data", "dossiers"), { recursive: true }),
  ]);
  return projectRoot;
}

test("prefere a raiz configurada explicitamente", async () => {
  const projectRoot = await projectFixture();
  try {
    assert.equal(
      await resolveLocalProjectRoot({
        cwd: "/bundle",
        env: { CANCIONEIRO_PROJECT_ROOT: projectRoot },
      }),
      await fs.realpath(projectRoot),
    );
  } finally {
    await fs.rm(projectRoot, { recursive: true, force: true });
  }
});

test("usa INIT_CWD quando o runtime esta no bundle virtual", async () => {
  const projectRoot = await projectFixture();
  try {
    assert.equal(
      await resolveLocalProjectRoot({
        cwd: "/bundle",
        env: { INIT_CWD: projectRoot },
      }),
      await fs.realpath(projectRoot),
    );
  } finally {
    await fs.rm(projectRoot, { recursive: true, force: true });
  }
});

test("falha de forma acionavel quando nenhuma raiz e valida", async () => {
  await assert.rejects(
    () =>
      resolveLocalProjectRoot({
        cwd: "/bundle",
        env: {},
      }),
    /CANCIONEIRO_PROJECT_ROOT/,
  );
});
