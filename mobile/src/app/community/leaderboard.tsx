import React, { useState } from "react";
import { Switch, Text, View } from "react-native";
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
  shareLibrary?: boolean;
  shareHabits?: boolean;
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
    <Page title="Profile & sharing" back>
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
          Enabling shares your name, reader group, reading totals and books you
          explicitly liked. Choose whether to also share your library and
          habits. Email, exact locations and private notes stay private.
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
        <View style={styles.between}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.body}>Share my library</Text>
            <Text style={styles.muted}>
              Book covers, titles, reading status and progress.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Share my library"
            value={!!preference.shareLibrary}
            onValueChange={(shareLibrary) =>
              setDraft({ ...preference, shareLibrary })
            }
          />
        </View>
        <View style={styles.between}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.body}>Share my reading habits</Text>
            <Text style={styles.muted}>
              Recent reading rhythm, time of day and favorite topics.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Share my reading habits"
            value={!!preference.shareHabits}
            onValueChange={(shareHabits) =>
              setDraft({ ...preference, shareHabits })
            }
          />
        </View>
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
            : "Your library and habits are private."}{" "}
          Posts you already published remain visible in the community.
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
