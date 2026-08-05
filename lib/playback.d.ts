export type NoteEvent = {
  durationSeconds: number;
  frequency: number;
  startSeconds: number;
};

export function parseMusicXmlPlayback(
  xml: string,
  options?: { DOMParser?: typeof DOMParser },
): NoteEvent[];
