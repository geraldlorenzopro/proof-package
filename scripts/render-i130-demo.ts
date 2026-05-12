/**
 * Render demo I-130 PDF usando los datos en BD del submission de Mr. Lorenzo.
 * Uso: bun run scripts/render-i130-demo.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Shim fetch del template para Node
const origFetch = globalThis.fetch;
globalThis.fetch = (async (url: any, opts?: any) => {
  const u = String(url);
  if (u.startsWith("/forms/")) {
    const buf = readFileSync(resolve("public" + u));
    return new Response(buf);
  }
  return origFetch(url, opts);
}) as typeof fetch;

const { fillI130Pdf } = await import("../src/lib/i130FormFiller.ts");

const data = JSON.parse(readFileSync("/tmp/i130_data.json", "utf8"));
const bytes = await fillI130Pdf(data);
const out = "/mnt/documents/I-130_Maria_Garcia_demo_v3.pdf";
writeFileSync(out, bytes);
console.log("OK →", out, bytes.length, "bytes");
