/**
 * Render demo I-130 PDF — shim browser APIs.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createCanvas } from "canvas";

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

const data = JSON.parse(readFileSync("/tmp/i130_data.json", "utf8"));
try { await fillI130Pdf(data); } catch (e) { console.warn("fill threw (expected on download):", (e as Error).message); }

if (!captured) { console.error("No PDF bytes captured"); process.exit(1); }
const out = "/mnt/documents/I-130_Maria_Garcia_demo_v3.pdf";
writeFileSync(out, captured);
console.log("OK →", out, captured.length, "bytes");
