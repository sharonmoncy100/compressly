import { useCallback, useEffect, useRef, useState } from "react";
import "./HomePage.css";

/* ------------------------------------------------------------------
   Brand mark - inlined so the homepage has no asset-path dependency
   and the logo inherits colour/size from CSS.
------------------------------------------------------------------- */

function BrandMark() {
    return (
        <svg
            className="hp-brand__mark"
            viewBox="0 0 256 256"
            aria-hidden="true"
            focusable="false"
        >
            <path
                fill="#047cf8"
                fillRule="evenodd"
                d="M197.71 122.91C197.74 123.22 197.76 123.53 197.79 123.83C196.49 124.39 195.19 124.94 193.88 125.5C193.53 125.96 193.18 126.41 192.83 126.87C192.41 126.72 191.98 126.57 191.55 126.42C188.4 124.22 184.21 119.75 186.02 115.53C186.97 113.33 189.7 111.6 189.89 109.16C190.54 100.5 189.87 91.52 189.87 82.83C189.87 79.15 191.3 72.2 188.51 69.32C185.91 66.64 168.28 67.98 163.83 67.98C140.17 67.98 116.5 67.98 92.83 67.98C87.58 67.98 68.91 66.29 65.96 70.12C64.05 72.59 65.08 77.86 65.09 80.83C65.13 90.09 63.67 100.59 65.15 109.71C65.74 113.31 69.35 114.58 69.19 118.8C69.03 122.74 64.56 124.35 63.06 127.5C64.81 131.16 69.13 132.46 69.13 137.17C69.12 140.52 65.89 141.65 65.14 144.59C63.59 150.73 65.12 167.87 65.1 175.17C65.09 178.14 64 183.29 66.1 185.71C69.22 189.3 85.78 187.69 90.83 187.69C114.61 187.69 138.39 187.76 162.17 187.68C167.2 187.66 185.75 189.28 188.73 185.9C190.99 183.34 189.87 178.33 189.87 175.17C189.87 167.56 191.37 151.17 189.85 144.59C188.49 138.69 180.35 135.92 191.55 128.57C192.2 128.26 192.85 127.95 193.5 127.63C194.9 128.37 196.29 129.1 197.69 129.83C197.92 130.39 198.15 130.94 198.38 131.5C197.26 132.98 194 134.62 193.66 136.52C193.22 139.03 196.8 140.91 196.95 143.5C197.55 153.64 196.92 164.01 196.92 174.17C196.92 179.4 197.7 184.89 194.61 189.44C188.67 198.18 172.18 194.72 163.17 194.72C141.61 194.72 120.06 194.72 98.5 194.71C88.35 194.71 76.41 196.41 66.5 194.01C62.44 193.02 58.66 188.58 58.07 184.49C56.56 173.92 57.5 155.55 57.99 144.5C58.11 141.63 61.91 138.81 61.27 136.23C59.4 128.74 44.76 130.53 39.17 130.43C36.95 130.38 31.44 129.82 29.83 131.34C30.44 135.28 38.81 137.86 37.56 142.43C36.91 144.79 33.98 145.26 32.2 143.98C29.29 141.88 18.08 131.23 17.31 128.15C16.45 124.67 32.29 108.78 35.72 110.15C42.5 112.86 30.06 120.42 30.13 123.5C32.37 124.38 35.75 123.79 38.17 123.8C44.7 123.82 59.92 126.67 61.86 117.5C60.86 115.71 59.12 114.39 58.32 112.49C56.53 108.25 57.98 100.76 57.98 96.17C57.98 88.18 55.75 72.31 60.37 65.89C65.33 58.98 75.86 60.97 83.17 61.02C102.83 61.16 122.5 61 142.17 61C153.83 61 165.5 61 177.17 61C183.3 61 189.43 60.34 194.04 65.12C197.49 68.71 196.92 73.93 196.92 78.5C196.92 89.15 198.36 100.93 196.89 111.46C196.52 114.13 193.64 115.6 193.33 118.17C194.79 119.75 196.25 121.33 197.71 122.91ZM136.36 142.48C134.95 143.4 133.2 146.18 131.78 147.61C124.42 154.97 118 162.39 110.61 169.78C108.24 172.15 102.43 176.08 102.67 179.62C95.97 180.56 88.93 179.91 82.17 179.93C79.71 179.94 76.28 180.7 74.37 178.79C71.91 176.32 73.14 162.81 73.13 158.83C73.1 153.15 71.74 137.41 73.32 132.84C74.3 130.01 77.79 127.74 79.77 125.61C85.18 119.78 90.87 111.74 97.49 107.32C103.42 103.37 108.97 108.2 112.34 112.82C117.49 119.89 123.15 126.71 128.68 133.49C130.87 136.16 133.29 140.93 136.36 142.48Z"
            />
            <path
                fill="#834cf9"
                fillRule="evenodd"
                d="M158.51 81.74C173.44 79.17 178.39 102.13 163.84 105.76C147.5 109.84 142.24 84.55 158.51 81.74ZM198.38 131.5C198.15 130.94 197.92 130.39 197.69 129.83C196.29 129.1 194.9 128.37 193.5 127.63C192.85 127.95 192.2 128.26 191.55 128.57C191.67 128.22 191.78 127.86 191.9 127.5C191.78 127.14 191.67 126.78 191.55 126.42C191.98 126.57 192.41 126.72 192.83 126.87C193.18 126.41 193.53 125.96 193.88 125.5C195.19 124.94 196.49 124.39 197.79 123.83C197.76 123.53 197.74 123.22 197.71 122.91C206.86 123.16 216.01 123.42 225.17 123.67C224.88 120.67 212.12 112.28 219.51 110.01C222.85 108.98 238.81 124.77 237.98 128.16C237.07 131.86 227.91 139.09 224.94 142.11C223.55 143.53 221.94 145.61 219.67 144.83C212.12 142.24 224.48 134.31 225.5 131.33C216.46 131.39 207.42 131.44 198.38 131.5ZM102.67 179.62C102.43 176.08 108.24 172.15 110.61 169.78C118 162.39 124.42 154.97 131.78 147.61C133.2 146.18 134.95 143.4 136.36 142.48C141.56 138.76 148.83 126.28 155.17 125.87C160.75 125.51 165.21 131.94 168.49 135.71C172.14 139.89 179.96 144.78 181.7 150.17C183.2 154.83 181.87 161.92 181.87 166.83C181.87 169.91 182.83 174.9 181.54 177.71C179.77 181.53 166.84 180.02 162.83 180.02C149.39 180.02 135.95 179.99 122.5 179.98C116.18 179.97 108.84 180.98 102.67 179.62Z"
            />
        </svg>
    );
}

function ArrowIcon() {
    return (
        <svg
            className="hp-arrow"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
        >
            <path d="M5 12h13M12 5l7 7-7 7" />
        </svg>
    );
}

/* ------------------------------------------------------------------
   Navigation + tool data
------------------------------------------------------------------- */

const NAV_LINKS = [
    { label: "Tools", href: "#tools" },
    { label: "Guide", href: "#file-sizes" },
    { label: "FAQ", href: "#faq" },
    { label: "About", href: "/about.html" }
];

const SPECIALISED_TOOLS = [
    {
        name: "Compress to 100 KB",
        href: "/compress-image-to-100kb.html",
        blurb:
            "Some upload forms reject anything over 100 KB and give no explanation why. This works backwards from that limit, adjusting quality until the file fits underneath it."
    },
    {
        name: "Compress JPG",
        href: "/compress-jpg-online.html",
        blurb:
            "A narrower version of the main compressor for photos that are already JPG and only need to be made lighter - no format conversion, no extra decisions."
    },
    {
        name: "Kerala PSC Photo Tool",
        href: "/psc-photo-tool.html",
        blurb:
            "PSC applications specify photo dimensions and file size together, and a photo that satisfies one often fails the other. This handles both constraints at once."
    },
    {
        name: "Passport Photo Maker",
        href: "/passport-photo-maker/",
        blurb:
            "Produces 35 × 45 mm passport and visa photos: the background is removed, the face is framed to the proportions these documents expect, and you pick a plain backdrop."
    },
    {
        name: "Amazon Image Resizer",
        href: "/amazon-image-resizer/",
        blurb:
            "Listing images have to clear a minimum pixel size before the zoom feature turns on. Point this at a product photo to get dimensions that qualify."
    },
    {
        name: "Pinterest Image Downloader",
        href: "/pinterest-image-downloader/",
        blurb:
            "The image shown on a pin is a scaled-down preview. Paste the pin link to retrieve the larger original the uploader actually submitted."
    }
];

const TASK_ROUTES = [
    {
        need: "A file is too large for an upload form",
        tool: "Image Compressor",
        href: "/compress-image/"
    },
    {
        need: "The form specifies a maximum of 100 KB",
        tool: "Compress to 100 KB",
        href: "/compress-image-to-100kb.html"
    },
    {
        need: "You are applying through Kerala PSC",
        tool: "Kerala PSC Photo Tool",
        href: "/psc-photo-tool.html"
    },
    {
        need: "You need a passport or visa photograph",
        tool: "Passport Photo Maker",
        href: "/passport-photo-maker/"
    },
    {
        need: "You are preparing an Amazon product listing",
        tool: "Amazon Image Resizer",
        href: "/amazon-image-resizer/"
    },
    {
        need: "You want the full-size image behind a pin",
        tool: "Pinterest Image Downloader",
        href: "/pinterest-image-downloader/"
    }
];

const FAQS = [
    {
        q: "Is Compressly free to use?",
        a: "Yes. The tools are free, there is no account to create, and nothing is watermarked. Some pages carry advertising, which is what keeps the tools available."
    },
    {
        q: "Does compression happen in my browser?",
        a: "For the compressor, yes - the file is read, re-encoded and handed back without being sent anywhere. A couple of tools do need a server: background removal in the passport photo maker runs on our own machine, and the Pinterest downloader has to fetch the image from Pinterest on your behalf. Each of those pages says so."
    },
    {
        q: "Which format should I pick?",
        a: "JPEG for photographs, PNG when you need transparency or crisp text and lines, WebP when the destination is a website you control. If you are uploading to a government or exam portal, use whatever the instructions ask for - usually JPEG - because some portals reject anything else."
    },
    {
        q: "Can I hit an exact file size?",
        a: "You can target one. The compressor lets you set a KB figure and works toward it, but the result lands near the target rather than exactly on it, because encoders cannot be told to produce a precise byte count. Aim slightly under any hard limit."
    },
    {
        q: "Can I use these for application forms?",
        a: "That is what most of the specialised tools exist for. Read the instructions on the form first - dimensions in pixels or millimetres, a maximum file size, sometimes a background colour - then pick the tool that matches. Check the output against the requirements before you submit."
    },
    {
        q: "What is the difference between JPG and JPEG?",
        a: "Nothing. They are the same format with two spellings, left over from when Windows filenames allowed only three characters after the dot. A file renamed from .jpeg to .jpg is unchanged."
    },
    {
        q: "Can I compress HEIC photos from my iPhone?",
        a: "Yes. The compressor reads HEIC and HEIF and can convert them to JPEG or PNG, which is normally what you want, since most upload forms do not accept HEIC."
    }
];

/* ------------------------------------------------------------------
   Homepage
------------------------------------------------------------------- */

export default function HomePage() {
    const [menuOpen, setMenuOpen] = useState(false);
    const headerRef = useRef(null);
    const toggleRef = useRef(null);

    const closeMenu = useCallback(() => setMenuOpen(false), []);

    /* Escape closes the menu and returns focus to the toggle. */
    useEffect(() => {
        if (!menuOpen) return undefined;

        function onKeyDown(event) {
            if (event.key === "Escape") {
                setMenuOpen(false);
                if (toggleRef.current) toggleRef.current.focus();
            }
        }

        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [menuOpen]);

    /* A click or tap outside the header closes the menu. */
    useEffect(() => {
        if (!menuOpen) return undefined;

        function onPointerDown(event) {
            if (headerRef.current && !headerRef.current.contains(event.target)) {
                setMenuOpen(false);
            }
        }

        document.addEventListener("pointerdown", onPointerDown);
        return () => document.removeEventListener("pointerdown", onPointerDown);
    }, [menuOpen]);

    /* Widening past the mobile breakpoint leaves no orphaned panel behind. */
    useEffect(() => {
        const query = window.matchMedia("(min-width: 861px)");

        function onChange(event) {
            if (event.matches) setMenuOpen(false);
        }

        query.addEventListener("change", onChange);
        return () => query.removeEventListener("change", onChange);
    }, []);

    return (
        <div className="hp-root">
            <a className="hp-skip" href="#main">
                Skip to content
            </a>

            {/* ---------------------------------------------------------
          HEADER
      ---------------------------------------------------------- */}

            <header className="hp-header" ref={headerRef}>
                <div className="hp-header__inner">
                    <a className="hp-brand" href="/" aria-label="Compressly - home">
                        <BrandMark />
                        <span className="hp-brand__word">Compressly</span>
                    </a>

                    <nav className="hp-nav" aria-label="Primary">
                        <ul className="hp-nav__list">
                            {NAV_LINKS.map((link) => (
                                <li key={link.href}>
                                    <a className="hp-nav__link" href={link.href}>
                                        {link.label}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </nav>

                    <button
                        type="button"
                        className={
                            menuOpen ? "hp-burger hp-burger--open" : "hp-burger"
                        }
                        aria-label={menuOpen ? "Close menu" : "Open menu"}
                        aria-expanded={menuOpen}
                        aria-controls="hp-mobile-nav"
                        onClick={() => setMenuOpen((open) => !open)}
                        ref={toggleRef}
                    >
                        <span className="hp-burger__bar" />
                        <span className="hp-burger__bar" />
                        <span className="hp-burger__bar" />
                    </button>
                </div>

                <div
                    className={menuOpen ? "hp-drawer hp-drawer--open" : "hp-drawer"}
                    id="hp-mobile-nav"
                    hidden={!menuOpen}
                >
                    <nav aria-label="Mobile">
                        <ul className="hp-drawer__list">
                            {NAV_LINKS.map((link) => (
                                <li key={link.href}>
                                    <a
                                        className="hp-drawer__link"
                                        href={link.href}
                                        onClick={closeMenu}
                                    >
                                        {link.label}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </nav>
                </div>
            </header>

            <main id="main">
                {/* -------------------------------------------------------
            HERO
        -------------------------------------------------------- */}

                <section className="hp-hero">
                    <div className="hp-shell hp-hero__inner">
                        <div className="hp-hero__lead">
                            <h1 className="hp-hero__title">
                                Tools for getting an image{" "}
                                <br />
                                to the size something else expects.
                            </h1>

                            <p className="hp-hero__text">
                                Upload forms, exam portals and marketplaces each want an image a
                                particular way - under a file size, at set dimensions, in a
                                format they accept. Compressly is a small set of tools for
                                meeting those requirements without installing anything.
                            </p>

                            <div className="hp-hero__actions">
                                <a className="hp-btn hp-btn--solid" href="/compress-image/">
                                    Compress an image
                                    <ArrowIcon />
                                </a>
                                <a className="hp-btn hp-btn--quiet" href="#tools">
                                    See all tools
                                </a>
                            </div>
                        </div>

                        <div className="hp-hero__aside">
                            {/* above the fold - eager, not lazy, so it doesn't compete
                                for priority behind an unnecessary lazy-load heuristic */}
                            <img
                                className="hp-hero__visual"
                                src="/hero-photo-mockup.webp"
                                width="900"
                                height="977"
                                alt="A portrait photo accepted at 96 KB and 150 x 300 pixels, showing the kind of size and dimension requirement Compressly's tools help you meet"
                            />
                        </div>
                    </div>
                </section>

                {/* -------------------------------------------------------
            FEATURED TOOL
        -------------------------------------------------------- */}

                <section className="hp-section" id="tools" aria-labelledby="hp-tools-title">
                    <div className="hp-shell">
                        <header className="hp-sectionHead">
                            <p className="hp-kicker">Tools</p>
                            <h2 className="hp-h2" id="hp-tools-title">
                                Start with the compressor
                            </h2>
                        </header>

                        <article className="hp-feature">
                            <div className="hp-feature__body">
                                <h3 className="hp-feature__title">Image Compressor</h3>
                                <p className="hp-feature__text">
                                    The general-purpose tool, and the right choice unless you know
                                    you need one of the others. Set a quality level or a target
                                    file size, compare the result against the original before you
                                    commit, and rename the file on the way out.
                                </p>

                                <dl className="hp-specs">
                                    <div className="hp-specs__row">
                                        <dt>Reads</dt>
                                        <dd>JPEG, PNG, WebP, HEIC and HEIF</dd>
                                    </div>
                                    <div className="hp-specs__row">
                                        <dt>Writes</dt>
                                        <dd>JPEG, PNG and WebP</dd>
                                    </div>
                                    <div className="hp-specs__row">
                                        <dt>Controls</dt>
                                        <dd>Quality slider, or a file size to aim for</dd>
                                    </div>
                                </dl>

                                <a className="hp-btn hp-btn--solid" href="/compress-image/">
                                    Open the compressor
                                    <ArrowIcon />
                                </a>
                            </div>

                            <div className="hp-feature__aside" aria-hidden="true">
                                <div className="hp-sizeviz">
                                    <div className="hp-sizeviz__row">
                                        <span className="hp-sizeviz__label">Original</span>
                                        <span className="hp-sizeviz__bar hp-sizeviz__bar--full" />
                                    </div>
                                    <div className="hp-sizeviz__row">
                                        <span className="hp-sizeviz__label">Compressed</span>
                                        <span className="hp-sizeviz__bar hp-sizeviz__bar--small" />
                                    </div>
                                    <p className="hp-sizeviz__note">
                                        How much a file shrinks depends on what is in it - the
                                        section below explains why.
                                    </p>
                                </div>
                            </div>
                        </article>
                    </div>
                </section>

                {/* -------------------------------------------------------
            SPECIALISED TOOLS
        -------------------------------------------------------- */}

                <section className="hp-section hp-section--tight" aria-labelledby="hp-more-title">
                    <div className="hp-shell">
                        <header className="hp-sectionHead">
                            <h2 className="hp-h2" id="hp-more-title">
                                Tools for a specific requirement
                            </h2>
                            <p className="hp-sectionHead__text">
                                Each of these exists because a particular form or platform asks
                                for something the general compressor would make you work out by
                                hand.
                            </p>
                        </header>

                        <ul className="hp-toolList">
                            {SPECIALISED_TOOLS.map((tool) => (
                                <li className="hp-toolList__item" key={tool.href}>
                                    <article>
                                        <h3 className="hp-toolList__name">
                                            <a className="hp-toolList__link" href={tool.href}>
                                                {tool.name}
                                                <ArrowIcon />
                                            </a>
                                        </h3>
                                        <p className="hp-toolList__blurb">{tool.blurb}</p>
                                    </article>
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>

                {/* -------------------------------------------------------
            TASK ROUTING
        -------------------------------------------------------- */}

                <section className="hp-section hp-section--band" aria-labelledby="hp-need-title">
                    <div className="hp-shell">
                        <header className="hp-sectionHead">
                            <p className="hp-kicker">Where to go</p>
                            <h2 className="hp-h2" id="hp-need-title">
                                If this is your situation
                            </h2>
                        </header>

                        <ul className="hp-routes">
                            {TASK_ROUTES.map((item) => (
                                <li className="hp-routes__row" key={item.need}>
                                    <span className="hp-routes__need">{item.need}</span>
                                    <span className="hp-routes__rule" aria-hidden="true" />
                                    <a className="hp-routes__tool" href={item.href}>
                                        {item.tool}
                                        <ArrowIcon />
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>

                {/* -------------------------------------------------------
            EDITORIAL: UNDERSTANDING FILE SIZES
        -------------------------------------------------------- */}

                <section className="hp-section" id="file-sizes" aria-labelledby="hp-guide-title">
                    <div className="hp-shell">
                        <header className="hp-sectionHead hp-sectionHead--wide">
                            <p className="hp-kicker">Guide</p>
                            <h2 className="hp-h2" id="hp-guide-title">
                                Understanding image file sizes
                            </h2>
                            <p className="hp-sectionHead__text">
                                Most of the trouble people run into with image uploads comes
                                from a handful of misunderstandings. These are the ones worth
                                knowing before you start adjusting settings.
                            </p>
                        </header>

                        <div className="hp-prose">
                            <h3>Dimensions and file size are two different limits</h3>
                            <p>
                                A form asking for 600 × 600 pixels is describing dimensions. One
                                asking for a file under 50 KB is describing storage. They are
                                related but not interchangeable, and a form can impose both at
                                once. Dimensions set an upper bound on how much detail the file
                                has to store, so shrinking them is usually the fastest way to
                                bring file size down - halving an image&rsquo;s width and height
                                leaves it with a quarter of the pixels.
                            </p>

                            <h3>What compression actually removes</h3>
                            <p>
                                Lossy compression, which is what JPEG and most WebP files use,
                                discards detail your eye is least likely to miss: fine colour
                                variation, subtle differences between neighbouring pixels. Push
                                it far enough and you start seeing the damage - blocky patches
                                in smooth areas like skies, halos around hard edges and text.
                                Lossless compression, used by PNG, stores the image more
                                efficiently without discarding anything, which means smaller
                                gains but no visible change.
                            </p>

                            <h3>Choosing a format</h3>
                            <p>
                                Format matters more than most settings. This is the short
                                version:
                            </p>

                            <div className="hp-tableWrap">
                                <table className="hp-table">
                                    <caption className="hp-table__caption">
                                        Where each common format is the right choice
                                    </caption>
                                    <thead>
                                        <tr>
                                            <th scope="col">Format</th>
                                            <th scope="col">Best for</th>
                                            <th scope="col">Worth knowing</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <th scope="row">JPEG</th>
                                            <td>Photographs and anything camera-made</td>
                                            <td>
                                                No transparency. Accepted almost everywhere, which makes
                                                it the safe pick for official forms.
                                            </td>
                                        </tr>
                                        <tr>
                                            <th scope="row">PNG</th>
                                            <td>Screenshots, logos, line art, text</td>
                                            <td>
                                                Keeps edges sharp and supports transparency, but
                                                produces large files for photographs.
                                            </td>
                                        </tr>
                                        <tr>
                                            <th scope="row">WebP</th>
                                            <td>Images going onto a website you control</td>
                                            <td>
                                                Usually smaller than an equivalent JPEG, though some
                                                older upload systems still reject it.
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <h3>Working toward a specific size</h3>
                            <p>
                                When a form names a number, aim under it rather than at it.
                                Encoders cannot be instructed to produce an exact byte count -
                                a tool targeting 100 KB re-encodes at different quality levels
                                until it lands close, so the result might be 94 KB or 103 KB.
                                If the limit is hard, leave yourself room.
                            </p>

                            <h3>When resizing beats compressing</h3>
                            <p>
                                If an image is far larger than it will ever be displayed, resize
                                first. A 4000-pixel-wide photo shown in a 600-pixel-wide box on
                                a page is storing detail nobody will see, and squeezing that
                                detail through heavy compression degrades the image while
                                keeping all the pixels. Reducing the dimensions and then
                                compressing lightly almost always looks better than keeping the
                                dimensions and compressing hard.
                            </p>

                            <h3>Why some images resist small targets</h3>
                            <p>
                                Fine, irregular detail is expensive to store. Foliage, gravel,
                                textured fabric, hair, film grain and sensor noise all give the
                                encoder very little to simplify, so a photo full of them stays
                                stubbornly large where a portrait against a plain wall
                                cooperates immediately. If a photo will not come down to the
                                size you need without looking damaged, reduce its dimensions -
                                that is the lever that still works.
                            </p>

                            <h3>What repeated compression does</h3>
                            <p>
                                Every lossy save throws away a little more. Compress a JPEG,
                                save it, then compress that file again and the second pass is
                                working on a picture that already has artifacts baked in, which
                                it then treats as real detail worth preserving. The damage
                                accumulates and cannot be undone. Keep the original somewhere
                                and always compress from that, not from the last compressed
                                copy.
                            </p>

                            <h3>Why this matters more on a phone</h3>
                            <p>
                                On a mobile connection, an oversized image costs time and data
                                that a desktop user on broadband never notices. The same page
                                that feels instant on a laptop can take several seconds on a
                                patchy signal, and metered plans make the difference concrete.
                                If the images you publish are for a general audience, assume a
                                fair share of that audience is on a phone.
                            </p>
                        </div>
                    </div>
                </section>

                {/* -------------------------------------------------------
            HOW PROCESSING WORKS
        -------------------------------------------------------- */}

                <section className="hp-section hp-section--band" aria-labelledby="hp-how-title">
                    <div className="hp-shell">
                        <div className="hp-split">
                            <div className="hp-split__lead">
                                <p className="hp-kicker">How it works</p>
                                <h2 className="hp-h2" id="hp-how-title">
                                    Where your image goes
                                </h2>
                                <p className="hp-split__text">
                                    Worth being precise about, because it differs between tools
                                    and the distinction is not obvious from the outside.
                                </p>
                            </div>

                            <div className="hp-split__body">
                                <h3 className="hp-h4">The compressor stays on your device</h3>
                                <p>
                                    Compression runs in the browser itself. The file is read from
                                    disk, decoded, re-encoded at the settings you chose and handed
                                    back as a download. It is never transmitted to a server for
                                    processing, which also means the tool keeps working if your
                                    connection drops mid-session.
                                </p>

                                <h3 className="hp-h4">Two tools do need a server</h3>
                                <p>
                                    Background removal in the passport photo maker runs a model
                                    that is impractical to ship to a browser, so that image is
                                    sent to our server, processed and returned. The Pinterest
                                    downloader has to request the image from Pinterest on your
                                    behalf, because browsers block pages from fetching files
                                    across sites directly. Both pages state this where it is
                                    relevant.
                                </p>

                                <h3 className="hp-h4">What that does and does not mean</h3>
                                <p>
                                    Browser-based processing is a real, practical benefit: your
                                    file is not being copied onto someone else&rsquo;s machine to
                                    be resized. It is not a security guarantee, and we would
                                    rather describe it accurately than dress it up. Treat any
                                    online tool the way you would treat any website when the
                                    material is genuinely sensitive.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* -------------------------------------------------------
            ABOUT
        -------------------------------------------------------- */}

                <section className="hp-section" aria-labelledby="hp-about-title">
                    <div className="hp-shell">
                        <div className="hp-about">
                            <p className="hp-kicker">About</p>
                            <h2 className="hp-h2" id="hp-about-title">
                                What Compressly is
                            </h2>
                            <p>
                                Compressly started as a single image compressor and grew as
                                specific problems came up. Somebody needed a photo under a fixed
                                KB limit for an application portal. Somebody else needed the
                                exact dimensions Kerala PSC asks for. Each of those turned into
                                its own page rather than another checkbox on an increasingly
                                complicated form.
                            </p>
                            <p>
                                It is aimed at people doing something practical and finite -
                                submitting an application, listing a product, getting a photo
                                accepted by a portal that keeps refusing it. The goal is that
                                you arrive with a problem, solve it, and leave. There is no
                                account to make and nothing to install.
                            </p>
                            <p>
                                If a tool behaves oddly, or a form you are dealing with has a
                                requirement none of these handle,{" "}
                                <a className="hp-inlineLink" href="/contact.html">
                                    get in touch
                                </a>
                                . That is where most of these pages came from in the first
                                place.
                            </p>
                        </div>
                    </div>
                </section>

                {/* -------------------------------------------------------
            FAQ
        -------------------------------------------------------- */}

                <section className="hp-section hp-section--tight" id="faq" aria-labelledby="hp-faq-title">
                    <div className="hp-shell">
                        <header className="hp-sectionHead">
                            <p className="hp-kicker">Questions</p>
                            <h2 className="hp-h2" id="hp-faq-title">
                                Frequently asked
                            </h2>
                        </header>

                        <div className="hp-faq">
                            {FAQS.map((item) => (
                                <details className="hp-faq__item" key={item.q}>
                                    <summary className="hp-faq__q">
                                        <span>{item.q}</span>
                                        <svg
                                            className="hp-faq__chevron"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="1.8"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            aria-hidden="true"
                                            focusable="false"
                                        >
                                            <path d="M6 9l6 6 6-6" />
                                        </svg>
                                    </summary>
                                    <div className="hp-faq__a">
                                        <p>{item.a}</p>
                                    </div>
                                </details>
                            ))}
                        </div>
                    </div>
                </section>
            </main>

            {/* ---------------------------------------------------------
          FOOTER
      ---------------------------------------------------------- */}

            <footer className="hp-footer">
                <div className="hp-shell">
                    <div className="hp-footer__top">
                        <div className="hp-footer__brandCol">
                            <a className="hp-brand" href="/" aria-label="Compressly - home">
                                <BrandMark />
                                <span className="hp-brand__word">Compressly</span>
                            </a>
                            <p className="hp-footer__tagline">
                                Tools for getting images to the size and shape something
                                else is asking for.
                            </p>
                        </div>

                        <nav className="hp-footer__nav" aria-label="Footer">
                            <div className="hp-footer__col">
                                <h2 className="hp-footer__heading">Compress</h2>
                                <ul>
                                    <li>
                                        <a href="/compress-image/">Image Compressor</a>
                                    </li>
                                    <li>
                                        <a href="/compress-image-to-100kb.html">Compress to 100 KB</a>
                                    </li>
                                    <li>
                                        <a href="/compress-jpg-online.html">Compress JPG</a>
                                    </li>
                                </ul>
                            </div>

                            <div className="hp-footer__col">
                                <h2 className="hp-footer__heading">Global Tools</h2>
                                <ul>
                                    <li>
                                        <a href="/passport-photo-maker/">Passport Photo Maker</a>
                                    </li>
                                    <li>
                                        <a href="/amazon-image-resizer/">Amazon Image Resizer</a>
                                    </li>
                                    <li>
                                        <a href="/pinterest-image-downloader/">
                                            Pinterest Image Downloader
                                        </a>
                                    </li>
                                    <li>
                                        <a href="/signature-maker/">Signature Maker</a>
                                    </li>
                                </ul>
                            </div>

                            <div className="hp-footer__col">
                                <h2 className="hp-footer__heading">India Exam Tools</h2>
                                <ul>
                                    <li>
                                        <a href="/psc-photo-tool.html">Kerala PSC Photo Tool</a>
                                    </li>
                                    <li>
                                        <a href="/mpsc-photo-resizer/">MPSC Photo Resizer</a>
                                    </li>
                                    <li>
                                        <a href="/ssc-photo-resizer/">SSC Photo Resizer</a>
                                    </li>
                                </ul>
                            </div>

                            <div className="hp-footer__col">
                                <h2 className="hp-footer__heading">Site</h2>
                                <ul>
                                    <li>
                                        <a href="/about.html">About</a>
                                    </li>
                                    <li>
                                        <a href="/contact.html">Contact</a>
                                    </li>
                                    <li>
                                        <a href="/privacy.html">Privacy</a>
                                    </li>
                                    <li>
                                        <a href="/terms.html">Terms</a>
                                    </li>
                                </ul>
                            </div>
                        </nav>
                    </div>

                    <div className="hp-footer__bottom">
                        <p>© {new Date().getFullYear()} Compressly</p>
                        <p className="hp-footer__note">
                            Compression runs in your browser. A few tools need a server, and
                            say so.
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}