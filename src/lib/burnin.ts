import type { SubtitleSegment, SubtitleStyle } from "./types";
import { applyStyleToSegmentCanvas } from "./subtitle";

export interface BurnInOptions {
  videoUrl: string;
  segments: SubtitleSegment[];
  style: SubtitleStyle;
  onProgress?: (pct: number) => void;
  onFrame?: (frameNumber: number, totalFrames: number) => void;
}

export interface BurnInResult {
  blob: Blob;
  mimeType: string;
  extension: string;
}

/**
 * Client-side burn-in exporter using Canvas + MediaRecorder.
 * Draws each video frame onto a canvas with subtitle overlay, then records
 * the combined canvas video + source audio stream to a WebM blob.
 *
 * Critical behaviour for frame stability:
 * 1. Recorder starts in `onplay` (synced with actual video playback start),
 *    not before. This avoids recording black/empty leading frames.
 * 2. Canvas is redrawn on EVERY rAF tick. `captureStream()` only emits a
 *    frame when the canvas pixel data changes, so skipping draws would
 *    create gaps in the video track. drawImage() is cheap; throttling is
 *    handled by captureStream's framerate cap (24fps).
 * 3. After `ended`, a short delay lets MediaRecorder flush its internal
 *    buffers before stopping, preventing truncated video.
 */
export async function exportBurnIn(options: BurnInOptions): Promise<BurnInResult> {
  const { videoUrl, segments, style, onProgress } = options;

  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.src = videoUrl;
    video.playsInline = true;
    video.crossOrigin = "anonymous";
    // Do NOT mute — we need the audio graph alive for AudioContext capture.

    video.onerror = () => reject(new Error("Video failed to load for burn-in export"));

    video.onloadedmetadata = () => {
      const duration = video.duration || 1;
      const w = video.videoWidth || 640;
      const h = video.videoHeight || 360;

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      // ── Video stream from canvas ──
      const stream = canvas.captureStream(24); // 24 fps cap

      // ── Audio stream from source video ──
      const audioCtx = new AudioContext();
      const audioSource = audioCtx.createMediaElementSource(video);
      const audioDest = audioCtx.createMediaStreamDestination();
      audioSource.connect(audioDest);
      // Keep graph alive without audible output during export
      const gainNode = audioCtx.createGain();
      gainNode.gain.value = 0;
      audioSource.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      audioDest.stream.getAudioTracks().forEach((track) => stream.addTrack(track));

      // ── MediaRecorder ──
      const mimeTypes = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
      ];
      const supportedMime = mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) || "video/webm";

      const recordedChunks: Blob[] = [];
      let recorder: MediaRecorder;

      const cleanup = () => {
        void audioCtx.close();
        cancelAnimationFrame(raf);
      };

      const finish = () => {
        const blob = new Blob(recordedChunks, { type: supportedMime });
        cleanup();
        resolve({ blob, mimeType: supportedMime, extension: "webm" });
      };

      const onDataAvailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) recordedChunks.push(e.data);
      };

      const onRecorderStop = () => {
        finish();
      };

      const onRecorderError = (e: Event) => {
        cleanup();
        reject(new Error(`MediaRecorder error: ${e}`));
      };

      // ── Frame loop ──
      let raf = 0;
      let hasStarted = false;

      const draw = () => {
        if (video.ended) {
          // Let recorder flush trailing data (150ms) before stopping
          setTimeout(() => {
            if (recorder.state !== "inactive") recorder.stop();
          }, 150);
          return;
        }

        if (video.paused && hasStarted) {
          // Paused mid-export — unlikely but handle gracefully
          setTimeout(() => {
            if (recorder.state !== "inactive") recorder.stop();
          }, 150);
          return;
        }

        // ALWAYS draw on every rAF tick. captureStream(24) already caps
        // the emitted frame rate; skipping draws here causes gaps in
        // the video track because the canvas pixel data doesn't change.
        ctx.drawImage(video, 0, 0, w, h);

        const t = video.currentTime;
        const seg = segments.find((s) => t >= s.start && t <= s.end);
        if (seg) {
          applyStyleToSegmentCanvas(ctx, style, seg.text, w, h);
        }

        if (onProgress) {
          onProgress(Math.min(1, t / duration));
        }

        raf = requestAnimationFrame(draw);
      };

      // ── Start everything on first play ──
      const onPlay = () => {
        if (hasStarted) return;
        hasStarted = true;

        // Create and start recorder NOW, synced with actual playback
        recorder = new MediaRecorder(stream, {
          mimeType: supportedMime,
          videoBitsPerSecond: 4_000_000,
        });
        recorder.ondataavailable = onDataAvailable;
        recorder.onstop = onRecorderStop;
        recorder.onerror = onRecorderError;
        recorder.start(100); // 100ms slices

        raf = requestAnimationFrame(draw);
      };

      video.onplay = onPlay;

      // Begin playback
      video.play().catch((err) => {
        cleanup();
        reject(err);
      });
    };

    video.load();
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
