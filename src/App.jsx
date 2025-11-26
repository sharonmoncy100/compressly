import React, { useRef, useState, useEffect } from "react";

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
      <path d="M12 3v12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8 11l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M21 21H3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
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

  async function createImageElement(blob) {
    return new Promise((resolve, reject) => {
      try {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = (e) => {
          URL.revokeObjectURL(url);
          console.error("createImageElement: image load error", e);
          reject(new Error("Image failed to load — file may be corrupted or unsupported."));
        };
        img.src = url;
      } catch (err) {
        console.error("createImageElement: unexpected", err);
        reject(err);
      }
    });
  }

  async function canvasToBlob(canvas, mime, q) {
    return await new Promise((resolve) => {
      let finished = false;
      try {
        canvas.toBlob((b) => {
          finished = true;
          if (!b) {
            console.warn("canvasToBlob: toBlob returned null");
            resolve(null);
          } else {
            resolve(b);
          }
        }, mime, q);
      } catch (err) {
        console.error("canvasToBlob: exception", err);
        resolve(null);
      }
      setTimeout(() => { if (!finished) { console.warn("canvasToBlob: timeout"); resolve(null); } }, 3000);
    });
  }

  function dataURLToBlob(dataURL) {
    const parts = dataURL.split(',');
    const meta = parts[0];
    const b64 = parts[1] || "";
    const binary = atob(b64);
    const len = binary.length;
    const u8 = new Uint8Array(len);
    for (let i = 0; i < len; i++) u8[i] = binary.charCodeAt(i);
    const m = (meta.match(/:(.*?);/) || [])[1] || 'image/png';
    return new Blob([u8], { type: m });
  }

  async function compressWithQualityAndSize(originalFile, opts) {
    const { quality, mime, maxWidth } = opts;
    const img = await createImageElement(originalFile);

    let width = img.width, height = img.height;

    // Prevent huge canvases that crash browsers
    const MAX_DIM = 8192; // reduce if needed for low-memory devices
    if (width > MAX_DIM || height > MAX_DIM) {
      const scale = MAX_DIM / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      console.warn(`compressWithQualityAndSize: downscaled big image to ${width}x${height}`);
    }

    if (maxWidth && width > maxWidth) {
      const r = maxWidth / width;
      width = Math.round(width * r);
      height = Math.round(height * r);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, width, height);

    // try toBlob
    let blob = await canvasToBlob(canvas, mime, quality);
    if (blob) return blob;

    // fallback to toDataURL
    try {
      const dataURL = canvas.toDataURL(mime, quality);
      blob = dataURLToBlob(dataURL);
      if (blob && blob.size > 0) return blob;
    } catch (err) {
      console.error("compressWithQualityAndSize: toDataURL fallback failed", err);
    }

    // last resort: null -> caller must handle
    return null;
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

      if (targetKB && Number(targetKB) > 0) {
        const targetBytes = Math.max(8 * 1024, Math.round(Number(targetKB) * 1024));
        let low = 0.05, high = 0.98, bestBlob = null, bestSize = Infinity, bestQ = low;
        const Q_ITER = 10;

        for (let i = 0; i < Q_ITER; i++) {
          const mid = (low + high) / 2;
          setLastNote(`Trying quality ${Math.round(mid * 100)}%`);
          setProgressPct(6 + Math.round((i / Q_ITER) * 35));
          const blob = await compressWithQualityAndSize(file, { quality: mid, mime });
          if (!blob) {
            console.warn("runCompress: blob null during quality search");
            break;
          }
          const s = blob.size;
          if (s <= targetBytes) { bestBlob = blob; bestSize = s; bestQ = mid; low = mid; }
          else { high = mid; }
        }

        if (bestBlob && bestSize <= targetBytes) {
          handleResultBlob(bestBlob, mime);
          setLastNote(`Hit target at ${Math.round(bestQ * 100)}%`);
          setProcessing(false); setProgressPct(100); return;
        }

        setLastNote("Quality couldn't reach target — downscaling...");
        setProgressPct(45);
        const imgEl = await createImageElement(file);
        let maxWidth = imgEl.width; let attempts = 0; const MAX_ATT = 6; let finalBlob = null;

        while (attempts < MAX_ATT) {
          maxWidth = Math.round(maxWidth * (attempts === 0 ? 0.9 : 0.82));
          if (maxWidth < 200) break;
          let l = 0.05, h = 0.98, localBest = null;
          for (let j = 0; j < 8; j++) {
            const mid = (l + h) / 2;
            setLastNote(`Downscale ${attempts + 1}/${MAX_ATT} — w:${maxWidth}px`);
            setProgressPct(45 + Math.round(((attempts * 8 + j) / (MAX_ATT * 8)) * 40));
            const blob = await compressWithQualityAndSize(file, { quality: mid, mime, maxWidth });
            if (!blob) break;
            if (blob.size <= targetBytes) { localBest = blob; l = mid; }
            else { h = mid; }
          }
          if (localBest) { finalBlob = localBest; break; }
          const aggressive = await compressWithQualityAndSize(file, { quality: 0.12, mime, maxWidth });
          if (aggressive && aggressive.size <= targetBytes) { finalBlob = aggressive; break; }
          attempts++;
        }

        if (finalBlob) {
          handleResultBlob(finalBlob, mime);
          setLastNote("Reached target with downscale+quality.");
          setProcessing(false); setProgressPct(100); return;
        }

        setLastNote("Couldn't meet exact target — returning best possible.");
        setProgressPct(90);
        const lastBlob = await compressWithQualityAndSize(file, { quality: 0.12, mime, maxWidth: Math.round((imgEl?.width || 1000) * 0.6) }).catch(() => null);
        if (lastBlob) { handleResultBlob(lastBlob, mime); }
        else {
          const fallback = await compressWithQualityAndSize(file, { quality, mime }).catch(() => null);
          if (fallback) { handleResultBlob(fallback, mime); }
        }
        setProcessing(false); setProgressPct(100); return;
      }

      // no targetKB — just compress once
      setLastNote("Compressing...");
      setProgressPct(12);
      const resultBlob = await compressWithQualityAndSize(file, { quality, mime });
      if (resultBlob) { handleResultBlob(resultBlob, mime); setLastNote(""); setProgressPct(100); }
      else { setLastNote("Compression failed — try lower quality or smaller image."); setProgressPct(0); }
    } catch (err) {
      console.error("runCompress: unexpected", err);
      const msg = err?.message || String(err);
      setLastNote(`Error while compressing: ${msg}. Try a different image.`);
      setProgressPct(0);
    } finally {
      setProcessing(false);
      setTimeout(() => setProgressPct(0), 600);
    }
  }

  const reductionPercent = originalSize && outSize ? Math.round(((originalSize - outSize) / originalSize) * 100) : 0;

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
            <img src={`${IconImg}`} alt="Compressly" className="w-6 h-6 object-contain" />
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
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
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
                {/* Small neutral box (keeps layout tidy) instead of a large image */}
                <div className="result-thumb" aria-hidden style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {/* show a tiny icon instead of big image to keep the panel compact */}
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-slate-400">
                    <rect x="3" y="3" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.2" />
                    <circle cx="8.5" cy="9.5" r="1.6" fill="currentColor" />
                    <path d="M3 17l4-4 3 3 5-6 4 4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium truncate" style={{ maxWidth: 160 }}>{file ? file.name : "No file selected"}</div>
                      <div className="text-xs small-muted mt-1">{file ? humanFileSize(originalSize) : ""}</div>
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
                    {outURL ? (
                      <img
                        src={outURL}
                        alt="thumb"
                        className="result-thumb-inline"
                        aria-hidden
                      />
                    ) : null}

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

            <div className="mt-3 container-card p-3 soft-shadow text-xs">
              <div className="text-sm font-medium">Quick help</div>
              <div className="text-xs small-muted mt-2">For forms: Many forms require ≤100KB — use Target (KB) + JPEG. For web: WebP gives smaller files and faster pages.</div>
            </div>
          </aside>

          {/* informational cards - moved down and white */}
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
                <li>No uploads — processed in your browser for privacy.</li>
                <li>Fast client-side compression — instant results without servers.</li>
              </ul>
            </div>
          </section>

          {/* About section target (footer link points here) */}
          <section id="about" className="md:col-span-12 container-card p-4 soft-shadow mt-6">
            <div className="font-medium text-sm">About Compressly</div>
            <div className="mt-2 small-muted text-sm">
              Compressly compresses images directly in your browser — no uploads, no tracking.
              Use it to reduce JPG/PNG/WebP sizes for web forms and faster pages. Built by Leosh ads.
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
      </div>
    </div>
  );
}
