export const SONG_PARTS = ["verse", "pre-chorus", "chorus", "bridge", "outro"] as const;
export type SongPart = (typeof SONG_PARTS)[number];

export const partLabel: Record<SongPart, string> = {
  verse: "Verse",
  "pre-chorus": "Pre chorus",
  chorus: "Chorus",
  bridge: "Bridge",
  outro: "Outro",
};
