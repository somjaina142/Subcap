/**
 * Generates a short silent demo video using Canvas + MediaRecorder.
 * Returns a Blob (WebM) suitable for use with URL.createObjectURL().
 */
export async function generateDemoVideo(
  durationSec = 8,
  fps = 24,
  width = 640,
  height = 360
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  const stream = canvas.captureStream(fps);
  const mime = MediaRecorder.isTypeSupported("video/webm; codecs=vp9")
    ? "video/webm; codecs=vp9"
    : "video/webm";
  const recorder = new MediaRecorder(stream, { mimeType: mime });
  const chunks: Blob[] = [];

  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };

  const done = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
  });

  recorder.start(100);
  const totalFrames = Math.round(durationSec * fps);
  let frame = 0;

  function draw() {
    if (frame >= totalFrames) {
      recorder.stop();
      return;
    }
    const t = frame / fps;

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, "#0d1b2a");
    grad.addColorStop(1, "#1b2838");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Animated accent circle
    const cx = width / 2 + Math.sin(t * 1.5) * 100;
    const cy = height / 2 + Math.cos(t * 1.2) * 50;
    ctx.beginPath();
    ctx.arc(cx, cy, 36, 0, Math.PI * 2);
    ctx.fillStyle = "#00e5ff";
    ctx.globalAlpha = 0.9;
    ctx.fill();
    ctx.globalAlpha = 1;

    // Decorative line
    ctx.strokeStyle = "rgba(0,229,255,0.25)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, height * 0.75 + Math.sin(t * 2) * 20);
    for (let x = 0; x <= width; x += 20) {
      ctx.lineTo(x, height * 0.75 + Math.sin(x * 0.02 + t * 2) * 20);
    }
    ctx.stroke();

    // Title text
    ctx.font = "bold 22px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#e8eef4";
    ctx.fillText("SubCap Demo Video", width / 2, height - 48);

    // Subtitle cue text
    ctx.font = "16px system-ui, sans-serif";
    ctx.fillStyle = "#9aa5b1";
    ctx.fillText("Upload your own video to replace this demo", width / 2, height - 24);

    frame++;
    requestAnimationFrame(draw);
  }

  draw();
  return done;
}
