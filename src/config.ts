export const config = {
  token: process.env.DISCORD_TOKEN ?? "",
  clientId: process.env.DISCORD_CLIENT_ID ?? "",
  defaultPrefix: "!",
  globalAdmins: [
    "957611986835898441",
    ...(process.env.GLOBAL_ADMINS?.split(",")
      .map((id) => id.trim())
      .filter(Boolean) ?? []),
  ],
} as const;

export function validateConfig(): void {
  if (!config.token) throw new Error("DISCORD_TOKEN is required");
  if (!config.clientId) throw new Error("DISCORD_CLIENT_ID is required");
}
