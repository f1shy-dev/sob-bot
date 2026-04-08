const TWITTER_HOSTS = new Set([
  "x.com",
  "twitter.com",
  "mobile.x.com",
  "mobile.twitter.com",
  "fxtwitter.com",
  "vxtwitter.com",
  "fixupx.com",
  "fixvx.com",
  "twittpr.com",
]);

const INSTAGRAM_HOSTS = new Set(["instagram.com", "www.instagram.com", "ddinstagram.com"]);

const TIKTOK_HOSTS = new Set([
  "tiktok.com",
  "www.tiktok.com",
  "vm.tiktok.com",
  "vt.tiktok.com",
  "vxtiktok.com",
]);

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"]);

export function extractUrls(text: string): string[] {
  return text.match(/https?:\/\/[^\s<>)\]]+/g) ?? [];
}

export function normalizeUrl(rawUrl: string): string[] {
  try {
    const url = new URL(rawUrl);
    const hostname = url.hostname.toLowerCase();
    const pathSegments = url.pathname.split("/").filter(Boolean);

    if (isTwitterHost(hostname)) {
      const statusIndex = pathSegments.findIndex((segment) => segment === "status");
      const statusId = statusIndex >= 0 ? pathSegments[statusIndex + 1] : null;
      if (statusId) return [`twitter:${statusId}`];
    }

    if (INSTAGRAM_HOSTS.has(hostname)) {
      if (
        (pathSegments[0] === "p" || pathSegments[0] === "reel" || pathSegments[0] === "reels") &&
        pathSegments[1]
      ) {
        return [`instagram:${pathSegments[1]}`];
      }
    }

    if (TIKTOK_HOSTS.has(hostname)) {
      if (pathSegments[0]?.startsWith("@") && pathSegments[1] === "video" && pathSegments[2]) {
        return [`tiktok:${pathSegments[2]}`];
      }
      if (pathSegments[0] === "t" && pathSegments[1]) {
        return [`tiktok:short:${pathSegments[1]}`];
      }
    }

    if (YOUTUBE_HOSTS.has(hostname)) {
      if (hostname === "youtu.be" && pathSegments[0]) {
        return [`youtube:${pathSegments[0]}`];
      }

      if (pathSegments[0] === "watch") {
        const videoId = url.searchParams.get("v");
        if (videoId) return [`youtube:${videoId}`];
      }

      if (pathSegments[0] === "shorts" && pathSegments[1]) {
        return [`youtube:${pathSegments[1]}`];
      }
    }
  } catch {}

  return [];
}

function isTwitterHost(hostname: string): boolean {
  return TWITTER_HOSTS.has(hostname) || hostname.startsWith("nitter.");
}
