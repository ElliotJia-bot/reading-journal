import React from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { Page, Button, styles } from "../components/ui";

export default function Install() {
  return (
    <Page title="Your journal, wherever you read." back>
      <Text style={styles.body}>
        Use Remarked on your phone or computer. Sign in with the same email on
        each device to see your saved books, sessions, and insights.
      </Text>
      <View style={styles.card}>
        <Text style={styles.heading}>Add to your iPhone</Text>
        <Text style={styles.body}>1. Open this website in Safari.</Text>
        <Text style={styles.body}>2. Tap Share, then Add to Home Screen.</Text>
        <Text style={styles.body}>
          3. If shown, turn on Open as Web App, then tap Add.
        </Text>
        <Text style={styles.body}>
          4. Open Remarked from your Home Screen and sign in.
        </Text>
        <Text style={styles.muted}>
          This is the web app. No App Store download is needed. An internet
          connection is required to sign in, save records, and generate
          insights.
        </Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.heading}>Try your first reading session</Text>
        <Text style={styles.body}>
          Add a book → Start reading → Pause or resume → Finish & log → Enter
          your ending page and save → Explore Insights and For You.
        </Text>
        <Text style={styles.body}>
          You can read on paper, Kindle, or Apple Books. The timer measures
          elapsed time while you are away; enter your progress when you return.
          Pause it during breaks.
        </Text>
        <Text style={styles.muted}>
          Saved sessions sync across devices. A running timer stays on the
          device where you started it, so finish and save there. Pages are
          entered by you; page turns are not detected automatically.
        </Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.heading}>Already using a guest journal?</Text>
        <Text style={styles.body}>
          On your original device or preview, open Library → Settings → Create
          account and keep records. Then sign in with that email here. Separate
          guest journals do not sync or merge automatically.
        </Text>
        <Text style={styles.muted}>
          Sharing with a reading circle is optional. Your private notes and
          reading locations are never included automatically.
        </Text>
      </View>
      <Button title="Open my journal" onPress={() => router.replace("/")} />
    </Page>
  );
}
