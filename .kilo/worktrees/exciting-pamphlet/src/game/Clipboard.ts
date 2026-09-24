export type TextShareResult = "shared" | "copied" | "cancelled" | "unavailable";

/** Permission denial and unavailable iframe APIs are expected, not success. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch { return false; }
}

export function shareCancelled(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}

export async function shareText(text: string, preferNative: boolean): Promise<TextShareResult> {
  if (preferNative && navigator.share) {
    try {
      await navigator.share({ title: "Sunbird", text });
      return "shared";
    } catch (error) {
      if (shareCancelled(error)) return "cancelled";
    }
  }
  return await copyText(text) ? "copied" : "unavailable";
}
