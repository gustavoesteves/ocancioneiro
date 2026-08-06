const keyNames = {
  "-7": "Cb",
  "-6": "Gb",
  "-5": "Db",
  "-4": "Ab",
  "-3": "Eb",
  "-2": "Bb",
  "-1": "F",
  0: "C",
  1: "G",
  2: "D",
  3: "A",
  4: "E",
  5: "B",
  6: "F#",
  7: "C#",
};

export const defaultEditorialFields = {
  genre: "Nao classificado",
  level: "Nao classificado",
  notes: "",
  source: "Acervo",
  tags: [],
};

export function decodeXml(text) {
  const namedEntities = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    quot: '"',
  };

  return text.replace(
    /&(#x[0-9a-f]+|#[0-9]+|amp|apos|gt|lt|quot);/gi,
    (entity, code) => {
      if (code.startsWith("#x") || code.startsWith("#X")) {
        return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
      }
      if (code.startsWith("#")) {
        return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
      }
      return namedEntities[code.toLowerCase()];
    },
  );
}

export function textFromTag(xml, tagName) {
  const match = xml.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`));
  return match ? decodeXml(match[1].replace(/<[^>]+>/g, "").trim()) : "";
}

export function textFromCreator(xml, creatorType) {
  const creatorPattern = new RegExp(
    `<creator[^>]*type=["']${creatorType}["'][^>]*>([\\s\\S]*?)</creator>`,
    "i",
  );
  const match = xml.match(creatorPattern);
  return match ? decodeXml(match[1].replace(/<[^>]+>/g, "").trim()) : "";
}

export function attributeFromTag(tag, attributeName) {
  const match = tag.match(
    new RegExp(`${attributeName}=["']([^"']+)["']`, "i"),
  );
  return match ? decodeXml(match[1].trim()) : "";
}

export function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleFromFilename(filename) {
  return filename
    .replace(/\.(musicxml|xml)$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizedPlaceholder(value) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function isPlaceholder(value, placeholders) {
  return placeholders.has(normalizedPlaceholder(value));
}

const titlePlaceholders = new Set([
  "",
  "title",
  "untitled",
  "untitled score",
]);

const composerPlaceholders = new Set([
  "",
  "arranger",
  "composer",
  "composer arranger",
  "lyricist",
]);

function meaningfulTitle(value) {
  return value && !isPlaceholder(value, titlePlaceholders) ? value : "";
}

function meaningfulComposer(value) {
  return value && !isPlaceholder(value, composerPlaceholders) ? value : "";
}

function textFromCreditWords(credit) {
  return [...credit.matchAll(/<credit-words\b[^>]*>([\s\S]*?)<\/credit-words>/gi)]
    .map((match) => decodeXml(match[1].replace(/<[^>]+>/g, "").trim()))
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function creditsFromMusicXml(xml) {
  return [...xml.matchAll(/<credit\b[^>]*>([\s\S]*?)<\/credit>/gi)]
    .map((match) => {
      const credit = match[1];
      return {
        type: textFromTag(credit, "credit-type").toLowerCase(),
        words: textFromCreditWords(credit),
      };
    })
    .filter((credit) => credit.words);
}

function titleFromCredits(xml) {
  const credits = creditsFromMusicXml(xml);
  const typedTitle = credits.find(
    (credit) => credit.type === "title" && meaningfulTitle(credit.words),
  );

  if (typedTitle) {
    return typedTitle.words;
  }

  return credits.find((credit) => meaningfulTitle(credit.words))?.words ?? "";
}

function composerFromCredits(xml) {
  const credits = creditsFromMusicXml(xml);
  const typedComposer = credits.find(
    (credit) => credit.type === "composer" && meaningfulComposer(credit.words),
  );

  if (typedComposer) {
    return typedComposer.words;
  }

  return credits.find((credit) => meaningfulComposer(credit.words))?.words ?? "";
}

export function keyFromMusicXml(xml) {
  const fifths = textFromTag(xml, "fifths");
  const mode = textFromTag(xml, "mode");

  if (!fifths || !(fifths in keyNames)) {
    return "Nao informado";
  }

  return `${keyNames[fifths]} ${mode === "minor" ? "menor" : "maior"}`;
}

export function instrumentationFromMusicXml(xml) {
  const partNames = [...xml.matchAll(/<part-name[^>]*>([\s\S]*?)<\/part-name>/g)]
    .map((match) => decodeXml(match[1].replace(/<[^>]+>/g, "").trim()))
    .filter(Boolean);

  if (partNames.length === 0) {
    return "Nao informado";
  }

  return [...new Set(partNames)].join(", ");
}

function alterSymbol(value) {
  const alter = Number(value || 0);

  if (!Number.isFinite(alter) || alter === 0) {
    return "";
  }

  return alter > 0 ? "#".repeat(alter) : "b".repeat(Math.abs(alter));
}

export function chordsFromMusicXml(xml) {
  const chords = [...xml.matchAll(/<harmony\b[^>]*>([\s\S]*?)<\/harmony>/gi)]
    .map((match) => {
      const harmony = match[1];
      const rootStep = textFromTag(harmony, "root-step");

      if (!rootStep) {
        return "";
      }

      const rootAlter = alterSymbol(textFromTag(harmony, "root-alter"));
      const bassStep = textFromTag(harmony, "bass-step");
      const bassAlter = alterSymbol(textFromTag(harmony, "bass-alter"));
      const kindTag = harmony.match(/<kind\b[^>]*>/i)?.[0] ?? "";
      const kindText = attributeFromTag(kindTag, "text");
      const root = `${rootStep}${rootAlter}`;
      const chord =
        kindText && /^[A-G](#|b)?/.test(kindText) ? kindText : `${root}${kindText}`;

      return bassStep ? `${chord}/${bassStep}${bassAlter}` : chord;
    })
    .filter(Boolean);

  return [...new Set(chords)];
}

export function assertMusicXmlDocument(fileName, xml) {
  const root = xml.match(/<score-(partwise|timewise)\b[^>]*>/i)?.[1];
  if (!root || !new RegExp(`</score-${root}>\\s*$`, "i").test(xml)) {
    throw new Error(`${fileName} nao contem um documento MusicXML completo`);
  }
}

function escapeXmlText(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function upsertWorkTitle(xml, title) {
  const escapedTitle = escapeXmlText(title);

  if (/<work-title\b[^>]*>[\s\S]*?<\/work-title>/i.test(xml)) {
    return xml.replace(
      /<work-title\b([^>]*)>[\s\S]*?<\/work-title>/i,
      `<work-title$1>${escapedTitle}</work-title>`,
    );
  }

  if (/<work\b[^>]*>[\s\S]*?<\/work>/i.test(xml)) {
    return xml.replace(
      /(<work\b[^>]*>)/i,
      `$1\n    <work-title>${escapedTitle}</work-title>`,
    );
  }

  return xml.replace(
    /(<score-(?:partwise|timewise)\b[^>]*>)/i,
    `$1\n  <work>\n    <work-title>${escapedTitle}</work-title>\n  </work>`,
  );
}

function upsertComposer(xml, composer) {
  if (!meaningfulComposer(composer) || composer === "Nao informado") {
    return xml;
  }

  const escapedComposer = escapeXmlText(composer);

  if (/<creator\b[^>]*type=["']composer["'][^>]*>[\s\S]*?<\/creator>/i.test(xml)) {
    return xml.replace(
      /<creator\b([^>]*type=["']composer["'][^>]*)>[\s\S]*?<\/creator>/i,
      `<creator$1>${escapedComposer}</creator>`,
    );
  }

  if (/<identification\b[^>]*>[\s\S]*?<\/identification>/i.test(xml)) {
    return xml.replace(
      /(<identification\b[^>]*>)/i,
      `$1\n    <creator type="composer">${escapedComposer}</creator>`,
    );
  }

  return xml.replace(
    /(<\/work>)/i,
    `$1\n  <identification>\n    <creator type="composer">${escapedComposer}</creator>\n  </identification>`,
  );
}

export function metadataFromMusicXml(xml, fileName = "partitura.musicxml") {
  assertMusicXmlDocument(fileName, xml);
  const declaredTitle =
    textFromTag(xml, "work-title") || textFromTag(xml, "movement-title");
  const title =
    meaningfulTitle(declaredTitle) ||
    titleFromCredits(xml) ||
    declaredTitle ||
    titleFromFilename(fileName);
  const declaredComposer =
    textFromCreator(xml, "composer") || textFromTag(xml, "creator");
  const composer =
    meaningfulComposer(declaredComposer) ||
    composerFromCredits(xml) ||
    declaredComposer ||
    "Nao informado";
  const id = slugify(title) || slugify(fileName) || "nova-peca";

  return {
    chords: chordsFromMusicXml(xml),
    composer,
    fileName: `${id}.musicxml`,
    id,
    instrumentation: instrumentationFromMusicXml(xml),
    key: keyFromMusicXml(xml),
    musicxml: `/musicxml/${id}.musicxml`,
    title,
  };
}

export function musicXmlWithDisplayMetadata(
  xml,
  fileName = "partitura.musicxml",
) {
  const metadata = metadataFromMusicXml(xml, fileName);
  return upsertComposer(upsertWorkTitle(xml, metadata.title), metadata.composer);
}
