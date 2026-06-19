#!/usr/bin/env node
import { createReadStream, existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(".");
const port = Number(process.env.PORT || 5173);
const host = process.env.HOST || "127.0.0.1";
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav"
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === "/") pathname = "/index.html";
    const file = resolve(root, `.${normalize(pathname)}`);
    if (!file.startsWith(root)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    const target = existsSync(file) && statSync(file).isFile() ? file : join(root, "index.html");
    res.writeHead(200, { "Content-Type": mime[extname(target)] || "application/octet-stream", "Cache-Control": "no-store" });
    createReadStream(target).pipe(res);
  } catch (error) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end(error?.stack || String(error));
  }
});

server.listen(port, host, async () => {
  const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  console.log(`${pkg.name} dev server running at http://${host}:${port}`);
  console.log("This is a Vite-compatible vanilla ESM dev server fallback. Use npm run dev:vite after npm install for real Vite HMR.");
});
