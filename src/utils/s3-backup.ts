import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

interface S3Config {
  bucket: string;
  region: string;
  accessKey: string;
  secretKey: string;
  endpoint?: string;
  intervalHours: number;
}

export function getS3Config(): S3Config | null {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) return null;

  return {
    bucket,
    region: process.env.S3_REGION ?? "us-east-1",
    accessKey: process.env.S3_ACCESS_KEY ?? "",
    secretKey: process.env.S3_SECRET_KEY ?? "",
    endpoint: process.env.S3_ENDPOINT,
    intervalHours: Number.parseInt(process.env.BACKUP_INTERVAL_HOURS ?? "24", 10),
  };
}

export async function uploadDatabaseBackup(): Promise<void> {
  const s3Config = getS3Config();
  if (!s3Config) return;
  if (!s3Config.accessKey || !s3Config.secretKey) {
    console.error("S3 backup skipped: missing credentials");
    return;
  }

  const tempDir = await mkdtemp(join(tmpdir(), "sob-bot-backup-"));
  const tempFile = join(tempDir, "bot.db");

  try {
    await copyFile("data/bot.db", tempFile);
    const body = new Uint8Array(await Bun.file(tempFile).arrayBuffer());
    const client = new S3Client({
      region: s3Config.region,
      credentials: {
        accessKeyId: s3Config.accessKey,
        secretAccessKey: s3Config.secretKey,
      },
      endpoint: s3Config.endpoint,
      forcePathStyle: Boolean(s3Config.endpoint),
    });

    const isoDate = new Date().toISOString().replace(/[:.]/g, "-");
    await client.send(
      new PutObjectCommand({
        Bucket: s3Config.bucket,
        Key: `backups/bot-${isoDate}.db`,
        Body: body,
        ContentType: "application/x-sqlite3",
      }),
    );

    console.log(`S3 backup uploaded successfully to ${s3Config.bucket}`);
  } catch (error) {
    console.error("S3 backup failed:", error);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export function scheduleS3Backup(): NodeJS.Timeout | null {
  const s3Config = getS3Config();
  if (!s3Config) return null;

  void uploadDatabaseBackup();
  return setInterval(() => {
    void uploadDatabaseBackup();
  }, Math.max(1, s3Config.intervalHours) * 60 * 60 * 1000);
}
