import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const defaultRoots = ["README.md", "docs"];

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function listMarkdownFiles(targetPath) {
  const stats = await fs.stat(targetPath);

  if (stats.isFile()) {
    return targetPath.endsWith(".md") ? [targetPath] : [];
  }

  if (!stats.isDirectory()) {
    return [];
  }

  const entries = await fs.readdir(targetPath, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const entryPath = path.join(targetPath, entry.name);

      if (entry.isDirectory()) {
        return listMarkdownFiles(entryPath);
      }

      if (entry.isFile() && entry.name.endsWith(".md")) {
        return [entryPath];
      }

      return [];
    }),
  );

  return files.flat();
}

function stripFencedBlocks(markdown) {
  return markdown.replace(/```[\s\S]*?```/g, "");
}

function isExternalLink(href) {
  return /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//");
}

function slugifyHeading(heading) {
  return heading
    .trim()
    .toLocaleLowerCase("pt-BR")
    .replace(/[`*_~[\]()]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-");
}

function anchorsFromMarkdown(markdown) {
  return new Set(
    markdown
      .split(/\r?\n/)
      .map((line) => line.match(/^(#{1,6})\s+(.+?)\s*#*$/)?.[2])
      .filter(Boolean)
      .map(slugifyHeading),
  );
}

export function linksFromMarkdown(markdown) {
  const withoutFences = stripFencedBlocks(markdown);
  const links = [];
  const linkPattern = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;
  let match;

  while ((match = linkPattern.exec(withoutFences))) {
    const href = match[1].trim();
    if (href) {
      links.push({
        href,
        index: match.index,
      });
    }
  }

  return links;
}

function lineNumberAt(markdown, index) {
  return markdown.slice(0, index).split(/\r?\n/).length;
}

function splitLinkTarget(href) {
  const withoutQuery = href.split("?")[0];
  const hashIndex = withoutQuery.indexOf("#");

  if (hashIndex === -1) {
    return {
      filePart: withoutQuery,
      anchor: "",
    };
  }

  return {
    filePart: withoutQuery.slice(0, hashIndex),
    anchor: withoutQuery.slice(hashIndex + 1),
  };
}

function decodeLinkPath(filePart) {
  try {
    return decodeURIComponent(filePart);
  } catch {
    return filePart;
  }
}

export async function checkDocLinks({
  projectRoot = process.cwd(),
  roots = defaultRoots,
} = {}) {
  const rootPaths = roots.map((root) => path.resolve(projectRoot, root));
  const existingRootPaths = [];

  for (const rootPath of rootPaths) {
    if (await pathExists(rootPath)) {
      existingRootPaths.push(rootPath);
    }
  }

  const markdownFiles = (
    await Promise.all(existingRootPaths.map(listMarkdownFiles))
  )
    .flat()
    .sort();
  const issues = [];

  for (const filePath of markdownFiles) {
    const markdown = await fs.readFile(filePath, "utf8");
    const links = linksFromMarkdown(markdown);

    for (const link of links) {
      if (isExternalLink(link.href)) {
        continue;
      }

      const { filePart, anchor } = splitLinkTarget(link.href);
      const targetPath = filePart
        ? path.resolve(path.dirname(filePath), decodeLinkPath(filePart))
        : filePath;
      const relativeFile = path.relative(projectRoot, filePath);
      const line = lineNumberAt(markdown, link.index);

      if (!(await pathExists(targetPath))) {
        issues.push(
          `${relativeFile}:${line}: link interno nao encontrado: ${link.href}`,
        );
        continue;
      }

      if (anchor) {
        const targetMarkdown = await fs.readFile(targetPath, "utf8");
        const anchors = anchorsFromMarkdown(targetMarkdown);
        const normalizedAnchor = slugifyHeading(anchor);

        if (!anchors.has(normalizedAnchor)) {
          issues.push(
            `${relativeFile}:${line}: ancora interna nao encontrada: ${link.href}`,
          );
        }
      }
    }
  }

  return {
    checkedFiles: markdownFiles.length,
    issues,
  };
}

export async function main() {
  const result = await checkDocLinks();

  if (result.issues.length > 0) {
    throw new Error(`Links internos invalidos:\n- ${result.issues.join("\n- ")}`);
  }

  console.log(`Links internos da documentacao validados: ${result.checkedFiles}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
