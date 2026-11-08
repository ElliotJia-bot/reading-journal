import { color } from "./theme";
import {
  cardTextPages,
  wrapCardText,
  type ShareCardContent,
} from "../../../shared/share-card";

export interface ShareCardImage {
  file: File;
  url: string;
}
let wordmarkPromise: Promise<HTMLImageElement | null> | undefined;
function loadWordmark() {
  return (wordmarkPromise ??= new Promise((resolve) => {
    const image = new window.Image();
    const fallback = () => {
      clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      wordmarkPromise = undefined;
      resolve(null);
    };
    const timeout = setTimeout(fallback, 3000);
    image.onload = () => {
      clearTimeout(timeout);
      resolve(image);
    };
    image.onerror = fallback;
    image.src = "/brand/remarked-wordmark-light.png";
  }));
}
export async function createShareCards(
  content: ShareCardContent,
): Promise<ShareCardImage[]> {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image creation is not available in this browser.");
  const wordmark = await loadWordmark();
  const serif = 'Georgia, "Times New Roman", "Songti SC", serif';
  const sans = 'Arial, "PingFang SC", sans-serif';
  const textWidth = 904,
    left = 88;
  const measure = (text: string, size: number, family = serif) => {
    ctx.font = `${size}px ${family}`;
    return ctx.measureText(text).width;
  };
  const titleSize = content.bookTitle.length > 100 ? 28 : 36;
  const titleLines = wrapCardText(content.bookTitle, textWidth, (t) =>
    measure(t, titleSize),
  );
  const authorLines = content.bookAuthor
    ? wrapCardText(content.bookAuthor, textWidth, (t) => measure(t, 26, sans))
    : [];
  const bookHeight =
    titleLines.length * titleSize * 1.4 +
    authorLines.length * 39 +
    (authorLines.length ? 18 : 0);
  const bookTop = 1190 - bookHeight;
  const bodyTop = 350;
  const layout = cardTextPages(
    content.thought,
    textWidth,
    bookTop - bodyTop - 60,
    (t, size) => measure(t, size),
  );
  const images: ShareCardImage[] = [];
  const drawLines = (
    lines: string[],
    x: number,
    y: number,
    size: number,
    lineHeight: number,
    color: string,
    family = serif,
  ) => {
    ctx.font = `${size}px ${family}`;
    ctx.fillStyle = color;
    ctx.textBaseline = "top";
    lines.forEach((line, i) => ctx.fillText(line, x, y + i * lineHeight));
  };
  try {
    for (let index = 0; index < layout.pages.length; index++) {
      const background = ctx.createLinearGradient(0, 0, 1080, 1350);
      background.addColorStop(0, color.green);
      background.addColorStop(1, color.ink);
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, 1080, 1350);
      ctx.strokeStyle = "#d9cfc333";
      ctx.lineWidth = 1;
      ctx.strokeRect(30, 30, 1020, 1290);
      drawLines(["A MOMENT BETWEEN PAGES"], left, 76, 18, 24, color.stone, sans);
      ctx.fillStyle = "#356c55";
      ctx.beginPath();
      ctx.arc(126, 184, 38, 0, Math.PI * 2);
      ctx.fill();
      const initial =
        [
          ...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
            content.name.trim(),
          ),
        ][0]?.segment || "R";
      ctx.font = `32px ${serif}`;
      ctx.fillStyle = color.paper;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(initial, 126, 185);
      ctx.textAlign = "left";
      const names = wrapCardText(content.name, 780, (t) => measure(t, 32));
      drawLines(names, 190, 152, 32, 42, color.paper);
      drawLines(
        [
          new Date(content.date).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          }),
        ],
        190,
        158 + names.length * 42,
        21,
        30,
        color.stone,
        sans,
      );
      drawLines(
        layout.pages[index],
        left,
        bodyTop,
        layout.size,
        layout.lineHeight,
        color.paper,
      );
      ctx.strokeStyle = "#d9cfc34d";
      ctx.beginPath();
      ctx.moveTo(left, bookTop - 30);
      ctx.lineTo(992, bookTop - 30);
      ctx.stroke();
      drawLines(
        titleLines,
        left,
        bookTop,
        titleSize,
        titleSize * 1.4,
        color.paper,
      );
      drawLines(
        authorLines,
        left,
        bookTop + titleLines.length * titleSize * 1.4 + 18,
        26,
        39,
        color.stone,
        sans,
      );
      if (wordmark)
        ctx.drawImage(
          wordmark,
          left,
          1242,
          240,
          (240 * wordmark.naturalHeight) / wordmark.naturalWidth,
        );
      else drawLines(["Remarked."], left, 1251, 22, 30, color.stone, sans);
      if (layout.pages.length > 1) {
        ctx.textAlign = "right";
        drawLines(
          [`${index + 1} / ${layout.pages.length}`],
          992,
          1251,
          22,
          30,
          color.stone,
          sans,
        );
        ctx.textAlign = "left";
      }
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) =>
            b
              ? resolve(b)
              : reject(
                  new Error("Unable to create the image. Please try again."),
                ),
          "image/png",
        ),
      );
      const file = new File([blob], `remarked-${index + 1}.png`, {
        type: "image/png",
      });
      images.push({ file, url: URL.createObjectURL(blob) });
    }
    return images;
  } catch (error) {
    images.forEach((image) => URL.revokeObjectURL(image.url));
    throw error;
  }
}
