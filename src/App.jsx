import React, { useRef, useState, useEffect } from "react";
import { SpeedInsights } from "@vercel/speed-insights/react";

/* Vite-safe asset URLs */
const IconImg = new URL("./assets/icon.png", import.meta.url).href;
const UploadImg = new URL("./assets/upload.png", import.meta.url).href;

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
  return (bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0) + " " + ["B", "KB", "MB", "GB"][i];
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
    <svg className={`animate-spin ${className}`} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.12" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/* Download icon */
function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="inline-block align-middle -mt-[2px]">
      <path d="M12 3v12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 11l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 21H3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* Utility: createImageBitmap wrapper with fallback to Image */
async function decodeImage(blob) {
  if (typeof createImageBitmap === "function") {
    try {
      const imgBitmap = await createImageBitmap(blob);
      return { bitmap: imgBitmap, width: imgBitmap.width, height: imgBitmap.height, isBitmap: true };
    } catch (err) {
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
        if (!called) { called = true; resolve(blob); }
      }, mime, quality);
    } catch (err) {
      resolve(null);
    }
    setTimeout(() => { if (!called) resolve(null); }, 2500);
  });

  if (b && b.size > 0) return b;

  try {
    const dataUrl = canvas.toDataURL(mime, quality);
    const parts = dataUrl.split(",");
    const meta = parts[0];
    const raw = parts[1];
    const binary = atob(raw);
    const len = binary.length;
    const u8 = new Uint8Array(len);
    for (let i = 0; i < len; i++) u8[i] = binary.charCodeAt(i);
    const m = (meta.match(/:(.*?);/) || [])[1] || mime || "image/png";
    return new Blob([u8], { type: m });
  } catch (err) {
    return null;
  }
}

/* draw helper */
function drawImageScaled(ctx, source, sx, sy, sWidth, sHeight, dWidth, dHeight) {
  if (source instanceof ImageBitmap || source instanceof HTMLImageElement) {
    ctx.drawImage(source, 0, 0, source.width || sWidth, source.height || sHeight, 0, 0, dWidth, dHeight);
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
    drawImageScaled(ctx, sourceObj.bitmap, 0, 0, sourceObj.width, sourceObj.height, targetW, targetH);
    return canvas;
  }

  let sw = sourceObj.width, sh = sourceObj.height;
  let tmpCanvas = document.createElement("canvas");
  let tmpCtx = tmpCanvas.getContext("2d");
  tmpCanvas.width = sw;
  tmpCanvas.height = sh;

  if (sourceObj.isBitmap && sourceObj.bitmap) tmpCtx.drawImage(sourceObj.bitmap, 0, 0);
  else tmpCtx.drawImage(sourceObj.img, 0, 0, sw, sh);

  while (sw / 2 > targetW) {
    const nw = Math.round(sw / 2);
    const nh = Math.round(sh / 2);
    const nc = document.createElement("canvas");
    nc.width = nw; nc.height = nh;
    const nctx = nc.getContext("2d");
    nctx.drawImage(tmpCanvas, 0, 0, sw, sh, 0, 0, nw, nh);
    tmpCanvas = nc;
    sw = nw; sh = nh;
    await new Promise(r => setTimeout(r, 0));
  }

  ctx.drawImage(tmpCanvas, 0, 0, sw, sh, 0, 0, targetW, targetH);
  return canvas;
}

/* Main fast compressor with aggressive options */
async function compressFileOptimized(fileBlob, opts = {}) {
  const { mime = "image/jpeg", quality = 0.82, targetBytes = 0, maxWidth = 0, progress = () => { } } = opts;

  const src = await decodeImage(fileBlob);
  let srcW = src.width, srcH = src.height;

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
  let lowQ = 0.02, highQ = Math.min(0.98, quality || 0.98);
  let bestBlob = null;
  let bestSize = Infinity;

  for (let i = 0; i < Q_ITER; i++) {
    const q = (lowQ + highQ) / 2;
    progress(15 + Math.round((i / Q_ITER) * 20), `Trying quality ${Math.round(q * 100)}%`);
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
    if (bestBlob && Math.abs(bestSize - targetBytes) / targetBytes < 0.06) break;
    await new Promise(r => setTimeout(r, 0));
  }

  if (bestBlob && bestSize <= (targetBytes * 1.03)) {
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
      const q = 0.12 + (0.86 * (1 - qIter / 5));
      progress(
        50 + Math.round((attempt / MAX_DOWNS) * 30) + Math.round((qIter / 5) * 10),
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
      await new Promise(r => setTimeout(r, 0));
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
  const finalCanvas = await renderScaled(src, finalW, Math.round(finalW * aspect));
  const finalBlob = await canvasToBlobWithFallback(finalCanvas, mime, 0.12);
  return finalBlob;
}

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
  const [format, setFormat] = useState("jpeg"); // default jpeg
  const [lastNote, setLastNote] = useState("");
  const [progressPct, setProgressPct] = useState(0);

  useEffect(() => {
    return () => {
      if (previewURL) URL.revokeObjectURL(previewURL);
      if (outURL) URL.revokeObjectURL(outURL);
    };
  }, [previewURL, outURL]);

  function resetAll() {
    setFile(null); setPreviewURL(""); setOriginalSize(0);
    if (outURL) URL.revokeObjectURL(outURL);
    setOutURL(""); setOutSize(0); setOutMime(""); setOutFilename("");
    setTargetKB(""); setLastNote(""); setProgressPct(0);
  }

  function handleFiles(files) {
    if (!files || files.length === 0) return;
    const f = files[0];
    setFile(f);
    setOriginalSize(f.size);
    if (previewURL) URL.revokeObjectURL(previewURL);
    setPreviewURL(URL.createObjectURL(f));
    if (outURL) URL.revokeObjectURL(outURL);
    setOutURL(""); setOutSize(0); setOutMime(""); setOutFilename(""); setLastNote("");
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

  async function runCompress() {
    if (!file) return;
    setProcessing(true);
    setOutURL(""); setOutSize(0); setOutMime(""); setOutFilename(""); setLastNote(""); setProgressPct(4);

    try {
      let mime;
      if (format === "auto") mime = isWebPSupported() ? "image/webp" : "image/jpeg";
      else if (format === "webp") mime = "image/webp";
      else if (format === "jpeg") mime = "image/jpeg";
      else if (format === "png") mime = "image/png";
      else mime = file.type || "image/jpeg";

      if (mime === "image/webp" && !isWebPSupported()) mime = "image/jpeg";

      const targetBytes = targetKB && Number(targetKB) > 0 ? Math.max(8 * 1024, Math.round(Number(targetKB) * 1024)) : 0;

      const progressCb = (pct, note) => {
        setProgressPct(Math.min(98, pct));
        setLastNote(note || "");
      };

      // more aggressive mobile-friendly max width
      const maxWidth = 1200;

      const blob = await compressFileOptimized(file, { mime, quality, targetBytes, maxWidth, progress: progressCb });
      if (!blob) {
        setLastNote("Compression failed — try smaller image or lower quality.");
        setProgressPct(0);
        setProcessing(false);
        return;
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

  const reductionPercent = originalSize && outSize ? Math.round(((originalSize - outSize) / originalSize) * 100) : 0;

  const displayName = outFilename || (file ? file.name : "No file selected");
  const displaySize = outSize || originalSize;

  const downloadHref = outURL || previewURL || "";
  const downloadName =
    outFilename ||
    (file ? `${file.name.replace(/\.[^/.]+$/, "")}.${mimeToExt(file.type || "image/jpeg")}` : `compressly.${mimeToExt(outMime || "image/jpeg")}`);

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg,#ffffff,#fbfdff)" }}>
      <div className="app-wrap">
        {/* header (responsive) */}
        <header className="flex items-center justify-between mb-3 header-wrap">
          <div className="header-left flex items-center gap-2">
            <img src={IconImg} alt="Compressly" className="w-6 h-6 object-contain" />
            <div style={{ minWidth: 0 }} className="hidden sm:block">
              <div className="text-xl font-semibold leading-tight truncate">Compressly</div>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-3 text-sm">
            <a className="text-slate-600 hover:text-slate-900" href="#">Home</a>
            <a className="text-slate-600 hover:text-slate-900" href="#" onClick={e => { e.preventDefault(); alert("Help"); }}>Help</a>
          </nav>
        </header>

        <main className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* left: uploader */}
          <section className="md:col-span-8 container-card p-3 soft-shadow frost">
            <div
              onDrop={(e) => { e.preventDefault(); if (e.dataTransfer?.files) handleFiles(e.dataTransfer.files); }}
              onDragOver={(e) => e.preventDefault()}
              className="uploader rounded-lg p-4 flex flex-col md:flex-row gap-4 items-start"
            >
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-medium truncate">Drop an image or click to upload</h2>
                <p className="small-muted mt-1">Processed locally — no uploads.</p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button onClick={() => inputRef.current?.click()} className="compress-btn choose-compact flex items-center gap-2 text-sm">
                    <img src={UploadImg} alt="upload" className="w-3.5 h-3.5 opacity-90" />
                    <span className="truncate">Choose Image</span>
                  </button>

                  <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFiles(e.target.files)} />

                  <button onClick={resetAll} disabled={!file} className="reset-btn btn px-3 py-1 text-sm disabled:opacity-60">Reset</button>
                </div>

                <div className="mt-0 text-xs small-muted"></div>
              </div>

              <div className="flex items-center gap-3" style={{ minWidth: 0 }}>
                <div className="preview-wrap">
                  {previewURL ? <img src={previewURL} alt="preview" className="object-contain w-full h-full" /> : <div className="text-slate-300 text-sm">No preview</div>}
                </div>

                <div className="text-xs small-muted" style={{ minWidth: 0 }}>
                  <div className="font-medium truncate" style={{ maxWidth: 160 }}>{file ? file.name : "No file selected"}</div>
                  <div className="mt-1">{file ? humanFileSize(originalSize) : ""}</div>
                </div>
              </div>
            </div>

            {/* controls */}
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div>
                <label className="control-label" htmlFor="output-format">Output</label>
                <div className="mt-1">
                  <div className="fancy-select">
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
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="control-label">Quality</label>
                <div className="mt-1 flex items-center gap-2">
                  <input type="range" min="0.05" max="0.98" step="0.01" value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-full" />
                  <div className="w-8 text-right text-xs small-muted">{Math.round(quality * 100)}%</div>
                </div>
              </div>

              <div>
                <label className="control-label">Target (KB)</label>
                <div className="mt-1 flex gap-2">
                  <input value={targetKB} onChange={(e) => setTargetKB(e.target.value.replace(/[^\d]/g, ""))} placeholder="Enter size in KB/MB" className="px-2 py-1 border rounded-md w-full text-sm" />
                  <button onClick={runCompress} disabled={!file || processing} className="compress-btn disabled:opacity-60 text-sm flex items-center gap-2">
                    {processing ? <Spinner /> : null}
                    <span>{processing ? "Processing" : "Compress"}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-3">
              <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.min(100, progressPct)}%` }} /></div>
              <div className="mt-2 text-xs small-muted flex justify-between">
                <div>Tip: Use WebP + Target for smallest files.</div>
                <div style={{ minWidth: 140, textAlign: "right" }}>{lastNote}</div>
              </div>
            </div>
          </section>

          {/* right: result */}
          <aside className="md:col-span-4">
            <div className="container-card rounded-lg p-3 soft-shadow">
              <div className="flex items-start gap-3">
                <div className="result-thumb" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {outURL ? (
                    <img
                      src={outURL}
                      alt="result preview"
                      className="w-full h-full object-contain rounded-md"
                    />
                  ) : (
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" className="text-slate-400">
                      <rect x="3" y="4" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.3" />
                      <path d="M7 13l3-3 4 5 3-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="9" cy="9" r="1.4" fill="currentColor" />
                    </svg>
                  )}
                </div>


                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium truncate" style={{ maxWidth: 160 }}>{displayName}</div>
                      <div className="text-xs small-muted mt-1">{displaySize ? humanFileSize(displaySize) : ""}</div>
                    </div>

                    <div className="text-right">
                      <div className="text-base font-semibold">{outSize ? humanFileSizeShort(outSize) : "—"}</div>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2 items-center">
                    <div className="chip text-xs">Reduction: <span style={{ color: "#0f1724" }} className="font-medium ml-1">{reductionPercent}%</span></div>
                    <div className="chip text-xs">Format: <span style={{ color: "#0f1724" }} className="font-medium ml-1">{outMime ? mimeToExt(outMime) : format}</span></div>
                  </div>

                  <div className="mt-3 result-actions">
                    <a
                      href={downloadHref}
                      download={downloadName}
                      className={`px-3 py-1.5 rounded-md ${outURL ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"} btn text-sm flex items-center gap-2`}
                      aria-disabled={!downloadHref}
                    >
                      <DownloadIcon /> <span>{outURL || previewURL ? `Download (${outSize ? humanFileSize(outSize) : ""})` : "Download"}</span>
                    </a>


                    <button
                      onClick={async () => { if (outURL) window.open(outURL, "_blank"); }}
                      disabled={!outURL}
                      className="px-2 py-1 border rounded-md text-sm disabled:opacity-60"
                    >
                      Open
                    </button>

                    <button
                      onClick={async () => {
                        if (!outURL) return;
                        try {
                          const b = await fetch(outURL).then(r => r.blob());
                          const reader = new FileReader();
                          reader.onload = () => { navigator.clipboard.writeText(reader.result); alert("Data URL copied"); };
                          reader.readAsDataURL(b);
                        } catch (e) { console.error(e); alert("Copy failed"); }
                      }}
                      disabled={!outURL}
                      className="px-2 py-1 border rounded-md text-sm disabled:opacity-60"
                    >
                      Copy
                    </button>
                  </div>

                  <div className="mt-3 text-xs small-muted">Tip: If target isn't reached try lowering quality or choosing WebP.</div>
                </div>
              </div>
            </div>

            <div className="container-card soft-shadow quick-help-card">
              <div className="text-sm font-medium">Quick help</div>
              <div className="text-xs small-muted">
                For forms: Many forms require ≤100KB - use Target (KB) + JPEG. For web: WebP gives smaller files and faster pages.
              </div>
            </div>
          </aside>

          {/* informational cards */}
          <section className="md:col-span-12 info-section grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="info-card">
              <div className="font-medium text-sm">Outputs</div>
              <div className="mt-2 small-muted">JPEG for compatibility, WebP for smallest size, PNG when lossless is required.</div>
            </div>

            <div className="info-card">
              <div className="font-medium text-sm">How to use</div>
              <ol className="mt-2 list-decimal ml-4 small-muted space-y-1 text-sm">
                <li>Choose image (or drag & drop).</li>
                <li>Pick format/quality or enter target KB.</li>
                <li>Press Compress → Download result.</li>
              </ol>
            </div>

            <div className="info-card">
              <div className="font-medium text-sm">Why Compressly?</div>
              <ul className="mt-2 ml-4 small-muted space-y-1 text-sm">
                <li>No uploads - processed in your browser for privacy.</li>
                <li>Fast client-side compression - instant results without servers.</li>
              </ul>
            </div>
          </section>

          {/* About section */}
          <section id="about" className="md:col-span-12 container-card p-4 soft-shadow mt-6">
            <div className="font-medium text-base">About Compressly:</div>

            <div className="mt-2 small-muted text-sm leading-relaxed">
              <strong>Compressly</strong> is a fast, private image compression tool that runs entirely in your
              browser - no uploads, no accounts, and no tracking. It reduces JPG, PNG, and WebP files
              to smaller sizes for web forms, emails, online applications, and faster page performance.

              <br /><br />

              You can set a custom quality level or enter an exact target size in KB. Compressly uses
              smart compression techniques - including quality adjustment and optional downscaling -
              to help you stay under strict file-size limits required by many portals and government forms.

              <br /><br />

              Designed to be mobile-friendly and privacy-first, Compressly gives fast results even on
              low-end devices and slow networks, making it ideal for everyday use.

              <br /><br />
            </div>
          </section>
        </main>

        <footer>
          <div className="brand-text">Made by Leosh ads · © Compressly 2025</div>

          <div className="about-link">
            <a href="#about" className="small-muted text-sm hover:underline">
              About Compressly
            </a>
          </div>
        </footer>

        <SpeedInsights />
      </div>
    </div>
  );
}
