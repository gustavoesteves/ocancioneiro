import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

const publicationRoot = path.join(".local", "cancioneiro", "publication");
const allowedSuccessConclusions = new Set(["NEUTRAL", "SKIPPED", "SUCCESS"]);
const forbiddenPathSegments = new Set([
  ".git",
  ".github",
  ".local",
  ".wrangler",
  "dist",
  "github-pages",
  "node_modules",
  "outputs",
]);

export class LocalPublicationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "LocalPublicationError";
    this.code = code;
  }
}

function requireText(value, field, maximum = 120) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maximum) {
    throw new LocalPublicationError("INVALID_PUBLICATION", `${field} invalido.`);
  }
  return value.trim();
}

function normalizedRelativePath(value) {
  if (typeof value !== "string" || !value || value.includes("\\")) return null;
  const normalized = path.posix.normalize(value);
  if (
    normalized === "." ||
    normalized.startsWith("../") ||
    path.posix.isAbsolute(normalized)
  ) {
    return null;
  }
  return normalized;
}

function pathBlockReason(value) {
  const normalized = normalizedRelativePath(value);
  if (!normalized) return "caminho inseguro";
  const segments = normalized.split("/");
  if (segments.some((segment) => forbiddenPathSegments.has(segment))) {
    return "area local, gerada ou interna";
  }
  if (segments.some((segment) => segment === ".env" || segment.startsWith(".env."))) {
    return "arquivo de ambiente potencialmente secreto";
  }
  if (/\.(?:key|p12|pem|pfx)$/i.test(normalized)) {
    return "arquivo de credencial potencialmente secreto";
  }
  return null;
}

function categoryForPath(filePath) {
  if (filePath.startsWith("data/dossiers/") || filePath === "public/catalog.json") {
    return "editorial";
  }
  if (filePath.startsWith("public/musicxml/")) return "partituras";
  if (filePath.startsWith("docs/") || filePath === "README.md") return "documentacao";
  if (filePath.startsWith("tests/")) return "testes";
  if (
    filePath.startsWith("app/api/import/") ||
    filePath.startsWith("app/components/Import") ||
    filePath.startsWith("plugins/") ||
    filePath.includes("capture") ||
    filePath.includes("publication")
  ) {
    return "importador";
  }
  return "aplicacao";
}

function commandSummary(value, maximumLines = 30) {
  const ansiEscapePattern = new RegExp(
    `${String.fromCharCode(27)}\\[[0-9;]*m`,
    "g",
  );
  return String(value ?? "")
    .replaceAll(ansiEscapePattern, "")
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(-maximumLines)
    .join("\n")
    .slice(-8_000);
}

export function runPublicationCommand(
  command,
  args,
  { allowFailure = false, cwd, timeoutMs = 120_000 } = {},
) {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      {
        cwd,
        encoding: "utf8",
        env: {
          ...process.env,
          GH_PROMPT_DISABLED: "1",
          GIT_TERMINAL_PROMPT: "0",
        },
        maxBuffer: 32 * 1024 * 1024,
        timeout: timeoutMs,
      },
      (error, stdout, stderr) => {
        const result = {
          exitCode: typeof error?.code === "number" ? error.code : error ? 1 : 0,
          stderr: String(stderr ?? ""),
          stdout: String(stdout ?? ""),
        };
        if (!error || allowFailure) {
          resolve(result);
          return;
        }
        reject(
          new LocalPublicationError(
            "PUBLICATION_COMMAND_FAILED",
            commandSummary(stderr || stdout || error.message, 12) ||
              `Falha ao executar ${command}.`,
          ),
        );
      },
    );
  });
}

function parsePorcelain(output) {
  const records = String(output).split("\0");
  const changes = [];

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record || record.length < 4) continue;
    const code = record.slice(0, 2);
    const filePath = normalizedRelativePath(record.slice(3));
    if (!filePath) continue;
    let previousPath = null;
    if (/[RC]/.test(code)) {
      previousPath = normalizedRelativePath(records[index + 1]);
      index += 1;
    }
    const blockReason = pathBlockReason(filePath);
    changes.push({
      blockReason,
      category: categoryForPath(filePath),
      code,
      eligible: blockReason === null,
      path: filePath,
      previousPath,
      staged: code !== "??" && code[0] !== " ",
      unstaged: code === "??" || code[1] !== " ",
    });
  }

  return changes.sort((left, right) => left.path.localeCompare(right.path, "pt-BR"));
}

async function git(projectRoot, args, options = {}) {
  return runPublicationCommand("git", args, { cwd: projectRoot, ...options });
}

async function readJson(filePath) {
  return fs
    .readFile(filePath, "utf8")
    .then(JSON.parse)
    .catch((error) => {
      if (error?.code === "ENOENT") return null;
      throw error;
    });
}

async function writeJsonAtomically(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { mode: 0o700, recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  try {
    await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await fs.rename(temporaryPath, filePath);
  } finally {
    await fs.rm(temporaryPath, { force: true });
  }
}

async function worktreeFingerprint(projectRoot, head, changes) {
  const digest = createHash("sha256");
  digest.update(head);
  const trackedDiff = await git(projectRoot, ["diff", "--binary", "HEAD", "--"]);
  digest.update(trackedDiff.stdout);

  for (const change of changes) {
    digest.update(`${change.code}\0${change.path}\0${change.previousPath ?? ""}\0`);
    if (change.code !== "??") continue;
    const absolutePath = path.join(projectRoot, change.path);
    const stats = await fs.lstat(absolutePath);
    if (stats.isSymbolicLink() || !stats.isFile()) {
      digest.update("unsupported");
      continue;
    }
    digest.update(await fs.readFile(absolutePath));
  }
  return digest.digest("hex");
}

async function blockChangedSymlinks(projectRoot, changes) {
  return Promise.all(
    changes.map(async (change) => {
      if (!change.eligible || change.code.includes("D")) return change;
      const stats = await fs.lstat(path.join(projectRoot, change.path)).catch((error) => {
        if (error?.code === "ENOENT") return null;
        throw error;
      });
      if (!stats?.isSymbolicLink()) return change;
      return {
        ...change,
        blockReason: "link simbolico nao permitido em lote editorial",
        eligible: false,
      };
    }),
  );
}

async function publicationWhitespaceCheck(projectRoot, changes) {
  const issues = [];
  const tracked = await git(projectRoot, ["diff", "HEAD", "--check"], {
    allowFailure: true,
  });
  const trackedSummary = commandSummary(tracked.stdout || tracked.stderr);
  if (tracked.exitCode !== 0) {
    issues.push(trackedSummary || "Falha ao verificar espacos finais no lote rastreado.");
  }

  for (const change of changes) {
    if (!change.eligible || change.code !== "??") continue;
    const absolutePath = path.join(projectRoot, change.path);
    const contents = await fs.readFile(absolutePath);
    if (contents.includes(0)) continue;
    const lines = contents.toString("utf8").split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index].endsWith("\r") ? lines[index].slice(0, -1) : lines[index];
      if (/[ \t]+$/.test(line)) {
        issues.push(`${change.path}:${index + 1}: trailing whitespace.`);
      }
      if (issues.length >= 30) break;
    }
    if (issues.length >= 30) break;
  }

  return {
    passed: issues.length === 0,
    summary: commandSummary(issues.join("\n")),
  };
}

function publicationPaths(projectRoot) {
  const root = path.join(projectRoot, publicationRoot);
  return {
    lock: path.join(root, "operation.lock"),
    release: path.join(root, "release.json"),
    verification: path.join(root, "verification.json"),
  };
}

async function acquirePublicationLock(projectRoot) {
  const { lock } = publicationPaths(projectRoot);
  await fs.mkdir(path.dirname(lock), { mode: 0o700, recursive: true });
  try {
    await fs.mkdir(lock, { mode: 0o700 });
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    throw new LocalPublicationError(
      "PUBLICATION_CONFLICT",
      "Outra operacao de publicacao esta em andamento.",
    );
  }
  return async () => fs.rm(lock, { force: true, recursive: true });
}

export async function getLocalPublicationStatus({ projectRoot }) {
  const projectRootReal = await fs.realpath(projectRoot);
  const [branchResult, headResult, statusResult] = await Promise.all([
    git(projectRootReal, ["branch", "--show-current"]),
    git(projectRootReal, ["rev-parse", "HEAD"]),
    git(projectRootReal, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]),
  ]);
  const branch = branchResult.stdout.trim();
  const head = headResult.stdout.trim();
  const changes = await blockChangedSymlinks(
    projectRootReal,
    parsePorcelain(statusResult.stdout),
  );
  const fingerprint = await worktreeFingerprint(projectRootReal, head, changes);
  const paths = publicationPaths(projectRootReal);
  const [verification, release] = await Promise.all([
    readJson(paths.verification),
    readJson(paths.release),
  ]);
  const verificationCurrent =
    verification?.passed === true &&
    verification?.head === head &&
    verification?.fingerprint === fingerprint;

  return {
    branch,
    changes,
    clean: changes.length === 0,
    fingerprint,
    head,
    release:
      release && release.branch === branch
        ? {
            branch: release.branch,
            commit: release.commit,
            createdAt: release.createdAt,
            message: release.message,
            prNumber: release.prNumber ?? null,
            prUrl: release.prUrl ?? null,
            responsible: release.responsible,
          }
        : null,
    verification: verification
      ? {
          checkedAt: verification.checkedAt,
          current: verificationCurrent,
          passed: verification.passed === true,
          summary: verification.summary ?? "",
        }
      : null,
  };
}

export async function verifyLocalPublication({
  projectRoot,
  runCheck = async (root) =>
    runPublicationCommand("npm", ["run", "check"], {
      cwd: root,
      timeoutMs: 10 * 60_000,
    }),
}) {
  const projectRootReal = await fs.realpath(projectRoot);
  const releaseLock = await acquirePublicationLock(projectRootReal);
  try {
    const initialStatus = await getLocalPublicationStatus({
      projectRoot: projectRootReal,
    });
    const initialWhitespace = await publicationWhitespaceCheck(
      projectRootReal,
      initialStatus.changes,
    );
    const result = initialWhitespace.passed
      ? await runCheck(projectRootReal).catch((error) => ({
          error,
          exitCode: 1,
          stderr: error instanceof Error ? error.message : String(error),
          stdout: "",
        }))
      : {
          exitCode: 1,
          stderr: initialWhitespace.summary,
          stdout: "",
        };
    const status = await getLocalPublicationStatus({ projectRoot: projectRootReal });
    const finalWhitespace = initialWhitespace.passed
      ? await publicationWhitespaceCheck(projectRootReal, status.changes)
      : initialWhitespace;
    const passed =
      !result.error && result.exitCode === 0 && finalWhitespace.passed;
    const verification = {
      checkedAt: new Date().toISOString(),
      fingerprint: status.fingerprint,
      head: status.head,
      passed,
      summary: commandSummary(
        `${result.stdout}\n${result.stderr}\n${finalWhitespace.summary}`,
      ),
    };
    await writeJsonAtomically(publicationPaths(projectRootReal).verification, verification);
    if (!passed) {
      throw new LocalPublicationError(
        "PUBLICATION_CHECK_FAILED",
        verification.summary || "A verificacao completa falhou.",
      );
    }
    return { ...status, verification: { ...verification, current: true } };
  } finally {
    await releaseLock();
  }
}

function releaseBranchName(value) {
  if (value == null || value === "") {
    const timestamp = new Date().toISOString().replaceAll(/[-:TZ.]/g, "").slice(0, 12);
    return `codex/publicacao-editorial-${timestamp}`;
  }
  const branch = requireText(value, "branch", 100);
  if (!/^codex\/[a-z0-9][a-z0-9._/-]*$/.test(branch) || branch.includes("..")) {
    throw new LocalPublicationError(
      "INVALID_PUBLICATION",
      "A branch de publicacao precisa usar o prefixo codex/.",
    );
  }
  return branch;
}

export async function prepareLocalPublication({
  branchName,
  expectedFingerprint,
  message,
  projectRoot,
  responsible,
}) {
  responsible = requireText(responsible, "responsavel");
  message = requireText(message, "mensagem", 100);
  expectedFingerprint = requireText(expectedFingerprint, "fingerprint", 64);
  const projectRootReal = await fs.realpath(projectRoot);
  const releaseLock = await acquirePublicationLock(projectRootReal);
  try {
    let status = await getLocalPublicationStatus({ projectRoot: projectRootReal });
    if (!status.verification?.current || !status.verification.passed) {
      throw new LocalPublicationError(
        "PUBLICATION_NOT_VERIFIED",
        "Execute a verificacao completa para o conjunto atual de mudancas.",
      );
    }
    if (status.fingerprint !== expectedFingerprint) {
      throw new LocalPublicationError(
        "PUBLICATION_CHANGED",
        "As mudancas foram alteradas depois da revisao.",
      );
    }
    if (status.clean) {
      throw new LocalPublicationError(
        "PUBLICATION_EMPTY",
        "Nao ha mudancas locais para preparar.",
      );
    }
    const blocked = status.changes.filter((change) => !change.eligible);
    if (blocked.length > 0) {
      throw new LocalPublicationError(
        "PUBLICATION_BLOCKED_PATH",
        `Arquivos inseguros nao podem entrar na versao: ${blocked.map((item) => item.path).join(", ")}.`,
      );
    }

    let branch = status.branch;
    if (branch === "main") {
      branch = releaseBranchName(branchName);
      await git(projectRootReal, ["switch", "-c", branch]);
    } else if (!branch.startsWith("codex/")) {
      throw new LocalPublicationError(
        "PUBLICATION_BRANCH_BLOCKED",
        "A publicacao precisa partir de main ou de uma branch codex/.",
      );
    }

    const pathsNeedingStage = status.changes
      .filter((change) => change.unstaged)
      .flatMap((change) =>
        change.previousPath ? [change.path, change.previousPath] : [change.path],
      );
    if (pathsNeedingStage.length > 0) {
      await git(projectRootReal, ["add", "-A", "--", ...pathsNeedingStage]);
    }
    const afterStage = await getLocalPublicationStatus({ projectRoot: projectRootReal });
    if (afterStage.changes.some((change) => change.unstaged)) {
      throw new LocalPublicationError(
        "PUBLICATION_PARTIAL_STAGE",
        "Ainda existem mudancas fora da versao preparada.",
      );
    }
    await git(projectRootReal, ["diff", "--cached", "--check"]);
    await git(projectRootReal, [
      "commit",
      "-m",
      message,
      "-m",
      `Responsavel editorial: ${responsible}`,
    ]);
    const commit = (await git(projectRootReal, ["rev-parse", "HEAD"])).stdout.trim();
    const release = {
      branch,
      commit,
      createdAt: new Date().toISOString(),
      message,
      responsible,
      verifiedFingerprint: expectedFingerprint,
    };
    await writeJsonAtomically(publicationPaths(projectRootReal).release, release);
    status = await getLocalPublicationStatus({ projectRoot: projectRootReal });
    return { ...status, release: { ...release, prNumber: null, prUrl: null } };
  } finally {
    await releaseLock();
  }
}

async function currentPullRequest(projectRoot, branch) {
  const result = await runPublicationCommand(
    "gh",
    [
      "pr",
      "view",
      branch,
      "--json",
      "number,url,state,mergeStateStatus,statusCheckRollup,headRefName,headRefOid,baseRefName,title",
    ],
    { allowFailure: true, cwd: projectRoot },
  );
  if (result.exitCode !== 0 || !result.stdout.trim()) return null;
  return JSON.parse(result.stdout);
}

export function remoteChecksReady(checks) {
  if (!Array.isArray(checks) || checks.length === 0) return false;
  return checks.every((check) => {
    if (typeof check?.state === "string") return check.state === "SUCCESS";
    return (
      check?.status === "COMPLETED" &&
      allowedSuccessConclusions.has(check?.conclusion)
    );
  });
}

export async function getRemotePublicationStatus({ projectRoot }) {
  const projectRootReal = await fs.realpath(projectRoot);
  const local = await getLocalPublicationStatus({ projectRoot: projectRootReal });
  if (!local.branch || local.branch === "main") {
    return { available: true, deployment: null, pr: null };
  }
  try {
    const auth = await runPublicationCommand("gh", ["auth", "status"], {
      allowFailure: true,
      cwd: projectRootReal,
    });
    if (auth.exitCode !== 0) {
      return {
        available: false,
        deployment: null,
        message: "GitHub CLI sem autenticacao ativa.",
        pr: null,
      };
    }
    const [pr, runResult] = await Promise.all([
      currentPullRequest(projectRootReal, local.branch),
      runPublicationCommand(
        "gh",
        [
          "run",
          "list",
          "--workflow",
          "pages.yml",
          "--branch",
          "main",
          "--limit",
          "1",
          "--json",
          "databaseId,status,conclusion,url,displayTitle,headSha,event,createdAt",
        ],
        { allowFailure: true, cwd: projectRootReal },
      ),
    ]);
    const runs = runResult.exitCode === 0 && runResult.stdout.trim()
      ? JSON.parse(runResult.stdout)
      : [];
    return {
      available: true,
      deployment: runs[0] ?? null,
      pr: pr
        ? {
            ...pr,
            checksReady: remoteChecksReady(pr.statusCheckRollup),
          }
        : null,
    };
  } catch (error) {
    return {
      available: false,
      deployment: null,
      message: error instanceof Error ? error.message : "GitHub indisponivel.",
      pr: null,
    };
  }
}

export async function submitLocalPublication({ projectRoot }) {
  const projectRootReal = await fs.realpath(projectRoot);
  const releaseLock = await acquirePublicationLock(projectRootReal);
  try {
    const local = await getLocalPublicationStatus({ projectRoot: projectRootReal });
    if (!local.clean || !local.release || local.release.commit !== local.head) {
      throw new LocalPublicationError(
        "PUBLICATION_NOT_PREPARED",
        "Prepare uma versao limpa antes de enviar para revisao.",
      );
    }
    await runPublicationCommand("gh", ["auth", "status"], { cwd: projectRootReal });
    await git(projectRootReal, ["push", "-u", "origin", local.branch], {
      timeoutMs: 5 * 60_000,
    });
    let pr = await currentPullRequest(projectRootReal, local.branch);
    if (!pr) {
      await runPublicationCommand(
        "gh",
        [
          "pr",
          "create",
          "--base",
          "main",
          "--head",
          local.branch,
          "--title",
          local.release.message,
          "--body",
          `## Publicacao editorial\n\nResponsavel: ${local.release.responsible}\n\nVerificacao local concluida antes do commit.`,
        ],
        { cwd: projectRootReal, timeoutMs: 5 * 60_000 },
      );
      pr = await currentPullRequest(projectRootReal, local.branch);
    }
    if (!pr) {
      throw new LocalPublicationError(
        "PUBLICATION_PR_FAILED",
        "A branch foi enviada, mas o pull request nao foi localizado.",
      );
    }
    const releasePath = publicationPaths(projectRootReal).release;
    const release = await readJson(releasePath);
    await writeJsonAtomically(releasePath, {
      ...release,
      prNumber: pr.number,
      prUrl: pr.url,
      submittedAt: new Date().toISOString(),
    });
    return getRemotePublicationStatus({ projectRoot: projectRootReal });
  } finally {
    await releaseLock();
  }
}

export async function mergeLocalPublication({ projectRoot, responsible }) {
  responsible = requireText(responsible, "responsavel");
  const projectRootReal = await fs.realpath(projectRoot);
  const releaseLock = await acquirePublicationLock(projectRootReal);
  try {
    const local = await getLocalPublicationStatus({ projectRoot: projectRootReal });
    if (!local.clean || !local.release || local.release.commit !== local.head) {
      throw new LocalPublicationError(
        "PUBLICATION_NOT_PREPARED",
        "A versao local mudou depois do envio para revisao.",
      );
    }
    const remote = await getRemotePublicationStatus({ projectRoot: projectRootReal });
    if (!remote.available || !remote.pr || remote.pr.state !== "OPEN") {
      throw new LocalPublicationError(
        "PUBLICATION_PR_NOT_OPEN",
        "Nao existe pull request aberto para esta versao.",
      );
    }
    if (!remote.pr.checksReady) {
      throw new LocalPublicationError(
        "PUBLICATION_CHECKS_PENDING",
        "As verificacoes do pull request ainda nao foram aprovadas.",
      );
    }
    if (remote.pr.headRefOid !== local.release.commit) {
      throw new LocalPublicationError(
        "PUBLICATION_REMOTE_CHANGED",
        "O pull request nao corresponde mais ao commit preparado localmente.",
      );
    }
    await runPublicationCommand(
      "gh",
      ["pr", "merge", String(remote.pr.number), "--merge", "--delete-branch=false"],
      { cwd: projectRootReal, timeoutMs: 5 * 60_000 },
    );
    const releasePath = publicationPaths(projectRootReal).release;
    const release = await readJson(releasePath);
    await writeJsonAtomically(releasePath, {
      ...release,
      mergedAt: new Date().toISOString(),
      mergedBy: responsible,
    });
    return {
      ...(await getRemotePublicationStatus({ projectRoot: projectRootReal })),
      branch: local.branch,
      merged: true,
    };
  } finally {
    await releaseLock();
  }
}
