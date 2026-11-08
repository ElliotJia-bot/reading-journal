import React, { useEffect, useState } from "react";
import type { CommunityPost } from "../../../shared/community";
import { createShareCards, type ShareCardImage } from "../lib/share-card.web";

export default function ReadingShareCard({ post }: { post: CommunityPost }) {
  const [images, setImages] = useState<ShareCardImage[]>([]);
  const [error, setError] = useState("");
  const [sharing, setSharing] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let created: ShareCardImage[] = [];
    createShareCards({
      name: post.authorName,
      date: post.createdAt,
      thought: post.body,
      bookTitle: post.book?.title || "",
      bookAuthor: post.book?.author || "",
    })
      .then((result) => {
        created = result;
        if (cancelled)
          result.forEach((image) => URL.revokeObjectURL(image.url));
        else {
          setImages(result);
          setError("");
        }
      })
      .catch((e) => {
        if (!cancelled)
          setError(
            e instanceof Error ? e.message : "Unable to create your card.",
          );
      });
    return () => {
      cancelled = true;
      created.forEach((image) => URL.revokeObjectURL(image.url));
    };
  }, [post, retry]);
  async function share() {
    const files = images.map((image) => image.file);
    setError("");
    if (!navigator.share || !navigator.canShare?.({ files })) {
      setError(
        "Save the image below, then upload it in Instagram or your preferred app.",
      );
      return;
    }
    setSharing(true);
    try {
      await navigator.share({ files });
    } catch (e) {
      if (!(e instanceof Error && e.name === "AbortError"))
        setError(
          "Sharing wasn’t available. Save the image below and upload it from your preferred app.",
        );
    } finally {
      setSharing(false);
    }
  }
  return (
    <section aria-label="Your reading share card">
      <p className="reader-muted">A little reflection, ready to share.</p>
      {!images.length && !error && <p role="status">Creating your image…</p>}
      {images.map((image, index) => (
        <figure key={image.url} style={{ margin: "16px 0" }}>
          <img
            src={image.url}
            alt={`Reading card ${index + 1} of ${images.length}: ${post.body} — ${post.book?.title}`}
            width={1080}
            height={1350}
            style={{
              display: "block",
              width: "100%",
              height: "auto",
              borderRadius: 12,
            }}
          />
          {images.length > 1 && (
            <figcaption className="reader-muted">
              {index + 1} / {images.length} · Your full reflection continues
              across these cards.
            </figcaption>
          )}
        </figure>
      ))}
      {!!images.length && (
        <>
          <button
            className="reader-primary"
            disabled={sharing}
            onClick={() => void share()}
          >
            {sharing ? "Opening share menu…" : "Share image"}
          </button>
          {images.map((image, index) => (
            <a
              key={image.url}
              href={image.url}
              download={image.file.name}
              style={{ marginRight: 16 }}
            >
              Save image{images.length > 1 ? ` ${index + 1}` : ""}
            </a>
          ))}
          <p className="reader-muted">
            Choose an app in your phone’s share menu, or save the image and
            upload it to Instagram. You can also long-press the image to save
            it.
          </p>
        </>
      )}
      {!!error && <p role="status">{error}</p>}
      {!images.length && !!error && (
        <button onClick={() => setRetry((value) => value + 1)}>
          Retry creating image
        </button>
      )}
    </section>
  );
}
