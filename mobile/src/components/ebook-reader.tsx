import React from "react";
import { Text } from "react-native";
import { Page, styles } from "./ui";
export default function Reader() {
  return (
    <Page title="Ebook Reader" back>
      <Text style={styles.body}>
        Open the web app in Safari or your desktop browser to import and read
        ebooks.
      </Text>
    </Page>
  );
}
