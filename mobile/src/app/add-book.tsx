import React, { useRef, useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { randomUUID } from "expo-crypto";
import { useJournal } from "../lib/journal";
import { Page, Button, Field, Chips, styles, message } from "../components/ui";
import { searchCatalog } from "../lib/book-recommendations";
import EbookImport from "../components/ebook-import";
type SearchBook = {
  id: string;
  title: string;
  author: string;
  cover: string;
  isbn: string;
  totalPages: number | null;
};
export default function AddBook() {
  const { id: existingId } = useLocalSearchParams<{ id?: string }>();
  const { books, saveBook, profile } = useJournal();
  const existing = books.find((book) => book.id === existingId);
  const id = useRef(existing?.id ?? randomUUID());
  const [title, setTitle] = useState(existing?.title ?? "");
  const [author, setAuthor] = useState(existing?.author ?? "");
  const [total, setTotal] = useState(existing?.totalPages?.toString() ?? "");
  const [position, setPosition] = useState(
    existing?.baselinePosition?.toString() ?? "0",
  );
  const [unit, setUnit] = useState(existing?.unit ?? "pages");
  const [status, setStatus] = useState<string>(existing?.status ?? "Reading");
  const [dropReason, setDropReason] = useState(existing?.dropReason ?? "");
  const [topics, setTopics] = useState(existing?.topics.join(", ") ?? "");
  const [cover, setCover] = useState(existing?.cover ?? "");
  const [catalogId, setCatalogId] = useState(existing?.catalogId);
  const [isbn, setIsbn] = useState(existing?.isbn ?? "");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchBook[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function search() {
    setBusy(true);
    setError("");
    try {
      const matches = await searchCatalog(
        query.trim(),
        5,
        profile.language ?? "eng",
      );
      const items: SearchBook[] = matches.map((book) => ({
        id: book.id,
        title: book.title,
        author: book.authors.join(", "),
        totalPages: null,
        cover: book.cover,
        isbn: "",
      }));
      setResults(items);
      if (!items.length)
        setError("No matches found. Add the book details below.");
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      if (
        !title.trim() ||
        !Number.isInteger(Number(position)) ||
        Number(position) < 0
      )
        throw new Error("Enter a title and a valid starting position.");
      if (
        !existing &&
        catalogId &&
        books.some(
          (b) => b.catalogId === catalogId || b.id === `ol-${catalogId}`,
        )
      )
        throw new Error("This book is already in your library.");
      if (!existing && isbn && books.some((book) => book.isbn === isbn))
        throw new Error("This edition is already in your library.");
      await saveBook(id.current, {
        title,
        author,
        totalPages: total ? Number(total) : null,
        baselinePosition: Number(position),
        unit,
        status,
        topics: topics
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        cover,
        isbn,
        catalogId,
        language: existing?.language ?? profile.language ?? "eng",
        dropReason,
      });
      router.replace({ pathname: "/book/[id]", params: { id: id.current } });
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page title={existing ? "Edit your book" : "Find your next chapter"} back>
      {!existing && <EbookImport />}
      {!existing && (
        <View style={[styles.card, styles.cardGreen]}>
          <Field
            label="Search by title, author, or ISBN"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => void search()}
          />
          <Button
            title="Search Books"
            busy={busy}
            disabled={!query.trim()}
            onPress={() => void search()}
          />
          <Text style={styles.muted}>
            Book information from Open Library. Enter the page count for your
            own edition.
          </Text>
          {results.map((book) => (
            <Button
              key={book.id}
              title={`${book.title} · ${book.author}`}
              secondary
              onPress={() => {
                setTitle(book.title);
                setAuthor(book.author);
                setTotal(book.totalPages?.toString() ?? "");
                setCover(book.cover);
                setIsbn(book.isbn);
                setCatalogId(book.id);
                setResults([]);
              }}
            />
          ))}
        </View>
      )}
      <Text style={styles.muted}>
        Confirm the details for your edition, or add your book manually.
      </Text>
      <Field label="Book title" value={title} onChangeText={setTitle} />
      <Field label="Author" value={author} onChangeText={setAuthor} />
      <Chips
        values={["pages", "percent"]}
        value={unit}
        onChange={(value) => setUnit(value as "pages" | "percent")}
      />
      {unit === "pages" && (
        <Field
          label="Total pages (optional)"
          value={total}
          onChangeText={setTotal}
          keyboardType="number-pad"
        />
      )}
      <Field
        label="Starting position"
        value={position}
        onChangeText={setPosition}
        keyboardType="number-pad"
      />
      <Field
        label="Topics (comma-separated)"
        value={topics}
        onChangeText={setTopics}
        placeholder="Fiction, Design, Psychology"
      />
      <Chips
        values={["Reading", "Want to Read", "Finished", "Dropped"]}
        value={status}
        onChange={setStatus}
      />
      {status === "Dropped" && (
        <Field
          label="Why are you setting this book aside?"
          value={dropReason}
          onChangeText={setDropReason}
          maxLength={300}
        />
      )}
      {!!error && <Text style={styles.error}>{error}</Text>}
      <Button
        title={existing ? "Save changes" : "Add to Library"}
        busy={busy}
        onPress={() => void save()}
      />
    </Page>
  );
}
