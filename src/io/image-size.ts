/**
 * 同步读取常见图片格式的像素尺寸（仅解析头部，不解码整图）。
 *
 * 用途：皮肤包（`.pp`）内的素材以字节形式（`ZipEntries`）持有，
 * 校验层（`src/check/skinValidate.ts`）需要在**不渲染**的前提下判断
 * 「非正方形」「图片未覆盖坐标」「尺寸不是格子的整数倍」等规则，
 * 因此需要从原始字节直接读出宽高。
 *
 * 支持：PNG / GIF / JPEG / BMP / WebP / SVG。
 * 不支持或无法解析时返回 `undefined`（校验层据此跳过依赖尺寸的判定）。
 * AVIF 首版不解析（尺寸规则对其不生效）。
 */

/** 像素尺寸（宽 × 高）。 */
export interface ImageSize {
  width: number;
  height: number;
}

/* ------------------------------------------------------------------ */
/* 字节读取小工具（均做越界保护，越界时返回 0）                        */
/* ------------------------------------------------------------------ */

function u16be(b: Uint8Array, o: number): number {
  if (o + 1 >= b.length) return 0;
  return (b[o] << 8) | b[o + 1];
}

function u16le(b: Uint8Array, o: number): number {
  if (o + 1 >= b.length) return 0;
  return b[o] | (b[o + 1] << 8);
}

function u24le(b: Uint8Array, o: number): number {
  if (o + 2 >= b.length) return 0;
  return b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);
}

function i32le(b: Uint8Array, o: number): number {
  if (o + 3 >= b.length) return 0;
  return b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24);
}

function u32be(b: Uint8Array, o: number): number {
  if (o + 3 >= b.length) return 0;
  return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
}

/* ------------------------------------------------------------------ */
/* 格式嗅探                                                            */
/* ------------------------------------------------------------------ */

function matches(b: Uint8Array, o: number, bytes: number[]): boolean {
  if (o + bytes.length > b.length) return false;
  for (let i = 0; i < bytes.length; i++) if (b[o + i] !== bytes[i]) return false;
  return true;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function isPng(b: Uint8Array): boolean {
  return matches(b, 0, PNG_SIGNATURE);
}

function isGif(b: Uint8Array): boolean {
  return matches(b, 0, [0x47, 0x49, 0x46, 0x38]) && (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61;
}

function isJpeg(b: Uint8Array): boolean {
  return b.length >= 2 && b[0] === 0xff && b[1] === 0xd8;
}

function isBmp(b: Uint8Array): boolean {
  return b.length >= 2 && b[0] === 0x42 && b[1] === 0x4d;
}

function isWebp(b: Uint8Array): boolean {
  return matches(b, 0, [0x52, 0x49, 0x46, 0x46]) && matches(b, 8, [0x57, 0x45, 0x42, 0x50]);
}

/* ------------------------------------------------------------------ */
/* 分格式解析                                                          */
/* ------------------------------------------------------------------ */

/** PNG：IHDR 数据段的宽高位于固定偏移（大端 u32）。 */
function pngSize(b: Uint8Array): ImageSize | undefined {
  // 8 字节签名 + 4 字节长度 + 4 字节类型 "IHDR" + 8 字节宽高
  if (b.length < 24) return undefined;
  if (!matches(b, 12, [0x49, 0x48, 0x44, 0x52])) return undefined;
  const width = u32be(b, 16);
  const height = u32be(b, 20);
  return valid(width, height);
}

/** GIF：逻辑屏幕描述符起于偏移 6，宽高为小端 u16。 */
function gifSize(b: Uint8Array): ImageSize | undefined {
  if (b.length < 10) return undefined;
  return valid(u16le(b, 6), u16le(b, 8));
}

/**
 * JPEG：从偏移 2 起逐个扫描段，命中 SOF（0xC0–0xCF，排除 0xC4/0xC8/0xCC）
 * 后读取精度/高/宽。段结构：`FF Cn len(2) ...`。
 */
function jpegSize(b: Uint8Array): ImageSize | undefined {
  let o = 2;
  while (o + 9 < b.length) {
    if (b[o] !== 0xff) {
      o++;
      continue;
    }
    const marker = b[o + 1];
    if (marker === 0xff) {
      o++;
      continue;
    }
    // 无长度字段的独立标记：SOI / EOI / RSTn。
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      o += 2;
      continue;
    }
    const len = u16be(b, o + 2);
    if (len < 2) return undefined;
    const isSof =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      // 长度(2) 精度(1) 高(2) 宽(2)
      const height = u16be(b, o + 5);
      const width = u16be(b, o + 7);
      return valid(width, height);
    }
    o += 2 + len;
  }
  return undefined;
}

/** BMP：按 DIB 头长度区分 BITMAPCOREHEADER(12) 与其余；高可为负（自上而下）。 */
function bmpSize(b: Uint8Array): ImageSize | undefined {
  if (b.length < 26) return undefined;
  const headerSize = i32le(b, 14) >>> 0;
  if (headerSize === 12) {
    return valid(u16le(b, 18), u16le(b, 20));
  }
  return valid(Math.abs(i32le(b, 18)), Math.abs(i32le(b, 22)));
}

/** WebP：按块类型 VP8 / VP8L / VP8X 分别取值。 */
function webpSize(b: Uint8Array): ImageSize | undefined {
  if (b.length < 30) return undefined;
  const fmt = String.fromCharCode(b[12], b[13], b[14], b[15]);
  if (fmt === 'VP8 ') {
    // 有损：帧头签名 9D 01 2A 之后的 14 位宽高。
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return undefined;
    return valid(u16le(b, 26) & 0x3fff, u16le(b, 28) & 0x3fff);
  }
  if (fmt === 'VP8L') {
    // 无损：0x2F 之后 32 位小端，各 14 位存「宽高 − 1」。
    if (b[20] !== 0x2f) return undefined;
    const bits = (b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24)) >>> 0;
    return valid((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
  }
  if (fmt === 'VP8X') {
    // 扩展：偏移 24/27 各 24 位小端存「宽高 − 1」。
    return valid(u24le(b, 24) + 1, u24le(b, 27) + 1);
  }
  return undefined;
}

/**
 * SVG：文本格式，优先取 `width`/`height` 属性（去掉单位；百分比视为无效），
 * 否则取 `viewBox` 的第 3、4 个数值。仅解码前缀以避免大文件开销。
 */
function svgSize(b: Uint8Array, path?: string): ImageSize | undefined {
  const text = decodePrefix(b);
  const byExt = path ? /\.svg$/i.test(path.split(/[?#]/, 1)[0]) : false;
  if (!/<svg[\s>/]/i.test(text) && !byExt) return undefined;
  const width = svgAttr(text, 'width');
  const height = svgAttr(text, 'height');
  if (width !== undefined && height !== undefined) return { width, height };
  const vb = /viewBox\s*=\s*["']([^"']+)["']/i.exec(text);
  if (vb) {
    const parts = vb[1].trim().split(/[\s,]+/);
    if (parts.length === 4) {
      const w = Number(parts[2]);
      const h = Number(parts[3]);
      if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
        return { width: w, height: h };
      }
    }
  }
  return undefined;
}

function decodePrefix(b: Uint8Array, max = 4096): string {
  const slice = b.subarray(0, Math.min(b.length, max));
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(slice);
  } catch {
    return '';
  }
}

function svgAttr(text: string, name: string): number | undefined {
  const m = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, 'i').exec(text);
  if (!m) return undefined;
  const raw = m[1].trim();
  if (raw.endsWith('%')) return undefined;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** 统一收敛为「正整数尺寸」，否则丢弃。 */
function valid(width: number, height: number): ImageSize | undefined {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return undefined;
  if (width < 1 || height < 1) return undefined;
  return { width: Math.round(width), height: Math.round(height) };
}

/* ------------------------------------------------------------------ */
/* 对外入口                                                            */
/* ------------------------------------------------------------------ */

/**
 * 从图片字节读取像素尺寸。
 *
 * @param bytes 图片原始字节（例如 `.pp` 内某条目的 Uint8Array）
 * @param path  可选路径提示，仅在纯文本格式（SVG）识别时辅助判断
 * @returns 宽高；无法识别或解析失败时为 `undefined`
 */
export function imageSize(bytes: Uint8Array, path?: string): ImageSize | undefined {
  if (!bytes || bytes.length < 2) return undefined;
  if (isPng(bytes)) return pngSize(bytes);
  if (isGif(bytes)) return gifSize(bytes);
  if (isJpeg(bytes)) return jpegSize(bytes);
  if (isBmp(bytes)) return bmpSize(bytes);
  if (isWebp(bytes)) return webpSize(bytes);
  return svgSize(bytes, path);
}
