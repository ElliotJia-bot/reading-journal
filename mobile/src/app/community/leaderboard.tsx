import React, { useState } from "react";
import { Text, View } from "react-native";
import { useCommunityResource } from "../../lib/community";
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
import LeaderboardPanel from "../../components/leaderboard";
import type { LeaderboardData } from "../../../../shared/leaderboard";
interface Participation {
  active: boolean;
  displayName: string;
  tier: "Beginner" | "Experienced";
}
export default function Leaderboard() {
  const resource = useCommunityResource<LeaderboardData>(
    "/v1/discovery/leaderboard",
  );
  const [draft, setDraft] = useState<Participation | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const preference = draft ??
    resource.data?.participation ?? {
      active: false,
      displayName: "",
      tier: "Beginner" as const,
    };
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
    <Page title="Leaderboard profile" back>
      <Text style={styles.body}>
        Choose your name and reader group to celebrate progress together.
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
      <LeaderboardPanel
        data={resource.data}
        loading={resource.loading}
        error={resource.error}
        refresh={() => void resource.refresh()}
        manage={false}
      />
    </Page>
  );
}
