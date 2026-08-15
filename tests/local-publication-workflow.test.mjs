import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import {
  getLocalPublicationStatus,
  prepareLocalPublication,
  remoteChecksReady,
  verifyLocalPublication,
} from "../lib/local-publication-workflow.mjs";

const execute = promisify(execFile);

async function git(projectRoot, ...args) {
  return execute("git", args, { cwd: projectRoot, encoding: "utf8" });
}

async function projectFixture() {
  const projectRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "o-cancioneiro-publication-"),
  );
  await git(projectRoot, "init", "-b", "main");
  await git(projectRoot, "config", "user.name", "Editor Fixture");
  await git(projectRoot, "config", "user.email", "editor@example.invalid");
  await fs.writeFile(path.join(projectRoot, "README.md"), "inicial\n");
  await fs.writeFile(path.join(projectRoot, ".gitignore"), ".local/\n");
  await git(projectRoot, "add", "README.md", ".gitignore");
  await git(projectRoot, "commit", "-m", "Initial fixture");
  return projectRoot;
}

async function successfulCheck() {
  return { exitCode: 0, stderr: "", stdout: "171 testes aprovados\n" };
}

test("invalida a verificacao quando o conteudo muda", async () => {
  const projectRoot = await projectFixture();
  try {
    await fs.writeFile(path.join(projectRoot, "README.md"), "primeira mudanca\n");
    const verified = await verifyLocalPublication({
      projectRoot,
      runCheck: successfulCheck,
    });
    assert.equal(verified.verification.current, true);

    await fs.writeFile(path.join(projectRoot, "README.md"), "segunda mudanca\n");
    const changed = await getLocalPublicationStatus({ projectRoot });
    assert.equal(changed.verification.current, false);
  } finally {
    await fs.rm(projectRoot, { force: true, recursive: true });
  }
});

test("reprova espacos finais em arquivo novo antes de executar a suite", async () => {
  const projectRoot = await projectFixture();
  try {
    await fs.mkdir(path.join(projectRoot, "docs"));
    await fs.writeFile(path.join(projectRoot, "docs", "operacao.md"), "manual  \n");
    let suiteExecuted = false;

    await assert.rejects(
      verifyLocalPublication({
        projectRoot,
        runCheck: async () => {
          suiteExecuted = true;
          return successfulCheck();
        },
      }),
      (error) => {
        assert.equal(error.code, "PUBLICATION_CHECK_FAILED");
        assert.match(error.message, /docs\/operacao\.md:1: trailing whitespace/);
        return true;
      },
    );

    assert.equal(suiteExecuted, false);
    const status = await getLocalPublicationStatus({ projectRoot });
    assert.equal(status.verification.passed, false);
    assert.match(status.verification.summary, /trailing whitespace/);
  } finally {
    await fs.rm(projectRoot, { force: true, recursive: true });
  }
});

test("prepara branch e commit apenas depois da verificacao atual", async () => {
  const projectRoot = await projectFixture();
  try {
    await fs.mkdir(path.join(projectRoot, "docs"));
    await fs.writeFile(path.join(projectRoot, "README.md"), "atualizado\n");
    await fs.writeFile(path.join(projectRoot, "docs", "operacao.md"), "manual\n");
    const verified = await verifyLocalPublication({
      projectRoot,
      runCheck: successfulCheck,
    });
    const prepared = await prepareLocalPublication({
      branchName: "codex/publicacao-fixture",
      expectedFingerprint: verified.fingerprint,
      message: "Preparar publicacao editorial",
      projectRoot,
      responsible: "Editor Fixture",
    });

    assert.equal(prepared.branch, "codex/publicacao-fixture");
    assert.equal(prepared.clean, true);
    assert.equal(prepared.release.commit, prepared.head);
    const committed = await git(
      projectRoot,
      "show",
      "--pretty=format:",
      "--name-only",
      "HEAD",
    );
    assert.match(committed.stdout, /README\.md/);
    assert.match(committed.stdout, /docs\/operacao\.md/);
  } finally {
    await fs.rm(projectRoot, { force: true, recursive: true });
  }
});

test("retoma a preparacao quando uma exclusao ja esta no indice", async () => {
  const projectRoot = await projectFixture();
  try {
    await fs.rm(path.join(projectRoot, "README.md"));
    await git(projectRoot, "add", "-A", "--", "README.md");
    await fs.mkdir(path.join(projectRoot, "docs"));
    await fs.writeFile(path.join(projectRoot, "docs", "operacao.md"), "manual\n");

    const verified = await verifyLocalPublication({
      projectRoot,
      runCheck: successfulCheck,
    });
    const prepared = await prepareLocalPublication({
      branchName: "codex/publicacao-retomada",
      expectedFingerprint: verified.fingerprint,
      message: "Retomar publicacao editorial",
      projectRoot,
      responsible: "Editor Fixture",
    });

    assert.equal(prepared.clean, true);
    const committed = await git(
      projectRoot,
      "show",
      "--pretty=format:",
      "--name-status",
      "HEAD",
    );
    assert.match(committed.stdout, /D\s+README\.md/);
    assert.match(committed.stdout, /A\s+docs\/operacao\.md/);
  } finally {
    await fs.rm(projectRoot, { force: true, recursive: true });
  }
});

test("bloqueia arquivos de ambiente e reconhece checks remotos", async () => {
  const projectRoot = await projectFixture();
  try {
    await fs.writeFile(path.join(projectRoot, ".env"), "TOKEN=segredo\n");
    const status = await getLocalPublicationStatus({ projectRoot });
    assert.equal(status.changes[0].eligible, false);
    assert.match(status.changes[0].blockReason, /secreto/);
  } finally {
    await fs.rm(projectRoot, { force: true, recursive: true });
  }

  assert.equal(
    remoteChecksReady([
      { conclusion: "SUCCESS", status: "COMPLETED" },
      { conclusion: "SKIPPED", status: "COMPLETED" },
    ]),
    true,
  );
  assert.equal(
    remoteChecksReady([{ conclusion: null, status: "IN_PROGRESS" }]),
    false,
  );
});
