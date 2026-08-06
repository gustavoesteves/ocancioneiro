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

export function metadataFromMusicXml(xml, fileName = "partitura.musicxml") {
  assertMusicXmlDocument(fileName, xml);
  const title =
    textFromTag(xml, "work-title") ||
    textFromTag(xml, "movement-title") ||
    titleFromFilename(fileName);
  const id = slugify(title) || slugify(fileName) || "nova-peca";

  return {
    chords: chordsFromMusicXml(xml),
    composer:
      textFromCreator(xml, "composer") ||
      textFromTag(xml, "creator") ||
      "Nao informado",
    fileName: `${id}.musicxml`,
    id,
    instrumentation: instrumentationFromMusicXml(xml),
    key: keyFromMusicXml(xml),
    musicxml: `/musicxml/${id}.musicxml`,
    title,
  };
}
