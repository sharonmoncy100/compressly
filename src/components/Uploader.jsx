import React from "react";

/* tiny local Spinner to avoid importing from App */
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
    setFormat
}) {
    return (
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
                    <h3 className="text-base font-medium">
                        Drop images here to start compressing
                    </h3>
                    <p className="small-muted mt-2">
                        Free online image compressor - reduce JPG, PNG, WebP and HEIC file
                        size in your browser.
                    </p>

                    <div className="mt-5 flex flex-col items-center gap-2">
                        <button onClick={() => inputRef.current?.click()} className="primary-upload-btn">
                            Select Image
                        </button>

                        <input
                            ref={inputRef}
                            type="file"
                            accept="image/*,image/heic,.heic,.heif"
                            className="hidden"
                            onChange={(e) => handleFiles(e.target.files)}
                        />

                        <div className="small-muted text-xs">Drag &amp; drop or click Select Image to upload.</div>
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
                                <img src={outURL} alt="Compressed image preview" className="object-contain w-full h-full" />
                            ) : previewURL ? (
                                <img src={previewURL} alt="Original image preview" className="object-contain w-full h-full" />
                            ) : null}
                        </button>

                        <div className="text-xs small-muted flex flex-col items-start" style={{ minWidth: 0 }}>
                            {displayName && (
                                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    {outURL ? "Compressed image" : "Original image"}
                                </div>
                            )}

                            {displayName && (
                                
                                <div className="font-medium truncate" style={{ maxWidth: 200 }}>
                                    {displayName}
                                </div>
                            )}
                            {displaySize ? <div className="mt-1">{humanFileSize(displaySize)}</div> : null}

                            {outURL ? (
                                <div className="mt-2 flex items-center gap-4">
                                    {outURL ? (
                                        <a href={outURL} download={displayName} className="uploader-download-pill">
                                            Download
                                        </a>
                                    ) : null}

                                    {outURL ? (
                                        <button onClick={resetAll} className="uploader-reset-pill">
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
                        <div className="w-8 text-right text-xs small-muted">{Math.round(quality * 100)}%</div>
                    </div>
                </div>

                <div>
                    <label className="control-label">Target (KB)</label>
                    <div className="mt-1 flex gap-3">
                        <input
                            value={targetKB}
                            onChange={(e) => setTargetKB(e.target.value.replace(/[^\d]/g, ""))}
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
                    <div className="progress-fill" style={{ width: `${Math.min(100, progressPct)}%` }} />
                </div>
                <div className="mt-2 text-xs small-muted text-right">
                    {lastNote}
                </div>
            </div>
        </section>
    );
}
