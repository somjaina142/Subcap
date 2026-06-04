import type { SubtitleSegment, SubtitleStyle, ExportFormat } from "./types";

type TextMeasurer = Pick<CanvasRenderingContext2D, "measureText">;

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function secondsToSrtTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.min(999, Math.round((sec % 1) * 1000));
  return `${pad2(h)}:${pad2(m)}:${pad2(s)},${ms.toString().padStart(3, "0")}`;
}

function secondsToVttTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.min(999, Math.round((sec % 1) * 1000));
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}.${ms.toString().padStart(3, "0")}`;
}

export function exportSubtitles(segments: SubtitleSegment[], format: ExportFormat): string {
  if (format === "srt") {
    return segments
      .map((seg, i) => {
        return `${i + 1}\n${secondsToSrtTime(seg.start)} --> ${secondsToSrtTime(seg.end)}\n${seg.text}\n`;
      })
      .join("\n");
  }

  if (format === "vtt") {
    const body = segments
      .map((seg) => {
        return `${secondsToVttTime(seg.start)} --> ${secondsToVttTime(seg.end)}\n${seg.text}`;
      })
      .join("\n\n");
    return `WEBVTT\n\n${body}`;
  }

  if (format === "ass") {
    const lines = segments.map((seg) => {
      const start = secondsToSrtTime(seg.start).replace(",", ".");
      const end = secondsToSrtTime(seg.end).replace(",", ".");
      return `Dialogue: 0,${start},${end},Default,,0,0,0,,${seg.text}`;
    });
    return `[Script Info]\nTitle: SubCap Export\nScriptType: v4.00+\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n${lines.join("\n")}`;
  }

  // json
  return JSON.stringify({ segments }, null, 2);
}

export function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function segmentSubtitleText(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [""];

  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });
    return Array.from(segmenter.segment(normalized), ({ segment }) => segment).filter(Boolean);
  }

  return normalized.split(/(\s+)/).filter(Boolean);
}

function splitOversizedToken(
  measurer: TextMeasurer,
  token: string,
  maxWidth: number
): string[] {
  if (measurer.measureText(token).width <= maxWidth) {
    return [token];
  }

  const graphemes =
    typeof Intl !== "undefined" && "Segmenter" in Intl
      ? Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(token), ({ segment }) => segment)
      : Array.from(token);

  const chunks: string[] = [];
  let current = "";

  for (const grapheme of graphemes) {
    const candidate = current + grapheme;
    if (current && measurer.measureText(candidate).width > maxWidth) {
      chunks.push(current);
      current = grapheme.trimStart();
      continue;
    }
    current = candidate;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.length ? chunks : [token];
}

export function wrapSubtitleText(
  measurer: TextMeasurer,
  text: string,
  maxWidth: number
): string[] {
  const safeWidth = Math.max(maxWidth, 1);
  const lines: string[] = [];
  let currentLine = "";

  for (const token of segmentSubtitleText(text)) {
    const candidate = `${currentLine}${token}`;
    const candidateFits = measurer.measureText(candidate).width <= safeWidth;

    if (!currentLine && !candidateFits) {
      const tokenChunks = splitOversizedToken(measurer, token.trim(), safeWidth);
      for (let i = 0; i < tokenChunks.length; i += 1) {
        const chunk = tokenChunks[i].trim();
        if (!chunk) continue;
        if (i === tokenChunks.length - 1) {
          currentLine = chunk;
        } else {
          lines.push(chunk);
        }
      }
      continue;
    }

    if (!currentLine || candidateFits) {
      currentLine = candidate;
      continue;
    }

    const committedLine = currentLine.trim();
    if (committedLine) {
      lines.push(committedLine);
    }
    currentLine = "";

    const trimmedToken = token.trim();
    if (!trimmedToken) {
      continue;
    }

    const tokenChunks = splitOversizedToken(measurer, trimmedToken, safeWidth);
    if (tokenChunks.length === 1 && measurer.measureText(tokenChunks[0]).width <= safeWidth) {
      currentLine = tokenChunks[0];
      continue;
    }

    for (let i = 0; i < tokenChunks.length; i += 1) {
      const chunk = tokenChunks[i].trim();
      if (!chunk) continue;
      if (i === tokenChunks.length - 1) {
        currentLine = chunk;
      } else {
        lines.push(chunk);
      }
    }
  }

  const finalLine = currentLine.trim();
  if (finalLine) {
    lines.push(finalLine);
  }

  return lines.length ? lines : [text.trim()];
}

export function applyStyleToSegmentCanvas(
  ctx: CanvasRenderingContext2D,
  style: SubtitleStyle,
  text: string,
  videoWidth: number,
  videoHeight: number
): { x: number; y: number } {
  const fontSize = Math.round(videoHeight * style.fontSize);
  const renderedText = style.uppercase ? text.toUpperCase() : text;
  const padding = fontSize * 0.4;
  const horizontalMargin = Math.max(fontSize, videoWidth * 0.06);
  const maxTextWidth = Math.max(videoWidth - horizontalMargin * 2 - padding * 2, fontSize * 4);

  ctx.font = `${style.bold ? "bold " : ""}${fontSize}px ${style.fontFamily}`;
  ctx.textAlign = style.alignment as CanvasTextAlign;
  ctx.textBaseline = "middle";

  const lines = wrapSubtitleText(ctx, renderedText, maxTextWidth);
  const lineHeight = fontSize * 1.16;
  const textWidth = lines.reduce((widest, line) => Math.max(widest, ctx.measureText(line).width), 0);
  const boxWidth = textWidth + padding * 2;
  const textBlockHeight = lines.length * lineHeight;
  const boxHeight = textBlockHeight + padding * 2;

  let x = videoWidth / 2;
  if (style.alignment === "left") x = horizontalMargin + padding;
  if (style.alignment === "right") x = videoWidth - horizontalMargin - padding;

  let y = videoHeight * 0.85;
  if (style.position === "top") y = videoHeight * 0.15;
  if (style.position === "center") y = videoHeight * 0.5;
  y = Math.min(videoHeight - boxHeight / 2 - padding, Math.max(boxHeight / 2 + padding, y));

  // --- Clip to video bounds so subtitles never overflow ---
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, videoWidth, videoHeight);
  ctx.clip();

  // Background
  if (style.backgroundColor) {
    ctx.fillStyle = style.backgroundColor;
    const bgX =
      style.alignment === "left"
        ? horizontalMargin
        : style.alignment === "right"
        ? videoWidth - horizontalMargin - boxWidth
        : x - boxWidth / 2;
    ctx.fillRect(bgX, y - boxHeight / 2, boxWidth, boxHeight);
  }

  const firstLineY = y - textBlockHeight / 2 + lineHeight / 2;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineY = firstLineY + index * lineHeight;

    // Skip lines that would render fully outside canvas
    if (lineY + fontSize / 2 < 0 || lineY - fontSize / 2 > videoHeight) continue;

    if (style.shadowColor && style.shadowBlur) {
      ctx.save();
      ctx.shadowColor = style.shadowColor;
      ctx.shadowBlur = style.shadowBlur;
      ctx.fillStyle = style.color;
      ctx.fillText(line, x, lineY);
      ctx.restore();
    }

    if (style.outlineColor && style.outlineWidth) {
      ctx.save();
      ctx.strokeStyle = style.outlineColor;
      ctx.lineWidth = style.outlineWidth;
      ctx.lineJoin = "round";
      ctx.strokeText(line, x, lineY);
      ctx.restore();
    }

    ctx.fillStyle = style.color;
    ctx.fillText(line, x, lineY);
  }

  ctx.restore();

  return { x, y };
}
