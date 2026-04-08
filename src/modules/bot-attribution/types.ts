export interface AttributionResult {
  userId: string;
  strategy: string;
  confidence: number;
}

export interface PendingCommand {
  channelId: string;
  userId: string;
  displayName: string;
  command: string;
  timestamp: number;
}
