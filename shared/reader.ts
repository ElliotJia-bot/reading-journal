export interface ReaderPage {
  chapter: string;
  start: number;
  end: number;
  text: string;
}
export interface Ebook {
  documentId: string;
  title: string;
  author: string;
  pages: ReaderPage[];
}
export interface PassageReport {
  page: number;
  generatedAt: number;
  result: {
    observations: { dimension: string; explanation: string; quote: string }[];
    possibleReasons: string[];
    interestSignals: string[];
    nextStep: string;
    uncertainty: string;
  };
}
export interface PageVisit {
  id: string;
  sessionId: string;
  documentId: string;
  page: number;
  chapter: string;
  start: number;
  end: number;
  textHash: string;
  startedAt: number;
  endedAt: number;
  activeMs: number;
  words: number;
  characters: number;
  reaction: "" | "Enjoyed" | "Difficult" | "Rereading";
}
export function paginate(
  chapters: { title: string; text: string }[],
): ReaderPage[] {
  const pages: ReaderPage[] = [];
  for (const chapter of chapters) {
    const text = chapter.text.replace(/\r/g, "").trim();
    for (let start = 0; start < text.length;) {
      let end = Math.min(start + 1000, text.length);
      if (end < text.length) {
        const breakAt = Math.max(
          text.lastIndexOf(" ", end - 1),
          text.lastIndexOf("\n", end - 1),
          text.lastIndexOf("。", end - 1),
        );
        if (breakAt > start + 600) end = breakAt + 1;
      }
      pages.push({
        chapter: chapter.title.slice(0, 200),
        start,
        end,
        text: text.slice(start, end),
      });
      start = end;
    }
  }
  return pages;
}
export function textFeatures(text: string) {
  const words = text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}]+)*/gu) ?? [];
  const sentences =
    text.split(/[.!?。！？]+/u).filter((s) => s.trim()).length || 1;
  const english = words.filter((w) => /^[a-z]+$/i.test(w));
  return {
    words: words.length,
    characters: text.replace(/\s/g, "").length,
    sentences,
    averageWordsPerSentence: Math.round((words.length / sentences) * 10) / 10,
    longEnglishWordPercent: english.length
      ? Math.round(
          (english.filter((w) => w.length >= 8).length / english.length) * 100,
        )
      : null,
    hasCjk: /[\u3400-\u9fff]/u.test(text),
  };
}
// Count foreground dwell only; never infer eye movements or comprehension.
export function countedMs(
  lastTick: number,
  now: number,
  lastInteraction: number,
  visible: boolean,
  paused: boolean,
) {
  if (paused || !visible || now - lastTick > 5000 || now < lastTick) return 0;
  return Math.max(0, Math.min(now, lastInteraction + 90000) - lastTick);
}
export function summarizePages(visits: PageVisit[]) {
  const map = new Map<
    number,
    {
      page: number;
      activeMs: number;
      visits: number;
      words: number;
      characters: number;
      reactions: string[];
    }
  >();
  for (const v of visits) {
    const item = map.get(v.page) ?? {
      page: v.page,
      activeMs: 0,
      visits: 0,
      words: v.words,
      characters: v.characters,
      reactions: [],
    };
    item.activeMs += v.activeMs;
    item.visits++;
    if (v.reaction) item.reactions.push(v.reaction);
    map.set(v.page, item);
  }
  return [...map.values()].sort((a, b) => a.page - b.page);
}
