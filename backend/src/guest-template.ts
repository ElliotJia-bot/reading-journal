/** Only reading data can enter a guest template. Authentication, device pairing,
 * public identities, moderation records and rate limits must never be cloned. */
export const guestTemplatePath = (path: string) =>
  /^(books|sessions|insights|discoveryFeedback|recommendationDetails)\/[A-Za-z0-9_-]+$/.test(path) ||
  /^books\/[A-Za-z0-9_-]+\/(readerVisits|readerReports)\/[A-Za-z0-9_-]+$/.test(path) ||
  /^bookmarkSessions\/[A-Za-z0-9_-]+(?:\/visits\/[A-Za-z0-9_-]+)?$/.test(path) ||
  /^private\/(demo-reading-features|discovery-feed|discovery-preferences)$/.test(path);

export function guestProfile(source: Record<string, unknown>) {
  return {
    goal: source.goal ?? "Build a reading habit",
    timezone: source.timezone ?? "America/New_York",
    topics: source.topics ?? [],
    ...(source.language ? { language: source.language } : {}),
    demoData: { synthetic: true, guestTemplate: true },
  };
}

export function guestRecord(path: string, data: Record<string, any>) {
  if (!guestTemplatePath(path)) throw new Error("Invalid guest template path");
  if (/^bookmarkSessions\/[^/]+$/.test(path)) {
    if (data.state?.status !== "ended" || !data.state?.savedAt)
      throw new Error("Only saved bookmark sessions can be copied");
    // Never copy a hardware credential, active session pointer or connection.
    return { state: { ...data.state, connected: false } };
  }
  return data;
}
