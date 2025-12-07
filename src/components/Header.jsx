import React from "react";

export default function Header({ IconImg, theme, toggleTheme }) {
    return (
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
                    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
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
    );
}
