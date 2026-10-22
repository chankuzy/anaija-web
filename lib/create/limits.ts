// Port of media_limits.dart. Server twin: _shared/mediaLimits.ts.
export const MediaLimits = {
  maxVideoBytes: 100 * 1024 * 1024,
  maxVideoSeconds: 180,
  maxStoryAudioSeconds: 30,
  minStoryAudioSeconds: 3,
} as const;

export const tooLargeMessage = `This video is larger than ${MediaLimits.maxVideoBytes / (1024 * 1024)} MB. Choose a shorter clip.`;

export const tooLongMessage =
  MediaLimits.maxVideoSeconds % 60 === 0
    ? `Videos can be up to ${MediaLimits.maxVideoSeconds / 60} minutes long.`
    : `Videos can be up to ${MediaLimits.maxVideoSeconds} seconds long.`;

/** User-facing error, or null when the video is within limits. */
export function checkVideo(sizeBytes: number, durationMs: number): string | null {
  if (sizeBytes > MediaLimits.maxVideoBytes) return tooLargeMessage;
  if (durationMs <= 0) return "We couldn't read this video.";
  if (durationMs > MediaLimits.maxVideoSeconds * 1000 + 500) return tooLongMessage;
  return null;
}

export class MediaLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaLimitError";
  }
}
