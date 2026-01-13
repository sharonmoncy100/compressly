import React from "react";

export default function Header({
    Icon64,
    Icon128,
    theme,
    toggleTheme,
    showThemeToggle = true,
}) {
    return (
        <header className="header-wrap">
            <div className="header-inner flex items-center justify-between mb-3 w-full">
                <div className="header-left flex items-center gap-3">
                    <img
                        src={Icon64}
                        srcSet={`${Icon64} 64w, ${Icon128} 128w`}
                        sizes="(max-width: 640px) 32px, 38px"
                        alt="Compressly"
                        className="logo-img object-contain flex-shrink-0"
                    />


                    <span className="compressly-title">Compressly</span>
                </div>

                {showThemeToggle && (
                    <button
                        type="button"
                        onClick={toggleTheme}
                        className="theme-toggle-btn"
                        aria-label="Toggle light/dark mode"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                            <circle
                                cx="12"
                                cy="12"
                                r="9"
                                fill={theme === "light" ? "#111827" : "#f9fafb"}
                                stroke={theme === "light" ? "#111827" : "#f9fafb"}
                                strokeWidth="1.2"
                            />
                            <path
                                d="M12 3a9 9 0 0 0 0 18z"
                                fill={theme === "light" ? "#f9fafb" : "#111827"}
                            />
                        </svg>
                    </button>
                )}
            </div>
        </header>
    );
}
