import React, { useEffect, useState } from "react";



/* tiny local Spinner to avoid importing from App */
function Spinner({ className = "", color }) {
    return (
        <svg
            className={className}
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
            style={{
                animation: "spin 0.8s linear infinite",
                color: color || "currentColor"   // 👈 THIS IS THE FIX
            }}
        >
            <style>
                {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
            </style>

            <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
                strokeOpacity="0.15"
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



export default function Uploader({
    inputRef,
    handleFiles, // function to call with FileList
    previewURL,
    outURL,
    file,
    originalSize,
    displayName,
    displaySize,
    humanFileSize, // pass helper from App
    quality,
    setQuality,
    targetKB,
    setTargetKB,
    runCompress,
    processing,
    resetAll,
    progressPct,
    lastNote,
    format,
    setFormat,
    openPreview = () => {},  // Default handler if not provided
    hasAnimatedScrollCue,
    shouldAnimateScrollCue,
    setShouldAnimateScrollCue
    
    
}) {
    const [animateCue, setAnimateCue] = useState(false);
    useEffect(() => {
        if (shouldAnimateScrollCue) {
            setAnimateCue(true);

            const t = setTimeout(() => {
                setAnimateCue(false);
                setShouldAnimateScrollCue(false); // 🔒 reset trigger
            }, 1300);

            return () => clearTimeout(t);
        }
    }, [shouldAnimateScrollCue, setShouldAnimateScrollCue]);

    const [dragActive, setDragActive] = useState(false);

    return (
        <section className="md:col-span-8 container-card p-3 uploader-shell">
            
            <div
                onDragEnter={() => setDragActive(true)}
                onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget)) {
                        setDragActive(false);
                    }
                }}

                onDrop={(e) => {
                    e.preventDefault();
                    setDragActive(false);
                    if (e.dataTransfer?.files) handleFiles(e.dataTransfer.files);
                }}
                onDragOver={(e) => e.preventDefault()}
                className={`uploader rounded-lg flex flex-col gap-4 items-start ${dragActive ? "drag-active" : ""
                    }`}
            >

                <div className="flex-1 w-full text-center">
                    <h3 className="text-base font-medium">
                        Drop images here to start compressing
                    </h3>
            

                    <div className="mt-3 flex flex-col items-center gap-2">
                        <button
                            onClick={() => inputRef.current?.click()}
                            className="primary-upload-btn select-image-btn"
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

                        <div className="small-muted text-xs trust-note">
                               Drag &amp; drop or click Select Image to upload</div>
                    </div>
                </div>

                {/* preview + meta stacked below for consistent padding */}
                {previewURL && (
                    <>
                        {/* preview + meta stacked below for consistent padding */}
                        <div className="w-full flex justify-center mt-4">
                            <div className="flex items-center gap-4">

                                {/* clickable preview */}
                                <div className="relative inline-block">

                                    {/* ❌ Remove image button */}
                                    <button
                                        type="button"
                                        aria-label="Remove image"
                                        title="Remove image"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            resetAll();
                                        }}
                                        style={{
                                            position: "absolute",
                                            top: "-10px",
                                            right: "-10px",
                                            width: "28px",
                                            height: "28px",
                                            borderRadius: "50%",
                                            background: "#ffffff",
                                            border: "1px solid #e5e7eb",
                                            boxShadow: "0 3px 8px rgba(0,0,0,0.1)",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            cursor: "pointer",
                                            zIndex: 5
                                        }}
                                    >
                                        <svg
                                            width="14"
                                            height="14"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            aria-hidden
                                        >
                                            <path
                                                d="M6 6l12 12M18 6L6 18"
                                                stroke="currentColor"
                                                strokeWidth="1.6"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        </svg>
                                    </button>


                                    {/* Image preview frame */}
                                    <div
                                        className="image-preview-frame upload-preview-frame cursor-pointer"
                                        onClick={() => openPreview(previewURL)}
                                        role="button"
                                        tabIndex={0}
                                    >
                                        <img
                                            src={previewURL}
                                            alt="Original image preview"
                                            className="object-contain max-w-[88%] max-h-[88%] cursor-zoom-in"
                                        />
                                    </div>

                                </div>

                         
                                {/* meta */}
                                <div className="text-xs small-muted flex flex-col justify-center gap-2">
                                    <div className="text-[15px] font-semibold tracking-wide text-slate-500">
                                        Original Image
                                    </div>

                                    <div className="font-medium truncate" style={{ maxWidth: 180 }}>
                                        {file?.name}
                                    </div>

                                    {originalSize ? (
                                        <div className="text-xs text-slate-500">
                                            {humanFileSize(originalSize)}
                                        </div>
                                    ) : null}
                                </div>

                            </div>
                        </div>
                    </>
                )}

             

            </div>

            {/* controls */}
            <div id="compress-controls" className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
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
                                <option value="png">PNG (Photo - lossless)</option>
                                <option value="png-optimized">PNG (Logo & Text - smaller)</option>
                                <option value="auto">Auto (WebP if supported)</option>

                            </select>
                          
                            <div className="fancy-select__arrow" aria-hidden>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                        </div>
                        {format === "png-optimized" && (
                            <div className="mt-1 text-xs small-muted">
                                Note: PNG files are already compressed. For logos and text,
                                size reductions of 20-40% are normal. For photos, use JPEG or WebP
                                for better compression.

                            </div>
                        )}
                    </div>
                </div>

                <div>
                    <label htmlFor="quality-slider" className="control-label">
                        Quality
                    </label>
                    <div
                        className={`mt-1 flex items-center gap-2 control-max range-wrap ${targetKB ? "opacity-50 pointer-events-none" : ""
                            }`}
                    >


                        <input
                            id="quality-slider"    
                            type="range"
                            min="0.05"
                            max="0.98"
                            step="0.01"
                            value={quality}
                            onChange={(e) => setQuality(Number(e.target.value))}
                            className="w-full"
                            aria-describedby="quality-value"
                        />
                        <div id="quality-value" className="w-8 text-right text-xs small-muted">
                            {Math.round(quality * 100)}%
                        </div>
                    </div>
                </div>

                <div className="target-block">
                    <label className="control-label">Target</label>

                    <div className="mt-1">
                        <div className="target-row control-max">
                            {/* Target input with KB suffix */}
                            <div className="target-input-wrap">
                                <input
                                    value={targetKB}
                                    onChange={(e) => setTargetKB(e.target.value.replace(/[^\d]/g, ""))}
                                    inputMode="numeric"
                                    placeholder="e.g. 100"
                                    className="target-input-field"
                                />
                                <span className="target-input-suffix">KB</span>
                            </div>

                            <button
                                onClick={runCompress}
                                disabled={!file || processing}
                                className="primary-upload-btn compress-btn-main disabled:opacity-60 text-sm"
                            >
                                Compress
                            </button>
                        </div>
                    </div>
                </div>

            </div>

            {/* Progress area (reserved space, no layout jump) */}
            <div className="mt-3 control-max range-wrap controls-pad">
                {processing ? (
                    <>
                        <div className="flex items-center gap-3">
                            <div className="progress-track flex-1">
                                <div
                                    className="progress-fill"
                                    style={{ width: `${Math.min(100, progressPct)}%` }}
                                />
                            </div>
                            <Spinner className="w-3.5 h-3.5 text-slate-400 opacity-60" />
                        </div>

                        <div className="progress-note">
                            {lastNote || "Processing image…"}
                        </div>
                    </>
                ) : (
                        outURL &&
                        typeof window !== "undefined" &&
                        window.innerWidth >= 1024 && (
                            <div
                                className={
                                    "result-ready-scroll-cue" +
                                    (animateCue ? " scroll-cue-animate" : "")
                                }
                            >

                                <span className="result-ready-scroll-icon">↓</span>
                                <span className="result-ready-scroll-text">
                                    Scroll down to download
                                </span>
                            </div>
                        )

                )}
            </div>



        </section>

    );
}
