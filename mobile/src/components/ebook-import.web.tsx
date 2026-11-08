import React, { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { useJournal } from "../lib/journal";
import { parseEbook, storeEbook } from "../lib/ebook.web";
import { Button, styles, message } from "./ui";
const sample =
  `The Lantern Library\n\nAn original demonstration story for Reading Journal.\n\n` +
  Array.from(
    { length: 5 },
    (_, i) =>
      `Chapter ${i + 1}\n\nMara opened the library before the town woke. She placed a small green lamp beside the window and listened to the rain. Each book on the return cart carried a different kind of silence. One had a train ticket between its pages; another smelled faintly of oranges. She wondered who would come back for the forgotten ticket.\n\nAt noon, a boy arrived with a notebook. He asked whether a story could change its ending when someone read it again. Mara smiled. The words stayed where they were, she said, but the reader brought a different day. They chose a short book and sat by the window. Outside, the rain stopped.\n\nThe library's classification system depended on a hierarchy of categories. Its apparent simplicity concealed overlapping relationships between memory, interpretation, and context. A single narrative could belong to several categories simultaneously; classification therefore required a provisional judgment rather than an immutable assignment. Mara wrote a simpler label on the shelf: stories that make you look twice.\n\n`,
  ).join("\n");
export default function EbookImport() {
  const { user, books, saveBook } = useJournal();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function importFile(file: File) {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      const ebook = await parseEbook(file);
      const id = `ebook-${ebook.documentId.slice(0, 32)}`;
      await storeEbook(user.uid, id, ebook);
      if (!books.some((b) => b.id === id))
        await saveBook(id, {
          title: ebook.title,
          author: ebook.author,
          unit: "pages",
          totalPages: ebook.pages.length,
          baselinePosition: 0,
          status: "Reading",
          topics: [],
          reader: {
            documentId: ebook.documentId,
            pageCount: ebook.pages.length,
          },
        });
      router.push({ pathname: "/reader/[id]", params: { id } });
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Read inside your journal</Text>
      <Text style={styles.body}>
        Import an unencrypted EPUB or UTF-8 TXT. Text stays on this device.
        Import the same file on another device to read there; saved reading
        records sync.
      </Text>
      <label
        style={{ fontSize: 16, color: "#14422d", fontFamily: "sans-serif" }}
      >
        Choose EPUB or TXT
        <input
          aria-label="Choose EPUB or TXT"
          type="file"
          accept=".epub,.txt"
          disabled={busy}
          style={{ display: "block", maxWidth: "100%", marginTop: 12 }}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importFile(file);
            event.target.value = "";
          }}
        />
      </label>
      <Button
        title="Try a sample ebook"
        secondary
        busy={busy}
        onPress={() =>
          void importFile(
            new File([sample], "The Lantern Library.txt", {
              type: "text/plain",
            }),
          )
        }
      />
      <Text style={styles.muted}>
        Text-only MVP: images, original layouts, PDFs and protected store books
        are not imported. Reading pages are stable text sections, not
        print-edition page numbers.
      </Text>
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}
