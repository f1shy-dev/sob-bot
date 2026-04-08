export const config = {
  token: process.env.DISCORD_TOKEN ?? "",
  clientId: process.env.DISCORD_CLIENT_ID ?? "",
  defaultPrefix: "!",
} as const;

export function validateConfig(): void {
  if (!config.token) throw new Error("DISCORD_TOKEN is required");
  if (!config.clientId) throw new Error("DISCORD_CLIENT_ID is required");
}
