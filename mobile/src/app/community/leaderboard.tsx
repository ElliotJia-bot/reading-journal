import React, { useState } from "react";
import { Text, View } from "react-native";
import { useCommunityResource } from "../../lib/community";
import { useJournal } from "../../lib/journal";
import { api } from "../../lib/api";
import {
  Page,
  Button,
  Field,
  Chips,
  styles,
  message,
} from "../../components/ui";
import { LoadState } from "../../components/community";
import type { PublicReader } from "../../../../shared/discovery";
interface Participation {
  active: boolean;
  displayName: string;
  tier: "Beginner" | "Experienced";
}
interface Readers {
  readers: PublicReader[];
  participation: Participation;
  testMode: boolean;
  limit: number;
}
export default function Leaderboard() {
  const resource = useCommunityResource<Readers>("/v1/discovery/readers"),
    { user } = useJournal();
  const [draft, setDraft] = useState<Participation | null>(null),
    [category, setCategory] = useState("Pages"),
    [tier, setTier] = useState("Beginner"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const preference = draft ??
    resource.data?.participation ?? {
      active: false,
      displayName: "",
      tier: "Beginner" as const,
    };
  const metrics = {
    Books: "booksFinished",
    Pages: "pages",
    "Rising stars": "growthMinutes",
    "Long sessions": "longestMinutes",
  } as const;
  const metric = metrics[category as keyof typeof metrics];
  const ranking = (resource.data?.readers ?? [])
    .filter((r) => r.tier === tier && r[metric] > 0)
    .sort(
      (a, b) =>
        b[metric] - a[metric] || a.displayName.localeCompare(b.displayName),
    )
    .slice(0, 10);
  async function save(active: boolean) {
    setBusy(true);
    setError("");
    try {
      await api("/v1/discovery/participation", "PUT", {
        ...preference,
        displayName: preference.displayName.trim() || "Reader",
        active,
      });
      setDraft(null);
      await resource.refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page title="Grow together" back>
      <Text style={styles.body}>
        Celebrate consistency and curiosity. Participation is optional; these
        are self-recorded reading totals, not a measure of ability.
      </Text>
      <LoadState
        loading={resource.loading}
        error={resource.error}
        retry={() => void resource.refresh()}
      />
      <View style={styles.card}>
        <Text style={styles.heading}>Your public reading profile</Text>
        <Text style={styles.muted}>
          Off by default. Enabling shares your chosen name, reader group,
          reading totals, and the catalog books and topics you explicitly liked.
          It helps other readers discover books too. Email, location and private
          notes stay private.
        </Text>
        <Field
          label="Public display name"
          value={preference.displayName}
          onChangeText={(displayName) =>
            setDraft({ ...preference, displayName })
          }
          maxLength={40}
        />
        <Text style={styles.label}>Choose your own group</Text>
        <Chips
          values={["Beginner", "Experienced"]}
          value={preference.tier}
          onChange={(value) =>
            setDraft({ ...preference, tier: value as Participation["tier"] })
          }
        />
        <Button
          title={
            resource.data?.participation.active
              ? "Update shared profile"
              : "Enable public reading profile"
          }
          busy={busy}
          disabled={!resource.data || !preference.displayName.trim()}
          onPress={() => void save(true)}
        />
        {resource.data?.participation.active && (
          <Button
            title="Stop sharing & remove from rankings"
            secondary
            busy={busy}
            onPress={() => void save(false)}
          />
        )}
        <Text style={styles.muted}>
          {resource.data?.participation.active
            ? "Sharing is on. Your summary updates when you save reading records."
            : "Your reading profile is private."}
        </Text>
      </View>
      {!!error && <Text style={styles.error}>{error}</Text>}
      <Chips
        values={["Beginner", "Experienced"]}
        value={tier}
        onChange={setTier}
      />
      <Chips
        values={Object.keys(metrics)}
        value={category}
        onChange={setCategory}
      />
      <Text style={styles.muted}>
        {category === "Books"
          ? "Books with a recorded completion date this calendar year."
          : category === "Pages"
            ? "Forward page progress in the last 7 UTC calendar days. Percent logs are excluded; rereads may count again."
            : category === "Rising stars"
              ? "Additional reading minutes in the last 7 UTC days compared with the previous 7."
              : "Longest logged reading session in the last 7 UTC calendar days."}{" "}
        Ebook text sections and printed pages differ. Synthetic demo data is
        excluded.
      </Text>
      {!resource.loading && !ranking.length && (
        <View style={styles.card}>
          <Text style={styles.heading}>Room for the first small win.</Text>
          <Text style={styles.body}>
            No eligible shared records in this group yet. Read at your own pace
            and join when you feel ready.
          </Text>
        </View>
      )}
      {ranking.map((reader, index) => (
        <View key={reader.id} style={styles.card}>
          <View style={styles.between}>
            <Text style={styles.heading}>
              {index && ranking[index - 1][metric] === reader[metric]
                ? "="
                : ""}
              {ranking.findIndex((r) => r[metric] === reader[metric]) + 1}.{" "}
              {reader.displayName}
              {reader.id === user?.uid ? " · You" : ""}
            </Text>
            <Text style={styles.heading}>
              {reader[metric]}
              {category === "Rising stars" || category === "Long sessions"
                ? "m"
                : ""}
            </Text>
          </View>
          <Text style={styles.muted}>
            Updated {new Date(reader.updatedAt).toLocaleString()}
          </Text>
        </View>
      ))}
      <Text style={styles.muted}>
        Rankings use up to {resource.data?.limit ?? 50} profiles updated in the
        last 24 hours. Totals can be edited by readers. Keep your own pace;
        longer is not necessarily better.
      </Text>
      <Button
        title="Refresh rankings"
        secondary
        busy={resource.loading}
        onPress={() => void resource.refresh()}
      />
    </Page>
  );
}
