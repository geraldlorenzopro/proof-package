/**
 * Render I-130 PDF a partir de un JSON arbitrario.
 *
 * Uso:
 *   bun run scripts/render-i130-multi.ts <data.json> <output.pdf>
 *
 * Shim de browser APIs (fetch, Blob, document, URL) para que el filler
 * (escrito para el browser) corra en Node.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createCanvas, loadImage, Image } from "canvas";
import bwipjs from "bwip-js";

const [, , dataPath, outPath] = process.argv;
if (!dataPath || !outPath) {
  console.error("Usage: bun run scripts/render-i130-multi.ts <data.json> <output.pdf>");
  process.exit(1);
}

// Shim bwipjs.toCanvas(canvasEl, opts) → usa toBuffer + draw en node-canvas.
// El filler asume browser API; en Node lo wrappeamos.
const _origBwip: any = bwipjs;
if (typeof _origBwip.toCanvas !== "function") {
  _origBwip.toCanvas = (canvasEl: any, opts: any) => {
    const buf = _origBwip.toBuffer(opts);
    // `toBuffer` en node es síncrono cuando devuelve Buffer; algunas builds usan callback.
    const finish = (pngBuf: Buffer) => {
      const img = new Image();
      img.src = pngBuf;
      canvasEl.width = img.width;
      canvasEl.height = img.height;
      const ctx = canvasEl.getContext("2d");
      ctx.drawImage(img, 0, 0);
      // Asegurar toDataURL disponible (node-canvas lo provee)
    };
    if (Buffer.isBuffer(buf)) {
      finish(buf as Buffer);
      return canvasEl;
    }
    // Fallback Promise-based (raro en bwip-js v3+)
    return Promise.resolve(buf).then((b: Buffer) => {
      finish(b);
      return canvasEl;
    });
  };
}

const origFetch = globalThis.fetch;
globalThis.fetch = (async (url: any, opts?: any) => {
  const u = String(url);
  if (u.startsWith("/forms/")) {
    return new Response(readFileSync(resolve("public" + u)));
  }
  return origFetch(url, opts);
}) as typeof fetch;

let captured: Uint8Array | null = null;
const OrigBlob = globalThis.Blob;
// @ts-ignore
globalThis.Blob = class extends OrigBlob {
  constructor(parts: any[], opts?: any) {
    super(parts, opts);
    if (parts?.[0] instanceof Uint8Array) captured = parts[0];
  }
};

// @ts-ignore
globalThis.document = {
  createElement: (tag: string) => {
    if (tag === "canvas") return createCanvas(300, 100);
    return { click() {}, remove() {}, set href(_v: any) {}, set download(_v: any) {}, style: {} };
  },
  body: { appendChild() {}, removeChild() {} },
};
// @ts-ignore
globalThis.URL = { createObjectURL: () => "blob:noop", revokeObjectURL: () => {} };

const { fillI130Pdf } = await import("../src/lib/i130FormFiller.ts");

const data = JSON.parse(readFileSync(dataPath, "utf8"));
try {
  await fillI130Pdf(data);
} catch (e) {
  console.warn("fill threw (expected on download path):", (e as Error).message);
}

if (!captured) {
  console.error("No PDF bytes captured");
  process.exit(1);
}
writeFileSync(outPath, captured);
console.log(`OK → ${outPath} (${(captured.length / 1024).toFixed(1)} KB)`);
