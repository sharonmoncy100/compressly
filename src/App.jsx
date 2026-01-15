// App.jsx - with HEIC input support (converts HEIC->JPEG before compressing)
// Minimal, lazy-loaded heic2any usage. If browser natively supports HEIC (createImageBitmap or <img>), we use that first.

import React, { useRef, useState, useEffect } from "react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import Header from "./components/Header";
import Uploader from "./components/Uploader";
import { createPortal } from "react-dom";




/* Vite-safe asset URLs */
const Icon64 = new URL("./assets/icon-64.png", import.meta.url).href;
const Icon128 = new URL("./assets/icon-128.png", import.meta.url).href;


/* Helper: show human-friendly size (1024 base) and also show exact bytes */
function humanFileSizeShort(bytes) {
  if (!bytes && bytes !== 0) return "0 B";
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
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
    ctx.save();

    if (sourceObj.blurPx > 0) {
      ctx.filter = `blur(${sourceObj.blurPx}px)`;
    }

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

    ctx.restore();
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

  // Apply blur ONLY if defined (JPEG low-KB smoothing)
  ctx.save();

  if (sourceObj.blurPx && sourceObj.blurPx > 0) {
    ctx.filter = `blur(${sourceObj.blurPx}px)`;
  }

  ctx.drawImage(tmpCanvas, 0, 0, sw, sh, 0, 0, targetW, targetH);

  ctx.restore();

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
    progressCb(25, "Native decode OK - converting to JPEG...");
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

function quantizeImageData(imageData, levels = 32) {
  const data = imageData.data;
  const step = Math.max(1, Math.floor(256 / levels));

  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.round(data[i] / step) * step; // R
    data[i + 1] = Math.round(data[i + 1] / step) * step; // G
    data[i + 2] = Math.round(data[i + 2] / step) * step; // B
    // alpha untouched
  }
  return imageData;
}
/* Main fast compressor with aggressive options */
async function compressFileOptimized(fileBlob, opts = {}) {
  const {
    mime = "image/jpeg",
    quality = 0.82,
    targetBytes = 0,
    maxWidth = 0,
    progress = () => { },
    pngOptimized = false
  } = opts;



  const src = await decodeImage(fileBlob);
  // --- Detect compression pressure (KB per pixel) ---
  const totalPixels = src.width * src.height;
  const kbPerPixel = targetBytes > 0 ? targetBytes / totalPixels : Infinity;

  function estimateQualityFromKB(kbPerPixel) {
    if (kbPerPixel > 0.15) return 0.9;
    if (kbPerPixel > 0.10) return 0.82;
    if (kbPerPixel > 0.07) return 0.75;
    if (kbPerPixel > 0.05) return 0.68;
    if (kbPerPixel > 0.035) return 0.6;
    return 0.5;
  }
  let estimatedQ = quality;

  // ⚠️ Only estimate quality if caller did NOT already decide
  if (
    targetBytes > 0 &&
    mime === "image/jpeg" &&
    !pngOptimized &&
    quality < 0.85
  ) {
    estimatedQ = estimateQualityFromKB(kbPerPixel);
  }



  // --- Smart downscaling for impossible KB targets (tuned for face photos) ---
  let scaleFactor = 1;

  // Resize ONLY for extreme targets
  if (mime === "image/jpeg" && targetBytes > 0 && !pngOptimized) {
    if (kbPerPixel < 0.012) {
      scaleFactor = 0.8; // gentler resize for portraits
    }
  }


  // ---- HARD resize source ONCE if scaleFactor < 1 ----
  let workingSrc = src;

  // --- Slider-only safeguard: auto downscale at very low quality ---
  if (!targetBytes && mime === "image/jpeg") {
    if (quality < 0.45) {
      const longEdge = Math.max(workingSrc.width, workingSrc.height);
      if (longEdge > 800) {
        const r = 800 / longEdge;
        const scaledCanvas = await renderScaled(
          workingSrc,
          Math.round(workingSrc.width * r),
          Math.round(workingSrc.height * r)
        );
        workingSrc = await decodeImage(
          await canvasToBlobWithFallback(scaledCanvas, "image/png", 1)
        );
      }
    }
  }


  if (scaleFactor < 1) {
    const scaledCanvas = await renderScaled(
      workingSrc,
      Math.round(workingSrc.width * scaleFactor),
      Math.round(workingSrc.height * scaleFactor)
    );

    const scaledBlob = await canvasToBlobWithFallback(
      scaledCanvas,
      "image/png",
      1
    );

    workingSrc = await decodeImage(scaledBlob);
  }

  // Hard clamp long edge for human photos
  let LONG_EDGE_MAX = 1000;

  if (targetBytes > 200 * 1024) LONG_EDGE_MAX = 1400;
  if (targetBytes > 400 * 1024) LONG_EDGE_MAX = 1800;
  if (targetBytes > 700 * 1024) LONG_EDGE_MAX = 2400;
  if (targetBytes > 1200 * 1024) LONG_EDGE_MAX = 3200;



  if (mime === "image/jpeg") {
    const longEdge = Math.max(workingSrc.width, workingSrc.height);
    if (longEdge > LONG_EDGE_MAX) {
      const r = LONG_EDGE_MAX / longEdge;
      const clampCanvas = await renderScaled(
        workingSrc,
        Math.round(workingSrc.width * r),
        Math.round(workingSrc.height * r)
      );
      workingSrc = await decodeImage(
        await canvasToBlobWithFallback(clampCanvas, "image/png", 1)
      );
    }
  }


  // Decide blur strength for JPEG photos
  let blurPx = 0;

  // JPEG photo smoothing zone
  // Minimal smoothing ONLY for extreme JPEG targets
  // Minimal smoothing ONLY for extreme JPEG targets
  if (mime === "image/jpeg" && !pngOptimized && targetBytes > 0) {
    if (kbPerPixel < 0.015) blurPx = 0.55;   // ~20–25 KB
    else if (kbPerPixel < 0.022) blurPx = 0.3; // ~30–40 KB
    else blurPx = 0; // NO blur above ~40 KB
  }


  blurPx = Math.min(blurPx, 0.6);
  workingSrc.blurPx = blurPx;

  // ---------- EARLY EXIT (clean encode, no aggressive loops) ----------
  if (!pngOptimized && mime === "image/jpeg" && targetBytes > 0) {
    progress(18, "Checking optimal encode");

    const testCanvas = await renderScaled(
      workingSrc,
      workingSrc.width,
      workingSrc.height
    );

    const testBlob = await canvasToBlobWithFallback(
      testCanvas,
      mime,
      estimatedQ
    );
    if (
      testBlob &&
      testBlob.size <= targetBytes &&
      testBlob.size >= targetBytes * 0.95
    ) {
      progress(90, "Finalizing");
      return testBlob;
    }

  }
  // ---------------------------------------------------------------


  let srcW = workingSrc.width;
  let srcH = workingSrc.height;


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
    const canvas = await renderScaled(workingSrc, targetW, targetH);

    if (pngOptimized && mime === "image/png") {
      const ctx = canvas.getContext("2d");
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const levels = Math.max(8, Math.round(quality * 48));
      ctx.putImageData(quantizeImageData(imgData, levels), 0, 0);
    }

    progress(40, "Encoding image");
    return await canvasToBlobWithFallback(canvas, mime, quality);
  }



  // AGGRESSIVE QUALITY SEARCH
  progress(15, "Searching quality");
  const Q_ITER = 10;
  let lowQ = Math.max(0.1, estimatedQ - 0.15);
  let highQ = Math.min(0.95, estimatedQ + 0.15);

  let bestBlob = null;
  let bestSize = 0;

  const TARGET_TOLERANCE = 0.98; // aim for 98–100% of target


  const isExtremeJPEG = (
    mime === "image/jpeg" &&
    targetBytes > 0 &&
    kbPerPixel < 0.018
  );

  for (let i = 0; i < Q_ITER; i++) {
    const q = (lowQ + highQ) / 2;
    progress(
      15 + Math.round((i / Q_ITER) * 20),
      `Trying quality ${Math.round(q * 100)}%`
    );
    const canvas = await renderScaled(workingSrc, targetW, targetH);
 

  

    if (pngOptimized && mime === "image/png") {
      const ctx = canvas.getContext("2d");
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const levels = Math.max(8, Math.round(q * 48));
      ctx.putImageData(quantizeImageData(imgData, levels), 0, 0);
    }
   

    const blob = await canvasToBlobWithFallback(canvas, mime, q);

    if (!blob) continue;
    const s = blob.size;
    // Keep the largest result that is <= targetBytes (exam-safe)
    if (s <= targetBytes) {
      // keep the largest result under target
      if (!bestBlob || s > bestSize) {
        bestBlob = blob;
        bestSize = s;
      }

      // stop early if we are very close to target
      if (s >= targetBytes * TARGET_TOLERANCE) {
        progress(90, "Finalizing");
        return blob;
      }
    }



    // Guide binary search
    if (s > targetBytes) {
      highQ = q;
    } else {
      lowQ = q;
    }

   
    await new Promise((r) => setTimeout(r, 0));
  }

  if (bestBlob) {
    // Prefer <= target (exam-safe)
    if (bestSize <= targetBytes) {
      progress(90, "Finalizing");
      return bestBlob;
    }

    // Fallback: very close (rare)
    if (bestSize <= targetBytes * 1.02) {
      progress(90, "Finalizing");
      return bestBlob;
    }
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
        `Downscale ${attempt + 1}/${MAX_DOWNS} - q ${Math.round(q * 100)}%`
      );
      const canvas = await renderScaled(workingSrc, currentW, currentH);
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
    workingSrc,
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
  const [modalImage, setModalImage] = useState(null);

  const [outURL, setOutURL] = useState("");
  const [outSize, setOutSize] = useState(0);
  const [outMime, setOutMime] = useState("");
  const [outFilename, setOutFilename] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [tempName, setTempName] = useState("");


  const [quality, setQuality] = useState(0.82);
  const [targetKB, setTargetKB] = useState("");
  const [processing, setProcessing] = useState(false);
  const [format, setFormat] = useState("jpeg");
  const [lastNote, setLastNote] = useState("");
  const [progressPct, setProgressPct] = useState(0);
  const [hasAnimatedScrollCue, setHasAnimatedScrollCue] = useState(false);
  const [shouldAnimateScrollCue, setShouldAnimateScrollCue] = useState(false);



  // Auto-sync quality slider when Target KB is edited (JPEG only)
  // Runs ONLY when targetKB or format changes


  // compact theme switcher (localStorage + data-theme)
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "light";
    return window.localStorage.getItem("compressly-theme") || "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem("compressly-theme", theme);
  }, [theme]);

  useEffect(() => {
    function handleEsc(e) {
      if (e.key === "Escape") {
        document.activeElement?.blur(); // ✅ IMPORTANT
        setModalImage(null);
      }
    }

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  useEffect(() => {
    if (!modalImage) return;

    const handleKeyDown = (e) => {
      if (e.key === "Tab") {
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalImage]);

  useEffect(() => {
    if (!modalImage) return;

    // Push a history state when modal opens
    window.history.pushState({ modal: true }, "");

    const handlePopState = () => {
      setModalImage(null);
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [modalImage]);


  useEffect(() => {
    console.log("MODAL STATE CHANGED:", modalImage);
  }, [modalImage]);

  useEffect(() => {
    if (file && !previewURL) {
      const url = URL.createObjectURL(file);
      setPreviewURL(url);
    }
  }, [file, previewURL]);


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
    if (inputRef?.current) {
      inputRef.current.value = "";
    }

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
    setOutFilename(`${baseName}-compressed.${ext}`);
    setTempName(`${baseName}-compressed`);

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

    // It's HEIC/HEIF - try native decode first
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
      // native decode likely not supported - continue
      console.info("Native HEIC decode unavailable", err?.message || err);
    }

    // Load heic2any on demand (dynamic import -> CDN fallback)
    progressCb(20, "Loading HEIC converter...");
    let heic2anyFn = null;
    try {
      const mod = await import("heic2any");
      heic2anyFn = mod?.default || mod;
    } catch (e) {
      // dynamic import failed - inject CDN script and poll for window.heic2any
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

    // Smooth scroll to compress controls on mobile/tablet (skip on desktop with large screen)
    if (typeof window !== "undefined") {
      setTimeout(() => {
        const compressSection = document.getElementById("compress-controls");
        if (compressSection && window.innerWidth < 1024) {
          compressSection.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 50);
    }
  }

  async function runCompress() {
    let smoothTimer = null;

    const startSmoothProgress = () => {
      let fake = 10;
      setProgressPct(fake);
      smoothTimer = setInterval(() => {
        fake += Math.random() * 2.5 + 0.5;
        setProgressPct((p) => Math.min(85, Math.max(p, fake)));
      }, 160);
    };

    const stopSmoothProgress = () => {
      if (smoothTimer) {
        clearInterval(smoothTimer);
        smoothTimer = null;
      }
    };

    
    if (!file) return;
    setProcessing(true);
    setOutURL("");
    setOutSize(0);
    setOutMime("");
    setOutFilename("");
    setLastNote("Preparing image…");
    setProgressPct(4);
    startSmoothProgress();

    /* 🔴 ADD THESE TWO LINES */
    setProgressPct(45);
    setLastNote("Processing image… this may take a few seconds...");

    /* 🔴 ADD THIS LINE */
    await new Promise(r => setTimeout(r, 0));


    try {
      const targetBytes =
        targetKB && Number(targetKB) > 0
          ? Math.max(8 * 1024, Math.round(Number(targetKB) * 1024))
          : 0;

      // 🔒 Target-size mode: start from higher quality to avoid undershoot
      let effectiveQuality = quality;

      if (targetBytes > 0) {
        effectiveQuality = 0.88;
      }


      // If user increases target KB, reset aggressive assumptions
      if (targetBytes > 0 && originalSize > 0) {
        if (targetBytes > originalSize * 0.9) {
          // Target is close to original - no need for aggressive compression
          setQuality(0.9);
        }
      }


      let mime;
      const isPNG = (file.type === "image/png" || file.name.toLowerCase().endsWith(".png"));

      if (format === "auto") {
        // If PNG + very low target, prefer JPEG/WebP automatically
        if (isPNG && targetBytes && targetBytes < 80 * 1024) {
          mime = isWebPSupported() ? "image/webp" : "image/jpeg";
          setLastNote("PNG converted to smaller format to reach target size");
        } else {
          mime = isWebPSupported() ? "image/webp" : "image/jpeg";
        }
      } else if (format === "png") {
        // PNG cannot reach very small sizes – auto fallback
        if (targetBytes && targetBytes < 80 * 1024) {
          mime = isWebPSupported() ? "image/webp" : "image/jpeg";
          setLastNote("PNG cannot reach very small sizes. Converted automatically.");
        } else {
          mime = "image/png";
        }
      } else if (format === "webp") {
        mime = "image/webp";
      } else if (format === "jpeg") {
        mime = "image/jpeg";
      } else {
        mime = file.type || "image/jpeg";
      }

      if (mime === "image/webp" && !isWebPSupported()) mime = "image/jpeg";

  
      const progressCb = (pct, note) => {
        setProgressPct(Math.min(98, pct));
        setLastNote(note || "");
      };

      let maxWidth = 1200;

      if (targetBytes > 200 * 1024) maxWidth = 1600;
      if (targetBytes > 400 * 1024) maxWidth = 2000;
      if (targetBytes > 700 * 1024) maxWidth = 2600;
      if (targetBytes > 1200 * 1024) maxWidth = 3400;


      // --------- HEIC handling: convert if needed ----------
      let inputBlob = file;
      let usedOriginalFileName = file.name;
      if (isHeicFile(file)) {
        // give user feedback
        progressCb(6, "HEIC detected - converting to JPEG...");
        try {
          // try conversion with quality ~ current quality setting
          const conv = await convertHeicToJpegBlob(file, Math.max(0.7, quality || 0.8), progressCb);
          if (conv && conv.size) {
            inputBlob = conv;
            // keep original base name but change extension for previews & downloads
            usedOriginalFileName = (file.name || "image").replace(/\.[^/.]+$/, "") + ".jpg";
            // update preview to show converted image
           
            setPreviewURL(URL.createObjectURL(inputBlob));
            setOriginalSize(inputBlob.size);
            progressCb(30, "HEIC converted - compressing now");
          } else {
            progressCb(0, "HEIC conversion failed - using original file");
          }
        } catch (he) {
          console.warn("HEIC conversion error:", he);
          progressCb(0, "HEIC conversion failed - try another browser or convert externally");
          // proceed to attempt compression anyway (likely will fail decode)
          inputBlob = file;
        }
      }
   


      const blob = await compressFileOptimized(inputBlob, {
        mime,
        quality: effectiveQuality,
        targetBytes,
        maxWidth,
        progress: progressCb,
        pngOptimized: format === "png-optimized"
      });
      stopSmoothProgress();

      if (!blob) {
        setLastNote("Compression failed - try smaller image or lower quality.");
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

      // let the progress bar finish before hiding
      setTimeout(() => {
        setProcessing(false);
        setProgressPct(0);

        // 🔥 trigger animation ONLY ONCE
        if (!hasAnimatedScrollCue) {
          setShouldAnimateScrollCue(true);
          setHasAnimatedScrollCue(true);
        }

        if (typeof window !== "undefined") {
          const resultSection = document.getElementById("compressed-result");
          if (resultSection && window.innerWidth < 1024) {
            resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }
      }, 500);


    } catch (err) {
      console.error("runCompress: unexpected", err);
      setLastNote(`Error while compressing: ${err?.message || String(err)}.`);
      setProgressPct(0);
    } finally {
      stopSmoothProgress();
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
      className="min-h-screen app-bg">
        
      <div className="page-shell">

        {/* header */}
        <Header
          Icon64={Icon64}
          Icon128={Icon128}
          theme={theme}
          toggleTheme={toggleTheme}
        />

        <div className="app-wrap">

        {/* Headline wrapper: KEEP H1 in DOM first (SEO), but visually show H2 above */}
          <div className="hero-headings">
            {/* SEO + trust grouped */}
            <div className="hero-subgroup">
              <h1 className="page-h1">
                Free Online Image Compressor - Compress JPG, PNG, WebP & HEIC
              </h1>

              <p className="trust-note">
                All image processing happens locally in your browser. No files are uploaded.
                You can upload and compress images securely without creating an account or sending files to any external server. Your images stay on your device at all times, making Compressly suitable for personal photos, official documents, and form submissions where privacy is important.
              </p>
            </div>

            {/* Primary user action */}
            <section aria-labelledby="uploader-heading" className="hero-section">
              <h2 id="uploader-heading" className="page-h2">
                Upload & Compress Images
              </h2>
            </section>
          </div>




        <main className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* left: uploader */}
          <Uploader
            inputRef={inputRef}
            handleFiles={handleFiles}
            previewURL={previewURL}
            outURL={outURL}
            file={file}
            originalSize={originalSize}
            displayName={displayName}
            displaySize={displaySize}
            humanFileSize={humanFileSize}
            quality={quality}
            setQuality={setQuality}
            targetKB={targetKB}
            setTargetKB={setTargetKB}
            runCompress={runCompress}
            processing={processing}
            resetAll={resetAll}
            progressPct={progressPct}
            lastNote={lastNote}
            format={format}
            setFormat={setFormat}
              openPreview={(url) => setModalImage(url)}
              hasAnimatedScrollCue={hasAnimatedScrollCue}
              shouldAnimateScrollCue={shouldAnimateScrollCue}
              setShouldAnimateScrollCue={setShouldAnimateScrollCue}
          />


          {/* right: result */}
          <aside className="md:col-span-4">
              <div
                id="compressed-result"
                className="container-card rounded-lg result-card"
              >
                <h2 className="card-heading">Compressed Result</h2>

                {!outURL ? (
                  <div className="result-empty-state">
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                      className="result-empty-icon"
                    >
                      <path
                        d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>

                    <p className="result-empty-text">
                      Select an image and click <strong>Compress</strong> to see the result here.
                    </p>
                  </div>
              ) : (
                    /* AFTER compression */
                    <>
                      {/* ===============================
  RESULT HEADER (image + meta)
 =============================== */}
                      <div className="result-header flex items-start gap-4">
                        <div
                          className="image-preview-frame result-preview-frame cursor-pointer"
                          onClick={() => setModalImage(outURL)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setModalImage(outURL);
                            }
                          }}
                        >
                          <img
                            src={outURL}
                            alt="Compressed image preview"
                            className="max-w-[88%] max-h-[88%] object-contain"
                          />
                        </div>

                        <div className="flex-1">
                          {/* Filename + rename button */}
                          <div className="relative flex items-center gap-1" style={{ maxWidth: 220 }}>
                            {!isRenaming ? (
                              <>
                                <span className="text-sm font-medium truncate flex-1">
                                  {outFilename}
                                </span>

                                <button
                                  type="button"
                                  aria-label="Rename file"
                                  title="Rename file"
                                  onClick={() => {
                                    setTempName(outFilename.replace(/\.[^/.]+$/, ""));
                                    setIsRenaming(true);
                                  }}
                                  className="secondary-pill secondary-pill--icon"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                                    <path
                                      d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41L18.37 3.29a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                                      fill="currentColor"
                                    />
                                  </svg>
                                </button>
                              </>
                            ) : (
                              <input
                                autoFocus
                                value={tempName}
                                onChange={(e) => setTempName(e.target.value)}
                                onBlur={() => {
                                  const cleaned = tempName.trim();
                                  if (!cleaned) {
                                    setIsRenaming(false);
                                    return;
                                  }
                                  if (!cleaned.replace(/\./g, "")) {
                                    setIsRenaming(false);
                                    return;
                                  }
                                  const ext = outFilename.match(/\.[^/.]+$/)?.[0] || "";
                                  setOutFilename(`${cleaned}${ext}`);
                                  setIsRenaming(false);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") e.currentTarget.blur();
                                  if (e.key === "Escape") setIsRenaming(false);
                                }}
                                className="text-sm font-medium rename-input w-full"
                              />
                            )}
                          </div>


                          {/* Final size - TIGHT spacing */}
                          <div className="text-xs small-muted">

                            Final size: {humanFileSize(outSize)}
                          </div>

                          {/* Download button - TIGHT spacing */}
                          <div>

                            <a href={outURL} download={downloadName} className="download-btn">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path
                                  d="M12 3v10m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
                                  stroke="currentColor"
                                  strokeWidth="1.6"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                              <span>Download</span>
                            </a>
                          </div>
                        </div>
                      </div>

                      {/* ===============================
      BEFORE / AFTER COMPARISON
     =============================== */}
              

                      <div className="comparison-wrap">
                        <div className="comparison-heading">
                          Image comparison
                        </div>

                        <div className="comparison-grid">
                          <div
                            className="comparison-item"
                            onClick={() => setModalImage(previewURL)}
                            role="button"
                            tabIndex={0}
                          >
                          
                            <div className="comparison-frame">
                              <span className="comparison-badge">Before</span>
                              <img src={previewURL} alt="Original image" loading="lazy"/>
                            </div>

                            <div className="comparison-size">
                              {humanFileSize(originalSize)}
                            </div>
                          </div>

                          <div
                            className="comparison-item"
                            onClick={() => setModalImage(outURL)}
                            role="button"
                            tabIndex={0}
                          >
                            
                            <div className="comparison-frame">
                              <span className="comparison-badge comparison-badge--after">
                                After
                              </span>
                              <img src={outURL} alt="Compressed image" loading="lazy" />
                            </div>

                            <div className="comparison-size">
                              {humanFileSize(outSize)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </>


                
              )}
              


            </div>

            <div className="container-card quick-help-card minimal-card">
              <div className="flex items-center gap-2">
                <span className="h-3 w-1 rounded-full bg-slate-300" />
                <div className="quick-help-title tracking-wide">
                  Quick help
                </div>
              </div>

              {/* spacer - card-safe */}
              <div className="h-1"></div>

              <div className="text-xs small-muted">
                <div>
                  <span className="font-medium">For forms:</span>{" "}
                  Use <span className="font-medium">Target (KB)</span> with{" "}
                  <span className="font-medium">JPEG</span> to meet upload limits.
                </div>
                <div className="mt-1">
                  <span className="font-medium">For websites:</span>{" "}
                  Choose <span className="font-medium">WebP</span> for smaller files and
                  faster loading.
                </div>
              </div>

            </div>

          </aside>
      
            {/* ===============================
    How to Get the Best Compression Results
   =============================== */}
            <section id="compression-tips" className="mt-6">
              <h2
                id="compression-tips-heading"
                className="section-h2"
                style={{ paddingLeft: 20 }}
              >
                How to get the best compression results
              </h2>

              <div className="container-card mt-2">
                {/* ⬅ MATCH ABOUT SECTION PADDING */}
                <div className="small-muted text-sm leading-relaxed px-[20px] py-[6px]">
                  <p>
                    Compressing images is not only about reducing file size. It's about choosing
                    the right format, keeping visual quality intact, and making sure the image
                    fits its purpose - whether that's a website, an online form, or sharing. 
                  </p>

                  <div className="mt-3 space-y-2">
                    <div>
                      <strong className="text-slate-900">
                        Choose the right format:
                      </strong>{" "}
                      JPEG works best for photographs, WebP usually produces smaller files for
                      websites, and PNG is ideal for logos or images with text. HEIC files take a little more time to convert but can be compressed well.
                    </div>

                    <div>
                      <strong className="text-slate-900">
                        Use Target (KB) when size matters:
                      </strong>{" "}
                      If an upload requires a strict file size, enter a target size instead of
                      adjusting quality manually. Compressly automatically balances quality
                      and file size for you.
                    </div>

                    <div>
                      <strong className="text-slate-900">
                        Compare before downloading:
                      </strong>{" "}
                      Use the before and after comparison to make sure important details,
                      edges, and text remain clear after compression.
                    </div>

                    <div>
                      <strong className="text-slate-900">
                        Rename files when needed:
                      </strong>{" "}
                      Rename the compressed image before downloading to keep your files
                      organized for forms, projects, or sharing.
                    </div>

                    <div>
                      <strong className="text-slate-900">
                        Your images stay private:
                      </strong>{" "}
                      All compression happens locally in your browser. Images are never uploaded
                      or stored on any server.
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* ===============================
   Why Image Compression Matters
   =============================== */}
            <section id="why-compression-matters" className="mt-6">
              <h2 className="section-h2" style={{ paddingLeft: 20 }}>
                Why image compression matters for websites and forms
              </h2>

              <div className="container-card mt-2">
                {/* INNER WRAPPER - matches About section indent */}
                <div className="small-muted text-sm leading-relaxed" style={{ padding: "12px 20px" }}>
                  <p>
                    Image compression plays an important role in how quickly images load
                    and whether they are accepted by websites, online forms, and upload
                    systems. Many government portals, job applications, and college forms
                    enforce strict file size limits, which can cause uncompressed images
                    to be rejected even if the image quality is good.
                  </p>

                  <p className="mt-2">
                    For websites and blogs, large image files can slow down page loading,
                    especially on mobile devices or slower internet connections. Smaller,
                    optimized images help pages load faster, improve user experience, and
                    reduce unnecessary data usage for visitors.
                  </p>

                  <p className="mt-2">
                    Compression is not about making images blurry or unusable. When done
                    correctly, it reduces file size while preserving visual clarity, text
                    readability, and important details. Choosing the right format and
                    compression method ensures images remain suitable for their intended
                    purpose.
                  </p>

                  <p className="mt-2">
                    With Compressly, you can quickly prepare images for uploads, sharing,
                    or publishing without installing software or creating an account -
                    making image compression simple, private, and accessible to everyone.
                  </p>
                </div>
              </div>
            </section>

            {/* ===============================
   When and why you should compress images
   =============================== */}
            <section id="when-to-compress-images" className="mt-6">
              <h2 className="section-h2" style={{ paddingLeft: 20 }}>
                When and why you should compress images
              </h2>

              <div className="container-card mt-2">
                {/* INNER WRAPPER - same indent as About */}
                <div className="small-muted text-sm leading-relaxed" style={{ padding: "12px 20px" }}>
                  <p>
                    Image compression becomes important whenever images need to be uploaded,
                    shared, or displayed efficiently. This is especially common when submitting
                    documents to government portals, job applications, college admissions,
                    or online forms that enforce strict file size limits.
                  </p>

                  <p className="mt-2">
                    Compression is also useful for everyday sharing. Sending images through
                    email, messaging apps, or cloud uploads can be slower and less reliable
                    when files are large. Smaller image sizes upload faster, use less data,
                    and are easier for recipients to download and view.
                  </p>

                  <p className="mt-2">
                    For websites and online projects, compressing images helps maintain a
                    smooth browsing experience. Optimized images reduce page load time,
                    lower bandwidth usage, and make sites more accessible for users on
                    mobile devices or slower internet connections.
                  </p>

                  <p className="mt-2">
                    Compressly is designed to handle these situations without complexity.
                    You can upload an image, choose the right format or target size, preview
                    the result, and download the optimized file - all without installing
                    software or worrying about privacy.
                  </p>
                </div>
              </div>
            </section>


          {/* informational cards */}
          {/* FAQ section */}
          <section className="md:col-span-12 mt-4" aria-labelledby="faq-heading">
              <h2 id="faq-heading" className="section-h2">
                Frequently Asked Questions
              </h2>

              <div className="faq-card container-card mb-10">

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
                    Yes, you can quickly reduce file size inorder to meet KB limits that is used by
                    government sites, job portals and college forms while keeping the
                    image readable.
                  </p>
                </div>
              </div>

              <div className="faq-item faq-item--neutral">
                <div className="faq-stripe" />
                <div className="faq-content">
                  <h3 className="faq-q">
                    Are JPEG and JPG the same format?
                  </h3>
                  <p className="faq-a">
                    Yes. JPEG and JPG are the same image format with identical quality and
                    compression. The only difference is the file extension. Both JPEG and JPG
                    files are accepted by websites, government portals and exam forms.
                  </p>
                </div>
              </div>

            </div>
          </section>
          

            {/* About section */}
            <section
              id="about"
              className="md:col-span-12 mt-6"
              aria-labelledby="about-heading"
            >

              {/* Section heading (OUTSIDE card, like FAQ) */}
              <h2 id="about-heading" className="section-h2">
                About Compressly
              </h2>

              {/* Content card */}
              <div className="container-card p-4 soft-shadow mt-2">
                <div className="small-muted text-sm leading-relaxed">
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
              </div>
            </section>

        </main>
        
        </div> {/* end app-wrap */}

        <footer>
          <div className="footer-inner">
            <div className="brand-text">
              © 2026 Compressly
            </div>

            <div className="footer-links">
              <a className="touch-link" href="/privacy.html">Privacy Policy</a>
              <a className="touch-link" href="/terms.html">Terms</a>
              <a className="touch-link" href="/contact.html">Contact</a>
              <a className="touch-link" href="/compress-image-to-100kb.html">Compress to 100 KB</a>
              <a className="touch-link" href="/compress-jpg-online.html">Compress JPG</a>

            </div>

          </div>

          <SpeedInsights sampleRate={0.2} />
        </footer>

      </div> {/* end page-shell */}

      {/* 🔍 IMAGE PREVIEW MODAL */}
      {modalImage &&
        createPortal(
          <div
            onClick={() => setModalImage(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.7)",
              zIndex: 9999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <div
              onClick={() => setModalImage(null)}
              style={{
                position: "relative",
                maxWidth: "95vw",
                maxHeight: "95vh",
                outline: "none"
              }}
            >

              {/* Close button */}
              <button
                onClick={(e) => {
                  e.currentTarget.blur();   // ✅ remove focus immediately
                  setModalImage(null);
                }}
                aria-label="Close preview"
                tabIndex={-1}               // ✅ button cannot receive keyboard focus
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "rgba(0,0,0,0.65)",
                  border: "none",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  outline: "none"           // ✅ kill focus ring
                }}
              >

                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden
                >
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>

              </button>

              <img
                src={modalImage}
                alt="Preview"
                style={{
                  maxWidth: "100%",
                  maxHeight: "90vh",
                  borderRadius: 12,
                  display: "block"
                }}
              />


            </div>
          </div>,
          document.getElementById("modal-root")
        )}



    </div>
  );
}
