export type NoteEvent = {
  durationSeconds: number;
  frequency: number;
  startSeconds: number;
  type: "melody";
};

export type HarmonyEvent = {
  durationSeconds: number;
  frequencies: number[];
  startSeconds: number;
  type: "harmony";
};

export function parseMusicXmlPlayback(
  xml: string,
  options?: { DOMParser?: typeof DOMParser },
): Array<NoteEvent | HarmonyEvent>;
