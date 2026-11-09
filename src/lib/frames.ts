/**
 * Pulls small JPEG stills from videos (and screenshots) in the browser, so big
 * video files never upload. Client-side only.
 */
export interface Frame {
  label: string;
  /** base64 JPEG, no data: prefix */
  data: string;
}

const WIDTH = 480;
const QUALITY = 0.72;

function fmt(t: number): string {
  const s = Math.max(0, Math.floor(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function toJpeg(source: CanvasImageSource, w: number, h: number): string {
  const scale = Math.min(1, WIDTH / w);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext("2d")!.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", QUALITY).split(",")[1];
}

function once(el: HTMLMediaElement, event: string, ms = 15000): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    el.addEventListener(event, () => (clearTimeout(t), resolve()), { once: true });
    el.addEventListener("error", () => (clearTimeout(t), reject(new Error("error"))), { once: true });
  });
}

async function openVideo(file: File): Promise<HTMLVideoElement> {
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  v.src = URL.createObjectURL(file);
  try {
    await once(v, "loadedmetadata");
  } catch {
    throw new Error(`Couldn't read "${file.name}" in this browser. Try screenshots of it instead.`);
  }
  return v;
}

async function imageFrame(file: File, label: string): Promise<Frame> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { label, data: toJpeg(img, img.naturalWidth, img.naturalHeight) };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Spreads up to `max` frames across all files in order: about one per second,
 * fewer for long footage. Each video is a "Part"; each image counts as one frame.
 */
export async function extractFrames(files: File[], max = 36, onProgress?: (done: number, total: number) => void): Promise<Frame[]> {
  const videos = await Promise.all(
    files.map(async (f) => (f.type.startsWith("video/") || /\.(mov|mp4|m4v|webm)$/i.test(f.name) ? openVideo(f) : null)),
  );
  const imageCount = videos.filter((v) => v === null).length;
  const totalSeconds = videos.reduce((sum, v) => sum + (v && isFinite(v.duration) ? v.duration : 0), 0);
  const budget = Math.max(1, max - imageCount);
  const interval = Math.max(1, totalSeconds / budget);

  const plan: { file: File; video: HTMLVideoElement | null; times: number[]; part: number }[] = files.map((file, i) => {
    const v = videos[i];
    if (!v) return { file, video: null, times: [0], part: i + 1 };
    const times: number[] = [];
    for (let t = Math.min(0.2, v.duration / 2); t < v.duration && times.length < budget; t += interval) times.push(t);
    return { file, video: v, times, part: i + 1 };
  });
  const total = Math.min(max, plan.reduce((n, p) => n + p.times.length, 0));

  const frames: Frame[] = [];
  for (const p of plan) {
    if (!p.video) {
      if (frames.length < max) frames.push(await imageFrame(p.file, `Part ${p.part} (screenshot)`));
      onProgress?.(frames.length, total);
      continue;
    }
    for (const t of p.times) {
      if (frames.length >= max) break;
      p.video.currentTime = t;
      await once(p.video, "seeked");
      frames.push({ label: `Part ${p.part} ${fmt(t)}`, data: toJpeg(p.video, p.video.videoWidth, p.video.videoHeight) });
      onProgress?.(frames.length, total);
    }
    URL.revokeObjectURL(p.video.src);
  }
  return frames;
}
