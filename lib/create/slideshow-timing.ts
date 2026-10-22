// Port of slideshow_timing.dart: how long a slideshow runs.
export const SlideshowTiming = {
  perImageMs: 2800,
  singleImageMs: 12_000,
  forInterval: (imageCount: number, intervalMs: number) =>
    imageCount <= 1 ? 12_000 : intervalMs * imageCount,
};
