import React, { useRef, useState, useEffect } from "react";

/* Helper: human readable file sizes */
function humanFileSize(bytes) {
  if (!bytes) return "0 B";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (
    (bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0) +
    " " +
    ["B", "KB", "MB", "GB"][i]
  );
}

/* Small spinner */
function Spinner({ className = "" }) {
  return (
    <svg className={`animate-spin ${className}`} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.12" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

/* Small inline icon components */
function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="inline-block align-middle -mt-[2px]">
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

  const [quality, setQuality] = useState(0.82);
  const [targetKB, setTargetKB] = useState("");
  const [processing, setProcessing] = useState(false);
  const [format, setFormat] = useState("jpeg"); // default to JPEG as requested
  const [lastNote, setLastNote] = useState("");
  const [progressPct, setProgressPct] = useState(0);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    return () => {
      if (previewURL) URL.revokeObjectURL(previewURL);
      if (outURL) URL.revokeObjectURL(outURL);
    };
  }, [previewURL, outURL]);

  function resetAll() {
    setFile(null);
    setPreviewURL("");
    setOriginalSize(0);
    setOutURL("");
    setOutSize(0);
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
    setOutURL("");
    setOutSize(0);
    setLastNote("");
    setProgressPct(0);
  }

  function isWebPSupported() {
    const canvas = document.createElement("canvas");
    if (!canvas.getContext) return false;
    return canvas.toDataURL("image/webp").indexOf("data:image/webp") === 0;
  }

  async function createImageElement(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(e);
      };
      img.src = url;
    });
  }

  async function canvasToBlob(canvas, mime, q) {
    return await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), mime, q);
    });
  }

  async function compressWithQualityAndSize(originalFile, opts) {
    const { quality, mime, maxWidth } = opts;
    const img = await createImageElement(originalFile);
    let width = img.width;
    let height = img.height;
    if (maxWidth && width > maxWidth) {
      const r = maxWidth / width;
      width = Math.round(width * r);
      height = Math.round(height * r);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await canvasToBlob(canvas, mime, quality);
    return blob;
  }

  /* Main compression routine (binary search on quality + downscale fallback).
     We update progressPct occasionally to give user feedback. */
  async function runCompress() {
    if (!file) return;
    setProcessing(true);
    setOutURL("");
    setOutSize(0);
    setLastNote("");
    setProgressPct(4);
    try {
      let mime;
      if (format === "auto") mime = isWebPSupported() ? "image/webp" : "image/jpeg";
      else if (format === "webp") mime = "image/webp";
      else if (format === "jpeg") mime = "image/jpeg";
      else mime = file.type || "image/jpeg";

      // If user supplied a target KB, try to reach it precisely
      if (targetKB && Number(targetKB) > 0) {
        const targetBytes = Math.max(8 * 1024, Math.round(Number(targetKB) * 1024));
        let low = 0.05,
          high = 0.98,
          bestBlob = null,
          bestSize = Infinity,
          bestQ = low;
        const Q_ITER = 12;

        for (let i = 0; i < Q_ITER; i++) {
          const mid = (low + high) / 2;
          setLastNote(`Trying quality ${Math.round(mid * 100)}% (pass ${i + 1}/${Q_ITER})`);
          setProgressPct(5 + Math.round((i / Q_ITER) * 35));
          const blob = await compressWithQualityAndSize(file, { quality: mid, mime });
          if (!blob) break;
          const s = blob.size;
          if (s <= targetBytes) {
            bestBlob = blob;
            bestSize = s;
            bestQ = mid;
            low = mid;
          } else {
            high = mid;
          }
        }

        if (bestBlob && bestSize <= targetBytes) {
          const url = URL.createObjectURL(bestBlob);
          setOutURL(url);
          setOutSize(bestSize);
          setLastNote(`Reached target at ${Math.round(bestQ * 100)}% quality`);
          setProcessing(false);
          setProgressPct(100);
          return;
        }

        // Quality-only failed; try downscaling progressively
        setLastNote("Quality couldn't reach target — trying downscale...");
        setProgressPct(45);
        const imgEl = await createImageElement(file);
        let maxWidth = imgEl.width;
        let attempts = 0;
        const MAX_ATTEMPTS = 7;
        let finalBlob = null;
        while (attempts < MAX_ATTEMPTS) {
          maxWidth = Math.round(maxWidth * (attempts === 0 ? 0.9 : 0.82));
          if (maxWidth < 200) break;
          let l = 0.05,
            h = 0.98,
            localBest = null;
          for (let j = 0; j < 9; j++) {
            const mid = (l + h) / 2;
            setLastNote(`Downscale ${attempts + 1}/${MAX_ATTEMPTS} — w:${maxWidth}px q:${Math.round(mid * 100)}%`);
            setProgressPct(45 + Math.round(((attempts * 9 + j) / (MAX_ATTEMPTS * 9)) * 40));
            const blob = await compressWithQualityAndSize(file, { quality: mid, mime, maxWidth });
            if (!blob) break;
            if (blob.size <= targetBytes) {
              localBest = blob;
              l = mid;
            } else {
              h = mid;
            }
          }
          if (localBest) {
            finalBlob = localBest;
            break;
          } else {
            const aggressive = await compressWithQualityAndSize(file, { quality: 0.12, mime, maxWidth });
            if (aggressive && aggressive.size <= targetBytes) {
              finalBlob = aggressive;
              break;
            }
          }
          attempts++;
        }

        if (finalBlob) {
          const url = URL.createObjectURL(finalBlob);
          setOutURL(url);
          setOutSize(finalBlob.size);
          setLastNote("Reached target using downscale + quality.");
          setProcessing(false);
          setProgressPct(100);
          return;
        }

        setLastNote("Couldn't meet exact target — returning best possible.");
        setProgressPct(90);
        // fallback attempts
        const lastBlob = await compressWithQualityAndSize(file, { quality: 0.12, mime, maxWidth: Math.round(imgEl.width * 0.6) }).catch(() => null);
        if (lastBlob) {
          const url = URL.createObjectURL(lastBlob);
          setOutURL(url);
          setOutSize(lastBlob.size);
        } else {
          const fallback = await compressWithQualityAndSize(file, { quality, mime }).catch(() => null);
          if (fallback) {
            const url = URL.createObjectURL(fallback);
            setOutURL(url);
            setOutSize(fallback.size);
          }
        }
        setProcessing(false);
        setProgressPct(100);
        return;
      }

      // No target KB: single-pass compress with selected quality
      setLastNote("Compressing...");
      setProgressPct(12);
      const resultBlob = await compressWithQualityAndSize(file, { quality, mime });
      if (resultBlob) {
        const url = URL.createObjectURL(resultBlob);
        setOutURL(url);
        setOutSize(resultBlob.size);
        setLastNote("");
        setProgressPct(100);
      } else {
        setLastNote("Compression failed.");
        setProgressPct(0);
      }
    } catch (err) {
      console.error(err);
      setLastNote("Error while compressing. See console.");
      setProgressPct(0);
    } finally {
      setProcessing(false);
      // small delay to let user see 100%
      setTimeout(() => setProgressPct(0), 700);
    }
  }

  const reductionPercent = originalSize && outSize ? Math.round(((originalSize - outSize) / originalSize) * 100) : 0;

  return (
    <div className="min-h-screen py-8 px-4 bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="max-w-6xl mx-auto flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {/* Logo: modern svg */}
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-r from-indigo-600 to-pink-500 text-white font-extrabold text-lg soft-shadow">
            {/* small camera + shrink icon */}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="transform -translate-y-[1px]">
              <path d="M3 7h3l1-2h8l1 2h3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="12" cy="12" r="3.2" stroke="white" strokeWidth="1.2"/>
              <path d="M17 3v2" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div className="text-lg font-semibold">PicShrink</div>
            <div className="text-xs text-slate-500">Fast • Private • Mobile-first</div>
          </div>
        </div>

        <nav className="flex items-center gap-4 text-sm">
          <a className="text-slate-600 hover:text-slate-900" href="#">Home</a>
          <a className="text-slate-600 hover:text-slate-900" href="#" onClick={(e)=>{e.preventDefault(); setShowHelp(s=>!s);}}>Help</a>
          <a className="text-slate-600 hover:text-slate-900" href="#" onClick={(e)=>{e.preventDefault(); alert('Deploy to Vercel later.')}}>Deploy</a>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left / Center column */}
        <section className="md:col-span-8 bg-white container-card frosted soft-shadow rounded-2xl p-5">
          {/* Upload area */}
          <div
            onDrop={(e) => { e.preventDefault(); if (e.dataTransfer?.files) handleFiles(e.dataTransfer.files); }}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-slate-100 rounded-xl p-6 flex flex-col md:flex-row gap-4 items-center"
          >
            <div className="flex-1">
              <h2 className="text-lg font-medium">Drop image here</h2>
              <p className="text-xs text-slate-400 mt-1">or click Choose Image — supports JPG, PNG, HEIC (browser dependent). Files processed locally.</p>

              <div className="mt-4 flex items-center gap-3">
                <button onClick={() => inputRef.current?.click()} className="btn px-4 py-2 bg-gradient-to-r from-indigo-600 to-pink-500 text-white rounded-lg shadow hover:scale-[1.02]">
                  Choose Image
                </button>

                <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFiles(e.target.files)} />

                <button onClick={resetAll} disabled={!file} className="px-3 py-2 border rounded-lg text-sm disabled:opacity-60">Reset</button>

                {/* show small badges */}
                <div className="ml-2 flex gap-2">
                  <div className="chip">Private</div>
                  <div className="chip">Client-side</div>
                </div>
              </div>
            </div>

            <div className="w-full md:w-56 text-center">
              <div className="w-full h-40 bg-slate-50 rounded-lg flex items-center justify-center overflow-hidden border border-slate-100">
                {previewURL ? <img src={previewURL} alt="preview" className="object-contain w-full h-full" /> : (
                  <div className="text-slate-300 text-sm">No preview</div>
                )}
              </div>
              <div className="mt-2 text-xs text-slate-500">{file ? file.name : "No file chosen"}</div>
              <div className="mt-1 text-xs text-slate-400">{file ? humanFileSize(originalSize) : ""}</div>
            </div>
          </div>

          {/* Controls */}
          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div>
              <label className="text-xs text-slate-600">Output format</label>
              <select value={format} onChange={(e) => setFormat(e.target.value)} className="mt-1 w-full px-3 py-2 border rounded-md">
                <option value="jpeg">JPEG (recommended)</option>
                <option value="webp">WebP (smaller)</option>
                <option value="png">PNG (lossless)</option>
                <option value="auto">Auto (WebP if supported)</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-600">Quality</label>
              <div className="mt-1 flex items-center gap-3">
                <input type="range" min="0.05" max="0.98" step="0.01" value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-full" />
                <div className="w-10 text-right text-xs text-slate-500">{Math.round(quality * 100)}%</div>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-600">Target (KB) — optional</label>
              <div className="mt-1 flex gap-2">
                <input value={targetKB} onChange={(e) => setTargetKB(e.target.value.replace(/[^\d]/g, ""))} placeholder="e.g., 100" className="px-3 py-2 border rounded-md w-full" />
                <button onClick={runCompress} disabled={!file || processing} className="px-4 py-2 bg-green-600 text-white rounded-md btn disabled:opacity-60 flex items-center gap-2">
                  {processing ? <Spinner/> : null}
                  <span>{processing ? "Processing" : "Compress"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Tips / status / progress */}
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-500">Tip: For smallest sizes choose WebP or reduce dimensions. Everything is local — no uploads.</div>
              <div className="text-xs text-slate-400">{lastNote}</div>
            </div>

            {/* progress bar */}
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div className="h-2 bg-indigo-500 transition-all" style={{ width: `${Math.min(100, progressPct)}%` }} />
            </div>
          </div>

          {/* How to use & small features */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs">
              <div className="font-medium text-sm">How to use</div>
              <ol className="mt-2 list-decimal ml-5 text-xs space-y-1 text-slate-600">
                <li>Choose image (or drag & drop)</li>
                <li>Set format/quality or enter target KB</li>
                <li>Press Compress → Download the result</li>
              </ol>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs">
              <div className="font-medium text-sm">Why PicShrink?</div>
              <ul className="mt-2 ml-5 text-xs space-y-1 text-slate-600">
                <li>No uploads — privacy first</li>
                <li>Client-side compression — fast</li>
                <li>Mobile-first UI — works on phones</li>
              </ul>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs">
              <div className="font-medium text-sm">Outputs</div>
              <div className="mt-2 text-xs text-slate-600">
                Choose <strong>JPEG</strong> for compatibility, <strong>WebP</strong> for smallest size, <strong>PNG</strong> when lossless needed.
              </div>
            </div>
          </div>
        </section>

        {/* Right column: result card */}
        <aside className="md:col-span-4">
          <div className="bg-white container-card rounded-2xl p-5 soft-shadow frost">
            <div className="flex items-start gap-4">
              <div className="w-28 h-28 bg-white rounded-lg overflow-hidden border border-slate-100 flex items-center justify-center">
                {outURL ? <img src={outURL} alt="result" className="object-contain w-full h-full" /> : (previewURL ? <img src={previewURL} alt="preview" className="object-contain w-full h-full" /> : <div className="text-slate-300">No preview</div>)}
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{file ? file.name : "No file selected"}</div>
                    <div className="text-xs text-slate-500 mt-1">{file ? humanFileSize(originalSize) : ""}</div>
                  </div>

                  <div className="text-right">
                    <div className="text-lg font-semibold">{outSize ? humanFileSize(outSize) : "—"}</div>
                    <div className="text-xs text-slate-400">Result</div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 items-center">
                  <div className="chip">Reduction: <span className="font-medium ml-1">{reductionPercent}%</span></div>
                  <div className="chip">Format: <span className="font-medium ml-1">{format}</span></div>
                  <div className="chip">Preview: <span className="font-medium ml-1">{outURL ? "Yes" : "No"}</span></div>
                </div>

                <div className="mt-5 flex gap-2">
                  <a href={outURL || previewURL} download={`picshrink-${file ? file.name : "image"}`} className={`px-4 py-2 rounded-lg ${outURL ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"} btn flex items-center gap-2`} aria-disabled={!outURL && !previewURL}>
                    <DownloadIcon /> <span>{outURL ? `Download (${outSize ? humanFileSize(outSize) : ""})` : "Download"}</span>
                  </a>

                  <button onClick={async () => { if (outURL) window.open(outURL, "_blank"); }} disabled={!outURL} className="px-3 py-2 border rounded-lg disabled:opacity-60">Open</button>

                  <button onClick={async () => {
                    if (!outURL) return;
                    try {
                      const b = await fetch(outURL).then(r => r.blob());
                      const reader = new FileReader();
                      reader.onload = () => { navigator.clipboard.writeText(reader.result); alert("Data URL copied"); };
                      reader.readAsDataURL(b);
                    } catch (e) { console.error(e); alert("Copy failed"); }
                  }} disabled={!outURL} className="px-3 py-2 border rounded-lg disabled:opacity-60">Copy data URL</button>
                </div>

                <div className="mt-4 text-xs text-slate-400">Tip: If your target size isn't reached, try lowering quality or choosing WebP.</div>
              </div>
            </div>
          </div>

          {/* small SEO/help box */}
          <div className="mt-4 bg-white container-card rounded-2xl p-4 soft-shadow">
            <div className="text-sm font-medium">Quick help</div>
            <div className="text-xs text-slate-600 mt-2">
              <strong>For forms:</strong> Many Indian forms require ≤100KB or specific dimensions — use Target (KB) + JPEG. <br/>
              <strong>For web:</strong> WebP gives smaller files and faster sites.
            </div>
          </div>

          {/* optional help/FAQ expanded */}
          {showHelp && (
            <div className="mt-4 bg-white container-card rounded-2xl p-4 soft-shadow">
              <div className="text-sm font-medium">Help & FAQs</div>
              <div className="mt-2 text-xs text-slate-600 space-y-2">
                <div><strong>Q:</strong> Are images uploaded? <br/><strong>A:</strong> No — everything is processed in your browser.</div>
                <div><strong>Q:</strong> Why WebP? <br/><strong>A:</strong> WebP often gives the smallest output but some services do not accept it — use JPEG for maximum compatibility.</div>
              </div>
            </div>
          )}
        </aside>
      </main>

      <footer className="max-w-6xl mx-auto mt-8 text-center text-xs text-slate-400">
        <div>Made with ❤️ by Image Processor — processed locally. Map to your subdomain when ready.</div>
      </footer>
    </div>
  );
}

/* Note: reductionPercent is referenced inside JSX — compute before return. */
const reductionPercent = (function(){ /* placeholder to satisfy linter in editors that don't detect pre-declaration */ return 0; })();
