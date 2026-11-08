import React, { useRef, useState } from "react";
import { Text } from "react-native";
import { router } from "expo-router";
import { randomUUID } from "expo-crypto";
import { api } from "../../lib/api";
import { Page, Field, Button, styles, message } from "../../components/ui";
export default function CreateCircle() {
  const id = useRef(randomUUID()),
    [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [tags, setTags] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function create() {
    setBusy(true);
    setError("");
    try {
      await api(`/v1/community/circles/${id.current}`, "PUT", {
        name,
        description,
        tags: tags
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      router.replace({
        pathname: "/community/circle/[id]",
        params: { id: id.current },
      });
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page title="A circle of your own" back>
      <Text style={styles.body}>
        Create a public space for a shared reading interest. Anyone signed in
        can find and join it. You’ll join automatically.
      </Text>
      <Field
        label="Circle name"
        value={name}
        onChangeText={setName}
        maxLength={60}
      />
      <Field
        label="What will you read or discuss?"
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={300}
      />
      <Field
        label="1–3 topics, separated by commas"
        value={tags}
        onChangeText={setTags}
        placeholder="Fiction, History"
      />
      <Text style={styles.muted}>
        You can create up to 3 circles. Keep names welcoming and avoid personal
        contact details.
      </Text>
      {!!error && <Text style={styles.error}>{error}</Text>}
      <Button
        title="Create circle"
        busy={busy}
        disabled={
          name.trim().length < 3 ||
          description.trim().length < 10 ||
          !tags.trim()
        }
        onPress={() => void create()}
      />
    </Page>
  );
}
