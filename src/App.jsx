// App.jsx — with HEIC input support (converts HEIC->JPEG before compressing)
// Minimal, lazy-loaded heic2any usage. If browser natively supports HEIC (createImageBitmap or <img>), we use that first.

import React, { useRef, useState, useEffect } from "react";
import { SpeedInsights } from "@vercel/speed-insights/react";

/* Vite-safe asset URLs */
const IconImg = new URL("./assets/icon.png", import.meta.url).href;

/* Helper: show human-friendly size (1024 base) and also show exact bytes */
function humanFileSizeShort(bytes) {
  if (!bytes && bytes !== 0) return "0 B";
  const kb = bytes / 1024;
  if (kb < 1) return `${bytes} B`;
  if (kb < 1024) return `${kb.toFixed(1)} KB (${bytes} bytes)`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB (${bytes} bytes)`;
}

/* original lightweight humanFileSize (kept for other UI uses) */
function humanFileSize(bytes) {
  if (!bytes) return "0 B";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (
    (bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0) +
    " " +
    ["B", "KB", "MB", "GB"][i]
  );
}

function mimeToExt(mime) {
  if (!mime) return "jpg";
  const part = mime.split("/")[1] || "jpeg";
  if (part === "jpeg") return "jpg";
  if (part.indexOf("svg") !== -1) return "svg";
  return part.replace(/[^a-z0-9]/gi, "");
}

/* Small spinner */
function Spinner({ className = "" }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeOpacity="0.12"
      />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* Download icon */
function DownloadIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      className="inline-block align-middle -mt-[2px]"
    >
      <path
        d="M12 3v12"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 11l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21 21H3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* Utility: createImageBitmap wrapper with fallback to Image */
async function decodeImage(blob) {
  if (typeof createImageBitmap === "function") {
    try {
      const imgBitmap = await createImageBitmap(blob);
      return {
        bitmap: imgBitmap,
        width: imgBitmap.width,
        height: imgBitmap.height,
        isBitmap: true,
      };
    } catch {
      // fallback below
    }
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ img, width: img.width, height: img.height, isBitmap: false });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image decode failed"));
    };
    img.src = url;
  });
}

/* Helper: produce a blob from canvas, with timeout & fallback to toDataURL */
async function canvasToBlobWithFallback(canvas, mime, quality) {
  const b = await new Promise((resolve) => {
    let called = false;
    try {
      canvas.toBlob((blob) => {
        if (!called) {
          called = true;
          resolve(blob);
        }
      }, mime, quality);
    } catch {
      resolve(null);
    }
    setTimeout(() => {
      if (!called) resolve(null);
    }, 2500);
  });

  if (b && b.size > 0) return b;

  try {
    const dataUrl = canvas.toDataURL(mime, quality);
    const [, raw] = dataUrl.split(",");
    const binary = atob(raw);
    const len = binary.length;
    const u8 = new Uint8Array(len);
    for (let i = 0; i < len; i++) u8[i] = binary.charCodeAt(i);
    return new Blob([u8], { type: mime || "image/png" });
  } catch {
    return null;
  }
}

/* draw helper */
function drawImageScaled(ctx, source, sx, sy, sWidth, sHeight, dWidth, dHeight) {
  if (source instanceof ImageBitmap || source instanceof HTMLImageElement) {
    ctx.drawImage(
      source,
      0,
      0,
      source.width || sWidth,
      source.height || sHeight,
      0,
      0,
      dWidth,
      dHeight
    );
  } else {
    ctx.drawImage(source, 0, 0, dWidth, dHeight);
  }
}

/* Robust canvas create + draw with progressive halving */
async function renderScaled(sourceObj, targetW, targetH) {
  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");

  if (sourceObj.isBitmap && sourceObj.bitmap) {
    drawImageScaled(
      ctx,
      sourceObj.bitmap,
      0,
      0,
      sourceObj.width,
      sourceObj.height,
      targetW,
      targetH
    );
    return canvas;
  }

  let sw = sourceObj.width,
    sh = sourceObj.height;
  let tmpCanvas = document.createElement("canvas");
  let tmpCtx = tmpCanvas.getContext("2d");
  tmpCanvas.width = sw;
  tmpCanvas.height = sh;

  if (sourceObj.isBitmap && sourceObj.bitmap)
    tmpCtx.drawImage(sourceObj.bitmap, 0, 0);
  else tmpCtx.drawImage(sourceObj.img, 0, 0, sw, sh);

  while (sw / 2 > targetW) {
    const nw = Math.round(sw / 2);
    const nh = Math.round(sh / 2);
    const nc = document.createElement("canvas");
    nc.width = nw;
    nc.height = nh;
    const nctx = nc.getContext("2d");
    nctx.drawImage(tmpCanvas, 0, 0, sw, sh, 0, 0, nw, nh);
    tmpCanvas = nc;
    sw = nw;
    sh = nh;
    await new Promise((r) => setTimeout(r, 0));
  }

  ctx.drawImage(tmpCanvas, 0, 0, sw, sh, 0, 0, targetW, targetH);
  return canvas;
}

/* ------------ HEIC helper: lazy-load heic2any when needed ------------ */

/**
 * Attempts to load heic2any library by injecting a script tag.
 * Resolves when window.heic2any is available or rejects on timeout.
 */
/* Robust heic2any loader: dynamic import (local) -> CDN fallback -> timeout */
async function loadHeic2any(timeoutMs = 10000) {
  if (typeof window === "undefined") throw new Error("No window");
  if (window.heic2any) return window.heic2any;

  // 1) Try dynamic import (works if you `npm install heic2any`)
  try {
    const mod = await import("heic2any");
    const fn = mod?.default || mod;
    if (typeof fn === "function") {
      window.heic2any = fn;
      return fn;
    }
  } catch (err) {
    console.warn("Dynamic import heic2any failed:", err);
    // continue to CDN fallback
  }

  // 2) CDN fallback: inject script if not already present
  if (window.heic2any) return window.heic2any;
  const existing = document.querySelector('script[data-heic2any="1"]');
  if (!existing) {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/heic2any@0.5.2/dist/heic2any.min.js";
    s.async = true;
    s.setAttribute("data-heic2any", "1");
    document.head.appendChild(s);
  }

  // 3) Wait for window.heic2any with timeout
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const poll = () => {
      if (window.heic2any) return resolve(window.heic2any);
      if (Date.now() - start > timeoutMs) {
        return reject(new Error("heic2any load timeout"));
      }
      setTimeout(poll, 200);
    };
    poll();
  });
}

/* Convert HEIC/HEIF Blob -> JPEG Blob with robust fallbacks.
   progressCb(pct, msg) is used for UI updates.
*/
async function convertHeicToJpegBlob(heicBlob, quality = 0.9, progressCb = () => { }) {
  progressCb(5, "Attempting native decode...");
  // 1) Try native decode (Safari / some browsers)
  try {
    const decoded = await decodeImage(heicBlob);
    progressCb(25, "Native decode OK — converting to JPEG...");
    const canvas = await renderScaled(decoded, decoded.width, decoded.height);
    const jpeg = await canvasToBlobWithFallback(canvas, "image/jpeg", quality);
    if (jpeg && jpeg.size > 0) return jpeg;
    // fallthrough to library fallback if canvas->blob failed
  } catch (err) {
    console.info("Native HEIC decode failed (expected on many browsers):", err?.message || err);
  }

  // 2) Try heic2any (dynamic import or CDN)
  progressCb(30, "Loading HEIC converter...");
  let heic2anyFn = null;
  try {
    heic2anyFn = await loadHeic2any(10000); // 10s timeout
  } catch (err) {
    console.error("Failed to load heic2any:", err);
    throw new Error("HEIC converter could not be loaded. Check network or install heic2any locally.");
  }

  progressCb(50, "Converting HEIC to JPEG...");
  try {
    const out = await window.heic2any({
      blob: heicBlob,
      toType: "image/jpeg",
      quality: Math.max(0.55, Math.min(1, quality || 0.9)),
    });

    if (!out) throw new Error("heic2any returned nothing");
    if (Array.isArray(out) && out.length > 0) {
      const blob = out[0];
      if (blob && blob.size) return blob;
    } else if (out instanceof Blob) {
      return out;
    } else if (out instanceof ArrayBuffer || out.buffer) {
      const ab = out instanceof ArrayBuffer ? out : out.buffer || out;
      return new Blob([ab], { type: "image/jpeg" });
    }

    throw new Error("HEIC conversion returned unexpected result type");
  } catch (err) {
    console.error("HEIC conversion failed:", err);
    throw new Error("HEIC conversion failed. Try a different browser (Safari) or convert the file externally.");
  }
}


/* Main fast compressor with aggressive options */
async function compressFileOptimized(fileBlob, opts = {}) {
  const {
    mime = "image/jpeg",
    quality = 0.82,
    targetBytes = 0,
    maxWidth = 0,
    progress = () => { },
  } = opts;

  const src = await decodeImage(fileBlob);
  let srcW = src.width,
    srcH = src.height;

  const ABS_MAX = 8192;
  if (srcW > ABS_MAX || srcH > ABS_MAX) {
    const scale = ABS_MAX / Math.max(srcW, srcH);
    srcW = Math.round(srcW * scale);
    srcH = Math.round(srcH * scale);
  }

  let initialW = srcW;
  if (maxWidth && initialW > maxWidth) {
    const r = maxWidth / initialW;
    initialW = Math.round(initialW * r);
  }
  const aspect = srcH / srcW;
  let targetW = initialW;
  let targetH = Math.round(targetW * aspect);

  progress(10, "Preparing image");
  if (!targetBytes || targetBytes <= 0) {
    const canvas = await renderScaled(src, targetW, targetH);
    progress(40, "Encoding image");
    const out = await canvasToBlobWithFallback(canvas, mime, quality);
    return out;
  }

  // AGGRESSIVE QUALITY SEARCH
  progress(15, "Searching quality");
  const Q_ITER = 10;
  let lowQ = 0.02,
    highQ = Math.min(0.98, quality || 0.98);
  let bestBlob = null;
  let bestSize = Infinity;

  for (let i = 0; i < Q_ITER; i++) {
    const q = (lowQ + highQ) / 2;
    progress(
      15 + Math.round((i / Q_ITER) * 20),
      `Trying quality ${Math.round(q * 100)}%`
    );
    const canvas = await renderScaled(src, targetW, targetH);
    const blob = await canvasToBlobWithFallback(canvas, mime, q);
    if (!blob) continue;
    const s = blob.size;
    if (s <= targetBytes) {
      bestBlob = blob;
      bestSize = s;
      lowQ = q;
    } else {
      highQ = q;
    }
    if (bestBlob && Math.abs(bestSize - targetBytes) / targetBytes < 0.06)
      break;
    await new Promise((r) => setTimeout(r, 0));
  }

  if (bestBlob && bestSize <= targetBytes * 1.03) {
    progress(90, "Finalizing");
    return bestBlob;
  }

  // MORE DOWNSCALES, MORE AGGRESSIVE FACTOR
  progress(40, "Downscaling to reach target");
  const MAX_DOWNS = 8;
  let currentW = targetW;

  for (let attempt = 0; attempt < MAX_DOWNS; attempt++) {
    const factor = attempt === 0 ? 0.88 : 0.78;
    currentW = Math.round(currentW * factor);
    if (currentW < 200) break;
    const currentH = Math.round(currentW * aspect);
    let foundLocal = null;

    for (let qIter = 0; qIter < 5; qIter++) {
      const q = 0.12 + 0.86 * (1 - qIter / 5);
      progress(
        50 +
        Math.round((attempt / MAX_DOWNS) * 30) +
        Math.round((qIter / 5) * 10),
        `Downscale ${attempt + 1}/${MAX_DOWNS} — q ${Math.round(q * 100)}%`
      );
      const canvas = await renderScaled(src, currentW, currentH);
      const blob = await canvasToBlobWithFallback(canvas, mime, q);
      if (!blob) continue;
      if (blob.size <= targetBytes) {
        foundLocal = blob;
        break;
      }
      if (blob.size < bestSize) {
        bestBlob = blob;
        bestSize = blob.size;
      }
      await new Promise((r) => setTimeout(r, 0));
    }

    if (foundLocal) {
      progress(90, "Finalizing");
      return foundLocal;
    }
  }

  if (bestBlob) {
    progress(92, "Returning best possible");
    return bestBlob;
  }

  progress(95, "Final encode");
  const finalW = Math.max(400, Math.round(initialW * 0.6));
  const finalCanvas = await renderScaled(
    src,
    finalW,
    Math.round(finalW * aspect)
  );
  const finalBlob = await canvasToBlobWithFallback(finalCanvas, mime, 0.12);
  return finalBlob;
}

/* ----------------- App component (mostly unchanged) ----------------- */

export default function App() {
  const inputRef = useRef();
  const [file, setFile] = useState(null);
  const [previewURL, setPreviewURL] = useState("");
  const [originalSize, setOriginalSize] = useState(0);

  const [outURL, setOutURL] = useState("");
  const [outSize, setOutSize] = useState(0);
  const [outMime, setOutMime] = useState("");
  const [outFilename, setOutFilename] = useState("");

  const [quality, setQuality] = useState(0.82);
  const [targetKB, setTargetKB] = useState("");
  const [processing, setProcessing] = useState(false);
  const [format, setFormat] = useState("jpeg");
  const [lastNote, setLastNote] = useState("");
  const [progressPct, setProgressPct] = useState(0);

  // compact theme switcher (localStorage + data-theme)
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "light";
    return window.localStorage.getItem("compressly-theme") || "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem("compressly-theme", theme);
  }, [theme]);

  useEffect(
    () => () => {
      if (previewURL) URL.revokeObjectURL(previewURL);
      if (outURL) URL.revokeObjectURL(outURL);
    },
    [previewURL, outURL]
  );

  function resetAll() {
    setFile(null);
    setPreviewURL("");
    setOriginalSize(0);
    if (outURL) URL.revokeObjectURL(outURL);
    setOutURL("");
    setOutSize(0);
    setOutMime("");
    setOutFilename("");
    setTargetKB("");
    setLastNote("");
    setProgressPct(0);
  }

  function handleFiles(files) {
    if (!files || files.length === 0) return;
    const f = files[0];
    setFile(f);
    setOriginalSize(f.size);
    if (previewURL) URL.revokeObjectURL(previewURL);
    setPreviewURL(URL.createObjectURL(f));
    if (outURL) URL.revokeObjectURL(outURL);
    setOutURL("");
    setOutSize(0);
    setOutMime("");
    setOutFilename("");
    setLastNote("");
  }

  function isWebPSupported() {
    const canvas = document.createElement("canvas");
    if (!canvas.getContext) return false;
    return canvas.toDataURL("image/webp").indexOf("data:image/webp") === 0;
  }

  function handleResultBlob(blob, preferredMime) {
    if (!blob) return;
    if (outURL) URL.revokeObjectURL(outURL);
    const url = URL.createObjectURL(blob);
    setOutURL(url);
    setOutSize(blob.size);
    const actualMime = blob.type || preferredMime || "image/jpeg";
    setOutMime(actualMime);
    const baseName = file ? file.name.replace(/\.[^/.]+$/, "") : "image";
    const ext = mimeToExt(actualMime);
    setOutFilename(`compressly-${baseName}.${ext}`);
  }

  // Helper: detect HEIC by MIME or filename
  function isHeicFile(f) {
    if (!f) return false;
    const t = (f.type || "").toLowerCase();
    const name = (f.name || "").toLowerCase();
    return (
      t.includes("heic") ||
      t.includes("heif") ||
      name.endsWith(".heic") ||
      name.endsWith(".heif")
    );
  }

  // Attempt to create a preview URL for a file (HEIC-aware)
  // returns { previewBlob, previewURL } or throws
  async function generatePreviewForFile(file, progressCb = () => { }) {
    // Quick path for common image types
    if (!isHeicFile(file)) {
      return { previewBlob: file, previewURL: URL.createObjectURL(file) };
    }

    // It's HEIC/HEIF — try native decode first
    progressCb(5, "Checking native HEIC support...");
    try {
      const decoded = await decodeImage(file);
      const canvas = await renderScaled(decoded, decoded.width, decoded.height);
      const jb = await canvasToBlobWithFallback(
        canvas,
        "image/jpeg",
        Math.max(0.8, quality || 0.8)
      );
      if (jb && jb.size) {
        return { previewBlob: jb, previewURL: URL.createObjectURL(jb) };
      }
      // else fall through to library fallback
    } catch (err) {
      // native decode likely not supported — continue
      console.info("Native HEIC decode unavailable", err?.message || err);
    }

    // Load heic2any on demand (dynamic import -> CDN fallback)
    progressCb(20, "Loading HEIC converter...");
    let heic2anyFn = null;
    try {
      const mod = await import("heic2any");
      heic2anyFn = mod?.default || mod;
    } catch (e) {
      // dynamic import failed — inject CDN script and poll for window.heic2any
      if (!window.heic2any) {
        const existing = document.querySelector('script[data-heic2any="1"]');
        if (!existing) {
          const s = document.createElement("script");
          s.src =
            "https://cdn.jsdelivr.net/npm/heic2any@0.5.2/dist/heic2any.min.js";
          s.async = true;
          s.setAttribute("data-heic2any", "1");
          document.head.appendChild(s);
        }
        // wait up to 8s
        const start = Date.now();
        await new Promise((resolve, reject) => {
          (function poll() {
            if (window.heic2any) return resolve();
            if (Date.now() - start > 8000)
              return reject(new Error("heic2any load timeout"));
            setTimeout(poll, 200);
          })();
        });
        heic2anyFn = window.heic2any;
      } else {
        heic2anyFn = window.heic2any;
      }
    }

    if (!heic2anyFn) throw new Error("HEIC converter unavailable");

    progressCb(45, "Converting HEIC for preview...");
    const out = await heic2anyFn({
      blob: file,
      toType: "image/jpeg",
      quality: Math.max(0.7, Math.min(0.95, quality || 0.85)),
    });

    // heic2any can return Blob, ArrayBuffer, or array of Blobs
    let blob = null;
    if (!out) throw new Error("HEIC conversion returned nothing");
    if (out instanceof Blob) blob = out;
    else if (Array.isArray(out) && out.length) blob = out[0];
    else if (out instanceof ArrayBuffer || out.buffer) {
      const ab = out instanceof ArrayBuffer ? out : out.buffer || out;
      blob = new Blob([ab], { type: "image/jpeg" });
    }

    if (!blob || !blob.size) throw new Error("HEIC conversion failed");

    return { previewBlob: blob, previewURL: URL.createObjectURL(blob) };
  }

  // Updated handleFiles: creates preview for HEIC files (lazy loads converter only when needed)
  async function handleFiles(files) {
    if (!files || files.length === 0) return;
    const f = files[0];

    // revoke old urls and clear previous outputs
    if (previewURL) {
      try {
        URL.revokeObjectURL(previewURL);
      } catch { }
    }
    if (outURL) {
      try {
        URL.revokeObjectURL(outURL);
      } catch { }
    }
    setOutURL("");
    setOutSize(0);
    setOutMime("");
    setOutFilename("");
    setLastNote("");
    setProgressPct(6);
    setFile(f);

    // If not HEIC, set preview directly
    if (!isHeicFile(f)) {
      setOriginalSize(f.size || 0);
      const url = URL.createObjectURL(f);
      setPreviewURL(url);
      setProgressPct(0);
      return;
    }

    // For HEIC: generate preview (native decode or convert to jpeg)
    try {
      const { previewBlob, previewURL: purl } = await generatePreviewForFile(
        f,
        (pct, note) => {
          setProgressPct(Math.min(98, pct));
          setLastNote(note || "");
        }
      );
      setPreviewURL(purl);
      setOriginalSize(previewBlob.size || f.size || 0);
      // keep file as original so runCompress still converts later if needed
      setProgressPct(0);
      setLastNote("");
    } catch (err) {
      console.warn("Preview generation failed:", err);
      // fallback to raw preview (may not render in some browsers)
      try {
        const url = URL.createObjectURL(f);
        setPreviewURL(url);
        setOriginalSize(f.size || 0);
      } catch {
        setPreviewURL("");
        setOriginalSize(0);
      }
      setLastNote("HEIC preview unavailable - will try conversion when compressing.");
      setProgressPct(0);
    }
  }

  async function runCompress() {
    if (!file) return;
    setProcessing(true);
    setOutURL("");
    setOutSize(0);
    setOutMime("");
    setOutFilename("");
    setLastNote("");
    setProgressPct(4);

    try {
      let mime;
      if (format === "auto")
        mime = isWebPSupported() ? "image/webp" : "image/jpeg";
      else if (format === "webp") mime = "image/webp";
      else if (format === "jpeg") mime = "image/jpeg";
      else if (format === "png") mime = "image/png";
      else mime = file.type || "image/jpeg";

      if (mime === "image/webp" && !isWebPSupported()) mime = "image/jpeg";

      const targetBytes =
        targetKB && Number(targetKB) > 0
          ? Math.max(8 * 1024, Math.round(Number(targetKB) * 1024))
          : 0;

      const progressCb = (pct, note) => {
        setProgressPct(Math.min(98, pct));
        setLastNote(note || "");
      };

      const maxWidth = 1200;

      // --------- HEIC handling: convert if needed ----------
      let inputBlob = file;
      let usedOriginalFileName = file.name;
      if (isHeicFile(file)) {
        // give user feedback
        progressCb(6, "HEIC detected — converting to JPEG...");
        try {
          // try conversion with quality ~ current quality setting
          const conv = await convertHeicToJpegBlob(file, Math.max(0.7, quality || 0.8), progressCb);
          if (conv && conv.size) {
            inputBlob = conv;
            // keep original base name but change extension for previews & downloads
            usedOriginalFileName = (file.name || "image").replace(/\.[^/.]+$/, "") + ".jpg";
            // update preview to show converted image
            if (previewURL) URL.revokeObjectURL(previewURL);
            setPreviewURL(URL.createObjectURL(inputBlob));
            setOriginalSize(inputBlob.size);
            progressCb(30, "HEIC converted — compressing now");
          } else {
            progressCb(0, "HEIC conversion failed — using original file");
          }
        } catch (he) {
          console.warn("HEIC conversion error:", he);
          progressCb(0, "HEIC conversion failed — try another browser or convert externally");
          // proceed to attempt compression anyway (likely will fail decode)
          inputBlob = file;
        }
      }

      const blob = await compressFileOptimized(inputBlob, {
        mime,
        quality,
        targetBytes,
        maxWidth,
        progress: progressCb,
      });
      if (!blob) {
        setLastNote("Compression failed — try smaller image or lower quality.");
        setProgressPct(0);
        setProcessing(false);
        return;
      }

      // If we converted HEIC and used a different filename base, set file var for naming
      if (usedOriginalFileName) {
        // keep original 'file' state but update naming if needed
        // We intentionally do not mutate the original File object.
      }

      handleResultBlob(blob, mime);
      setLastNote("");
      setProgressPct(100);
    } catch (err) {
      console.error("runCompress: unexpected", err);
      setLastNote(`Error while compressing: ${err?.message || String(err)}.`);
      setProgressPct(0);
    } finally {
      setProcessing(false);
      setTimeout(() => setProgressPct(0), 600);
    }
  }

  const reductionPercent =
    originalSize && outSize
      ? Math.round(((originalSize - outSize) / originalSize) * 100)
      : 0;

  const displayName = outFilename || (file ? file.name : "");
  const displaySize = outSize || originalSize;

  const downloadHref = outURL || previewURL || "";
  const downloadName =
    outFilename ||
    (file
      ? `${file.name.replace(/\.[^/.]+$/, "")}.${mimeToExt(
        file.type || "image/jpeg"
      )}`
      : `compressly.${mimeToExt(outMime || "image/jpeg")}`);

  const toggleTheme = () =>
    setTheme((t) => (t === "light" ? "dark" : "light"));

  return (
    <div
      className="min-h-screen"
      style={{ background: "linear-gradient(180deg,#ffffff,#fbfdff)" }}
    >
      <div className="app-wrap">
        {/* header */}
        <header className="flex items-center justify-between mb-3 header-wrap">
          <div className="header-left flex items-center gap-2 sm:gap-3">
            <img
              src={IconImg}
              alt="Compressly"
              className="w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 object-contain"
            />
            <span className="hidden sm:inline text-sm font-medium text-slate-500">
              Compress images instantly
            </span>
          </div>

          <div className="flex items-center gap-3">
            <nav className="hidden md:flex items-center gap-3 text-sm">
              <a className="text-slate-600 hover:text-slate-900" href="#">
                Home
              </a>
              <a
                className="text-slate-600 hover:text-slate-900"
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  alert("Help");
                }}
              >
                Help
              </a>
            </nav>

            {/* theme toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="theme-toggle-btn"
              aria-label="Toggle light/dark mode"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                {/* outer circle */}
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  fill={theme === "light" ? "#111827" : "#f9fafb"}
                  stroke={theme === "light" ? "#111827" : "#f9fafb"}
                  strokeWidth="1.2"
                />
                {/* half cut-out */}
                <path
                  d="M12 3a9 9 0 0 0 0 18z"
                  fill={theme === "light" ? "#f9fafb" : "#111827"}
                />
              </svg>
            </button>

          </div>
        </header>

        <main className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* left: uploader */}
          <section className="md:col-span-8 container-card p-3 uploader-shell">
            <div
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer?.files) handleFiles(e.dataTransfer.files);
              }}
              onDragOver={(e) => e.preventDefault()}
              className="uploader rounded-lg flex flex-col gap-4 items-start"
            >
              <div className="flex-1 w-full text-center">
                <h2 className="text-base font-medium">
                  Drop images here to start compressing
                </h2>
                <p className="small-muted mt-2">
                  Free online image compressor - reduce JPG, PNG, WebP and HEIC file
                  size in your browser.
                </p>

                <div className="mt-5 flex flex-col items-center gap-2">
                  <button
                    onClick={() => inputRef.current?.click()}
                    className="primary-upload-btn"
                  >
                    Select Image
                  </button>

                  <input
                    ref={inputRef}
                    type="file"
                    accept="image/*,image/heic,.heic,.heif"
                    className="hidden"
                    onChange={(e) => handleFiles(e.target.files)}
                  />

                  <div className="small-muted text-xs">
                    Drag &amp; drop or click Select Image to upload.
                  </div>
                </div>
              </div>

              {/* preview + meta stacked below for consistent padding */}
              <div className="w-full flex items-center justify-center mt-4">
                <div className="flex items-center gap-3" style={{ minWidth: 0 }}>
                  {/* clickable preview: opens compressed image if available */}
                  <button
                    type="button"
                    className="preview-wrap result-thumb--clickable"
                    onClick={() => {
                      if (outURL) {
                        window.open(outURL, "_blank");
                      } else if (previewURL) {
                        window.open(previewURL, "_blank");
                      }
                    }}
                    disabled={!outURL && !previewURL}
                  >
                    {outURL ? (
                      <img
                        src={outURL}
                        alt="Compressed image preview"
                        className="object-contain w-full h-full"
                      />
                    ) : previewURL ? (
                      <img
                        src={previewURL}
                        alt="Original image preview"
                        className="object-contain w-full h-full"
                      />
                    ) : null}
                  </button>

                  <div className="text-xs small-muted flex flex-col items-start" style={{ minWidth: 0 }}>
                    {displayName && (
                      <div
                        className="font-medium truncate"
                        style={{ maxWidth: 180 }}
                      >
                        {displayName}
                      </div>
                    )}
                    {displaySize ? (
                      <div className="mt-1">{humanFileSize(displaySize)}</div>
                    ) : null}

                    {outURL ? (
                      <div className="mt-2 flex items-center gap-4">
                        {outURL ? (
                          <a
                            href={downloadHref}
                            download={downloadName}
                            className="uploader-download-pill"
                          >
                            Download
                          </a>
                        ) : null}

                        {outURL ? (
                          <button
                            onClick={resetAll}
                            className="uploader-reset-pill"
                          >
                            Reset
                          </button>
                        ) : null}
                      </div>

                    ) : null}
                  </div>

                </div>
              </div>

            </div>

            {/* controls */}
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div>
                <label className="control-label" htmlFor="output-format">
                  Output
                </label>
                <div className="mt-1">
                  <div className="fancy-select fancy-select--strong">
                    <select
                      id="output-format"
                      aria-label="Output format"
                      value={format}
                      onChange={(e) => setFormat(e.target.value)}
                      className="fancy-select__native"
                    >
                      <option value="jpeg">JPEG (recommended)</option>
                      <option value="webp">WebP (smaller)</option>
                      <option value="png">PNG (lossless)</option>
                      <option value="auto">Auto (WebP if supported)</option>
                    </select>
                    <div className="fancy-select__arrow" aria-hidden>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <path
                          d="M6 9l6 6 6-6"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="control-label">Quality</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="range"
                    min="0.05"
                    max="0.98"
                    step="0.01"
                    value={quality}
                    onChange={(e) => setQuality(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="w-8 text-right text-xs small-muted">
                    {Math.round(quality * 100)}%
                  </div>
                </div>
              </div>

              <div>
                <label className="control-label">Target (KB)</label>
                <div className="mt-1 flex gap-3">
                  <input
                    value={targetKB}
                    onChange={(e) =>
                      setTargetKB(e.target.value.replace(/[^\d]/g, ""))
                    }
                    placeholder="Enter size in KB/MB"
                    className="px-2 py-1 w-full text-sm target-input"
                  />

                  <button
                    onClick={runCompress}
                    disabled={!file || processing}
                    className="primary-upload-btn compress-btn-main disabled:opacity-60 text-sm flex items-center gap-2"
                  >
                    {processing ? <Spinner /> : null}
                    <span>{processing ? "Processing" : "Compress"}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-3">
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${Math.min(100, progressPct)}%` }}
                />
              </div>
              <div className="mt-2 text-xs small-muted flex justify-between">
                <div>Tip: Use WebP + Target for smallest files.</div>
                <div style={{ minWidth: 140, textAlign: "right" }}>
                  {lastNote}
                </div>
              </div>
            </div>
          </section>

          {/* right: result */}
          <aside className="md:col-span-4">
            <div className="container-card rounded-lg p-3 result-card">
              <div className="result-header flex items-start gap-3">
                <button
                  type="button"
                  className="result-thumb result-thumb--clickable"
                  onClick={() => {
                    if (outURL) window.open(outURL, "_blank");
                  }}
                  disabled={!outURL}
                >
                  {outURL ? (
                    <img
                      src={outURL}
                      alt="Compressed image preview"
                      className="w-full h-full object-contain rounded-md"
                    />
                  ) : (
                    <svg
                      width="30"
                      height="30"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="text-slate-400"
                    >
                      <rect
                        x="3"
                        y="4"
                        width="18"
                        height="14"
                        rx="2"
                        stroke="currentColor"
                        strokeWidth="1.3"
                      />
                      <path
                        d="M7 13l3-3 4 5 3-4"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle cx="9" cy="9" r="1.4" fill="currentColor" />
                    </svg>
                  )}
                </button>

                <div className="flex-1">
                  <div className="result-meta flex items-center justify-between">
                    <div>
                      <div
                        className="text-sm font-medium truncate"
                        style={{ maxWidth: 200 }}
                      >
                        {displayName || "Compressed image"}
                      </div>
                      {(outSize || displaySize) && (
                        <div className="text-xs small-muted mt-1">
                          {outSize
                            ? `Final size: ${humanFileSize(outSize)}`
                            : `Original size: ${humanFileSize(displaySize)}`}
                        </div>
                      )}
                    </div>

                    <div className="text-right">
                      {outSize ? (
                        <div className="text-base font-semibold">
                          {humanFileSizeShort(outSize)}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2 items-center">
                    <div className="chip text-xs">
                      Reduction:{" "}
                      <span
                        style={{ color: "#0f1724" }}
                        className="font-medium ml-1"
                      >
                        {reductionPercent}%
                      </span>
                    </div>
                    <div className="chip text-xs">
                      Format:{" "}
                      <span
                        style={{ color: "#0f1724" }}
                        className="font-medium ml-1"
                      >
                        {outMime ? mimeToExt(outMime) : format}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 result-actions">
                    <a
                      href={downloadHref}
                      download={downloadName}
                      className={`px-3 py-1.5 rounded-md ${outURL
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 text-slate-700"
                        } btn text-sm flex items-center gap-2`}
                      aria-disabled={!downloadHref}
                    >
                      <DownloadIcon />{" "}
                      <span>{outURL || previewURL ? `Download` : "Download"}</span>
                    </a>

                    <button
                      onClick={() => {
                        if (outURL) window.open(outURL, "_blank");
                      }}
                      disabled={!outURL}
                      className="open-link px-2 py-1 border rounded-md text-sm disabled:opacity-60"
                    >
                      Open in new tab
                    </button>
                  </div>

                  <div className="mt-3 text-xs small-muted">
                    Tip: If target isn't reached try lowering quality or
                    choosing WebP.
                  </div>
                </div>
              </div>
            </div>

            <div className="container-card quick-help-card minimal-card">
              <div className="text-sm font-medium">Quick help</div>
              <div className="text-xs small-muted">
                For forms: Many forms require ≤100KB - use Target (KB) + JPEG.
                For web: WebP gives smaller files and faster pages.
              </div>
            </div>
          </aside>

          {/* informational cards */}
          {/* FAQ section */}
          <section className="md:col-span-12 mt-4">
            <div className="faq-card container-card">
              <div className="faq-item faq-item--blue">
                <div className="faq-stripe" />
                <div className="faq-content">
                  <h3 className="faq-q">
                    Is it really free to compress images with Compressly?
                  </h3>
                  <p className="faq-a">
                    Yes, Compressly is completely free to use with no accounts,
                    watermarks or hidden limits. You can compress as many JPG, PNG
                    and WebP images as you need for web, forms and email.
                  </p>
                </div>
              </div>

              <div className="faq-item faq-item--green">
                <div className="faq-stripe" />
                <div className="faq-content">
                  <h3 className="faq-q">
                    How secure is it to compress images online?
                  </h3>
                  <p className="faq-a">
                    All compression happens locally in your browser, so your images
                    are never uploaded to a server. This keeps personal photos and
                    documents private on your own device.
                  </p>
                </div>
              </div>

              <div className="faq-item faq-item--purple">
                <div className="faq-stripe" />
                <div className="faq-content">
                  <h3 className="faq-q">
                    What is the maximum file size I can compress?
                  </h3>
                  <p className="faq-a">
                    Compressly is tuned for everyday photos, screenshots and form
                    uploads. Very large files may take longer, but most images from
                    phones and cameras work great.
                  </p>
                </div>
              </div>

              <div className="faq-item faq-item--orange">
                <div className="faq-stripe" />
                <div className="faq-content">
                  <h3 className="faq-q">
                    Can I compress images for government or job portals?
                  </h3>
                  <p className="faq-a">
                    Yes, you can quickly reduce file size to meet KB limits used by
                    government sites, job portals and college forms while keeping the
                    image readable.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* About section */}
          <section
            id="about"
            className="md:col-span-12 container-card p-4 soft-shadow mt-6 about-card"
          >
            <div className="font-medium text-base">About Compressly:</div>

            {/* About section content (SEO-rich) */}
            <div className="mt-2 small-muted text-sm leading-relaxed">
              <strong>Compressly</strong> is a free, privacy-first image
              compressor that runs entirely in your browser - no uploads, no
              accounts, and no tracking. Compressly reduces JPG, PNG and WebP
              images to much smaller sizes while keeping visual quality,
              helping you meet file-size limits for web forms, email
              attachments, government portals, and job application uploads.
              <br />
              <br />
              Key features:
              <ul>
                <li>
                  Fast client-side compression - everything happens locally in
                  your browser.
                </li>
                <li>
                  Target-size compression (for example: compress image to 100
                  KB) with smart quality search and adaptive downscaling.
                </li>
                <li>
                  Support for JPEG, PNG and WebP formats, plus easy download
                  options.
                </li>
                <li>
                  Mobile-friendly and tuned for low-end phones - perfect for
                  users with limited bandwidth.
                </li>
              </ul>
              <br />
              How to use: choose an image, pick a format or enter a target size
              (KB), press <strong>Compress</strong>, then{" "}
              <strong>Download</strong>. Use WebP + Target for the smallest
              files.
              <br />
              <br />
              Compressly is ideal for anyone who needs to quickly reduce image
              file sizes: students submitting forms, job applicants, bloggers,
              small business owners, and web developers aiming to speed up page
              load times.
              <br />
              <br />
              Learn more: try the quick links below to compress a JPEG or
              compress an image to 100 KB.
            </div>
          </section>
        </main>

        <footer>
          <div className="footer-inner">
            <div className="brand-text">
              Made by Leosh ads · © Compressly 2025
            </div>

            <div className="footer-links">
              <a href="#about">About Compressly</a>
              <span>•</span>
              <a href="/compress-image-to-100kb.html">Compress to 100 KB</a>
              <span>•</span>
              <a href="/compress-jpg-online.html">Compress JPG online</a>
              <span>•</span>
              <a href="/compress-png-online.html">Compress PNG online</a>
              <span>•</span>
              <a href="/privacy.html">Privacy</a>
            </div>
          </div>

          {import.meta.env.DEV && <SpeedInsights />}

        </footer>
      </div>
    </div>
  );
}
