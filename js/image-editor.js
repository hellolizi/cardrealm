import { clamp } from './utils.js';

const MAX_EDIT_DIM = 920;
const MAX_ANIM_EDIT_DIM = 480;
const MAX_DECODE_FRAMES = 48;
const OUTPUT_SIZE = 620;
const ANIM_BUDGET = 1100000;
const ANIM_PLANS = [
  { size: 380, stride: 1, limit: 20 },
  { size: 340, stride: 1, limit: 18 },
  { size: 300, stride: 2, limit: 14 },
  { size: 260, stride: 3, limit: 10 },
];

function canvasOf(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function contextOf(canvas) {
  return canvas.getContext('2d', { willReadFrequently: true });
}

function drawBitmapToCanvas(bitmap, maxDim) {
  const width = bitmap.width || bitmap.displayWidth || 1;
  const height = bitmap.height || bitmap.displayHeight || 1;
  const scale = Math.min(1, maxDim / Math.max(width, height));
  const canvas = canvasOf(width * scale, height * scale);
  contextOf(canvas).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return { canvas, width, height };
}

async function bitmapFromFile(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return createImageBitmap(file);
  }
}

export async function decodePortraitSource(file) {
  if (!file) throw new Error('没有选择图片。');
  if (!String(file.type || '').startsWith('image/')) throw new Error('请选择图片文件。');
  if (file.size > 20 * 1024 * 1024) throw new Error('图片太大，请选择 20MB 以下的图片。');
  const type = file.type || 'image/png';
  if (typeof window.ImageDecoder === 'function' && /gif|webp|png/i.test(type)) {
    try {
      const supported = await window.ImageDecoder.isTypeSupported(type);
      if (supported) {
        const decoder = new window.ImageDecoder({ data: await file.arrayBuffer(), type });
        await decoder.tracks.ready;
        const track = decoder.tracks.selectedTrack;
        const frameCount = Math.max(1, Number(track?.frameCount) || 1);
        if (track?.animated && frameCount > 1) {
          const step = Math.max(1, Math.ceil(frameCount / MAX_DECODE_FRAMES));
          const frames = [];
          const durations = [];
          let fullWidth = 0;
          let fullHeight = 0;
          for (let index = 0; index < frameCount; index += step) {
            const { image } = await decoder.decode({ frameIndex: index, completeFramesOnly: true });
            const width = image.displayWidth || image.codedWidth || 1;
            const height = image.displayHeight || image.codedHeight || 1;
            if (!fullWidth) {
              fullWidth = width;
              fullHeight = height;
            }
            const scale = Math.min(1, MAX_ANIM_EDIT_DIM / Math.max(width, height));
            const canvas = canvasOf(width * scale, height * scale);
            contextOf(canvas).drawImage(image, 0, 0, canvas.width, canvas.height);
            frames.push(canvas);
            const frameMs = Math.max(20, Math.round((Number(image.duration) || 100000) / 1000));
            durations.push(frameMs * step);
            image.close?.();
          }
          decoder.close?.();
          if (frames.length > 1) {
            return {
              frames,
              durations,
              width: fullWidth,
              height: fullHeight,
              animated: true,
              totalFrames: frameCount,
            };
          }
        }
        decoder.close?.();
      }
    } catch (error) {
      console.warn('逐帧读取动图失败，改用静图。', error);
    }
  }
  const bitmap = await bitmapFromFile(file);
  const { canvas, width, height } = drawBitmapToCanvas(bitmap, MAX_EDIT_DIM);
  bitmap.close?.();
  return {
    frames: [canvas],
    durations: [100],
    width,
    height,
    animated: false,
    totalFrames: 1,
  };
}

function median(values) {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export function estimateBackground(canvas) {
  const { width, height } = canvas;
  const data = contextOf(canvas).getImageData(0, 0, width, height).data;
  const reds = [];
  const greens = [];
  const blues = [];
  let samples = 0;
  const collect = (x, y) => {
    samples += 1;
    const index = (y * width + x) * 4;
    if (data[index + 3] < 8) return;
    reds.push(data[index]);
    greens.push(data[index + 1]);
    blues.push(data[index + 2]);
  };
  const stepX = Math.max(1, Math.floor(width / 90));
  const stepY = Math.max(1, Math.floor(height / 90));
  for (let x = 0; x < width; x += stepX) {
    collect(x, 0);
    collect(x, height - 1);
  }
  for (let y = 0; y < height; y += stepY) {
    collect(0, y);
    collect(width - 1, y);
  }
  return {
    color: [median(reds), median(greens), median(blues)],
    transparency: samples ? 1 - reds.length / samples : 0,
  };
}

export function colorDistance(r, g, b, background) {
  const dr = r - background[0];
  const dg = g - background[1];
  const db = b - background[2];
  return Math.sqrt(0.299 * dr * dr + 0.587 * dg * dg + 0.114 * db * db);
}

export function toleranceDistance(tolerance) {
  return clamp(tolerance, 0, 100) * 2.2;
}

export function computeContentBounds(canvas, { bg, tolerance, transparentBorder }) {
  const { width, height } = canvas;
  const data = contextOf(canvas).getImageData(0, 0, width, height).data;
  const threshold = Math.max(6, toleranceDistance(tolerance) * 0.9);
  const step = Math.max(1, Math.floor(Math.max(width, height) / 240));
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const index = (y * width + x) * 4;
      if (data[index + 3] < 12) continue;
      if (!transparentBorder && colorDistance(data[index], data[index + 1], data[index + 2], bg) <= threshold) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < 0 || maxY < 0) return { x: 0, y: 0, w: 1, h: 1 };
  const contentWidth = maxX - minX + step;
  const contentHeight = maxY - minY + step;
  if (contentWidth * contentHeight < width * height * 0.02) return { x: 0, y: 0, w: 1, h: 1 };
  const margin = Math.max(contentWidth, contentHeight) * 0.05;
  const x = clamp((minX - margin) / width, 0, 1);
  const y = clamp((minY - margin) / height, 0, 1);
  const w = clamp((contentWidth + margin * 2) / width, 0.05, 1 - x);
  const h = clamp((contentHeight + margin * 2) / height, 0.05, 1 - y);
  return { x, y, w, h };
}

function removeBackgroundInPlace(context, width, height, settings) {
  const image = context.getImageData(0, 0, width, height);
  const data = image.data;
  const [br, bg, bb] = settings.bg;
  const tolerance = toleranceDistance(settings.tolerance);
  const feather = Math.max(1, Number(settings.feather) * 2.2);
  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3];
    if (alpha === 0) continue;
    const distance = colorDistance(data[index], data[index + 1], data[index + 2], [br, bg, bb]);
    let factor = 1;
    if (distance <= tolerance) factor = 0;
    else if (distance < tolerance + feather) factor = (distance - tolerance) / feather;
    if (factor < 1) data[index + 3] = Math.round(alpha * factor);
  }
  context.putImageData(image, 0, 0);
}

export function drawEditorPreview(canvas, frame, settings) {
  const size = canvas.width;
  canvas.height = size;
  const context = contextOf(canvas);
  context.clearRect(0, 0, size, size);
  const scale = Math.min(size / frame.width, size / frame.height);
  const drawWidth = frame.width * scale;
  const drawHeight = frame.height * scale;
  const offsetX = (size - drawWidth) / 2;
  const offsetY = (size - drawHeight) / 2;
  context.imageSmoothingQuality = 'high';
  context.drawImage(frame, offsetX, offsetY, drawWidth, drawHeight);
  if (settings.removeBg) removeBackgroundInPlace(context, size, size, settings);
  return { scale, offsetX, offsetY, drawWidth, drawHeight, size };
}

function renderPortraitFrame(frame, settings, size) {
  const crop = settings.crop || { x: 0, y: 0, w: 1, h: 1 };
  const sx = frame.width * crop.x;
  const sy = frame.height * crop.y;
  const sw = Math.max(1, frame.width * crop.w);
  const sh = Math.max(1, frame.height * crop.h);
  const canvas = canvasOf(size, size);
  const context = contextOf(canvas);
  context.imageSmoothingQuality = 'high';
  const fit = settings.removeBg
    ? Math.min(size / sw, size / sh) * 0.985
    : Math.max(size / sw, size / sh);
  const drawWidth = sw * fit;
  const drawHeight = sh * fit;
  context.drawImage(frame, sx, sy, sw, sh, (size - drawWidth) / 2, (size - drawHeight) / 2, drawWidth, drawHeight);
  if (settings.removeBg) removeBackgroundInPlace(context, size, size, settings);
  return canvas;
}

export function sampleBackground(canvas, nx, ny) {
  const x = Math.round(clamp(nx, 0, 1) * (canvas.width - 1));
  const y = Math.round(clamp(ny, 0, 1) * (canvas.height - 1));
  const radius = 3;
  const left = Math.max(0, x - radius);
  const top = Math.max(0, y - radius);
  const width = Math.min(canvas.width - left, radius * 2 + 1);
  const height = Math.min(canvas.height - top, radius * 2 + 1);
  const data = contextOf(canvas).getImageData(left, top, width, height).data;
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] < 8) continue;
    r += data[index];
    g += data[index + 1];
    b += data[index + 2];
    count += 1;
  }
  if (!count) return [255, 255, 255];
  return [Math.round(r / count), Math.round(g / count), Math.round(b / count)];
}

export function rgbToHex(color) {
  return `#${color.map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0')).join('')}`;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc = CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function uint32(value) {
  return new Uint8Array([(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255]);
}

function pngChunk(type, data) {
  const typeBytes = new Uint8Array([...type].map((char) => char.charCodeAt(0)));
  const output = new Uint8Array(12 + data.length);
  const view = new DataView(output.buffer);
  output.set(uint32(data.length), 0);
  output.set(typeBytes, 4);
  output.set(data, 8);
  const crcInput = new Uint8Array(4 + data.length);
  crcInput.set(typeBytes, 0);
  crcInput.set(data, 4);
  view.setUint32(8 + data.length, crc32(crcInput));
  return output;
}

async function canvasPng(canvas) {
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => (result ? resolve(result) : reject(new Error('无法生成动图帧。'))), 'image/png');
  });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const chunks = [];
  let offset = 8;
  while (offset + 8 <= bytes.length) {
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset, 8);
    const length = view.getUint32(0);
    const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
    const data = bytes.slice(offset + 8, offset + 8 + length);
    chunks.push({ type, data });
    offset += 12 + length;
  }
  const ihdr = chunks.find((chunk) => chunk.type === 'IHDR')?.data;
  const idats = chunks.filter((chunk) => chunk.type === 'IDAT').map((chunk) => chunk.data);
  if (!ihdr || !idats.length) throw new Error('无法解析动图帧。');
  return { ihdr, idats };
}

function joinBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

async function encodeApng(canvases, durations) {
  const encoded = [];
  for (const canvas of canvases) {
    encoded.push(await canvasPng(canvas));
  }
  const width = new DataView(encoded[0].ihdr.buffer, encoded[0].ihdr.byteOffset, 4).getUint32(0);
  const height = new DataView(encoded[0].ihdr.buffer, encoded[0].ihdr.byteOffset + 4, 4).getUint32(0);
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const parts = [signature, pngChunk('IHDR', encoded[0].ihdr)];
  const animation = new Uint8Array(8);
  const animationView = new DataView(animation.buffer);
  animationView.setUint32(0, canvases.length);
  animationView.setUint32(4, 0);
  parts.push(pngChunk('acTL', animation));
  let sequence = 0;
  const frameControl = (duration) => {
    const data = new Uint8Array(26);
    const view = new DataView(data.buffer);
    view.setUint32(0, sequence);
    sequence += 1;
    view.setUint32(4, width);
    view.setUint32(8, height);
    view.setUint32(12, 0);
    view.setUint32(16, 0);
    const delay = clamp(Math.round(duration) || 100, 1, 65535);
    view.setUint16(20, delay);
    view.setUint16(22, 1000);
    data[24] = 1;
    data[25] = 0;
    return pngChunk('fcTL', data);
  };
  parts.push(frameControl(durations[0] || 100));
  for (const idat of encoded[0].idats) parts.push(pngChunk('IDAT', idat));
  for (let index = 1; index < encoded.length; index += 1) {
    parts.push(frameControl(durations[index] || 100));
    for (const idat of encoded[index].idats) {
      const frameData = joinBytes([uint32(sequence), idat]);
      sequence += 1;
      parts.push(pngChunk('fdAT', frameData));
    }
  }
  parts.push(pngChunk('IEND', new Uint8Array(0)));
  return joinBytes(parts);
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

function selectFrames(frames, durations, stride, limit) {
  const pickedFrames = [];
  const pickedDurations = [];
  for (let index = 0; index < frames.length; index += stride) {
    let duration = 0;
    for (let skip = 0; skip < stride && index + skip < frames.length; skip += 1) {
      duration += durations[index + skip] || 100;
    }
    pickedFrames.push(frames[index]);
    pickedDurations.push(Math.max(40, duration));
    if (pickedFrames.length >= limit) break;
  }
  return { frames: pickedFrames, durations: pickedDurations };
}

export async function composePortrait(source, settings) {
  if (!source.animated) {
    const canvas = renderPortraitFrame(source.frames[0], settings, OUTPUT_SIZE);
    let dataUrl = canvas.toDataURL('image/webp', 0.86);
    if (!dataUrl.startsWith('data:image/webp')) dataUrl = canvas.toDataURL('image/png');
    return { dataUrl, animated: false, frames: 1, size: OUTPUT_SIZE, bytes: dataUrl.length };
  }
  for (const plan of ANIM_PLANS) {
    const picked = selectFrames(source.frames, source.durations, plan.stride, plan.limit);
    const canvases = [];
    for (let index = 0; index < picked.frames.length; index += 1) {
      canvases.push(renderPortraitFrame(picked.frames[index], settings, plan.size));
      if (index % 3 === 2) await new Promise((resolve) => setTimeout(resolve, 0));
    }
    const bytes = await encodeApng(canvases, picked.durations);
    if (bytes.length <= ANIM_BUDGET) {
      return {
        dataUrl: `data:image/apng;base64,${bytesToBase64(bytes)}`,
        animated: true,
        frames: picked.frames.length,
        size: plan.size,
        bytes: bytes.length,
      };
    }
  }
  throw new Error('这段动图太大了。请换一段更短、更小的动图，或使用静态图。');
}
