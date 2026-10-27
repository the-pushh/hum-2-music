export type Sketch = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
};

export type NoteInput = { kind: "note"; text: string };

/** What a capture adds. Later tickets extend this union (voice, lyrics, image, link, color). */
export type IdeaInput = NoteInput;

export type Idea = IdeaInput & {
  id: string;
  sketchId: string;
  order: number;
  createdAt: number;
};
