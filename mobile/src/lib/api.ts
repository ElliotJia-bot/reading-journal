import { auth } from "./firebase";
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Please sign in to continue.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 75000);
  let response: Response;
  try {
    response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new Error(
      controller.signal.aborted
        ? "This took longer than expected. Please try again."
        : "Unable to connect. Check your internet connection and try again. Your unsaved entry is still here.",
    );
  } finally {
    clearTimeout(timeout);
  }
  const result = await response.json().catch(() => {
    throw new Error(
      "This action is unavailable right now. Refresh the app and try again.",
    );
  });
  if (!response.ok)
    throw new Error(
      result.error || "Could not complete the request. Please try again.",
    );
  return result as T;
}
