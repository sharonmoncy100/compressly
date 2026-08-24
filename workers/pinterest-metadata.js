const ALLOWED_ORIGINS = ['https://www.compressly.in', 'https://compressly.in'];

const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Matches the Cache-Control Pinterest's own oEmbed responses already carry
// (max-age=259200) - a pin's image/title essentially never change, so this
// is just piggybacking on the freshness window Pinterest itself signals.
const CACHE_TTL_SECONDS = 259200; // 3 days

// Swaps whatever size segment an i.pinimg.com URL currently has
// (236x, 564x, 736x, originals, ...) for the one we actually want.
function withImageSize(imageUrl, size) {
    return imageUrl.replace(/\/(\d+x|originals)\//, `/${size}/`);
}

export default {
    async fetch(request, env, ctx) {
        const origin = request.headers.get('Origin');
        const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

        const headers = {
            'Access-Control-Allow-Origin': allowOrigin,
            Vary: 'Origin',
            'Cache-Control': 'no-store',
            'Content-Type': 'application/json',
        };

        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: {
                    ...headers,
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                },
            });
        }

        const reqUrl = new URL(request.url);
        const url = reqUrl.searchParams.get('url');

        if (!url) {
            return new Response(JSON.stringify({ error: 'URL is required.' }), { status: 400, headers });
        }

        const decoded = decodeURIComponent(url).trim();

        let parsedInput;
        try {
            parsedInput = new URL(decoded);
        } catch {
            return new Response(JSON.stringify({ error: 'Please enter a valid Pinterest URL.' }), { status: 400, headers });
        }

        const hostname = parsedInput.hostname.toLowerCase();

        const isPinterest =
            hostname === 'pin.it' ||
            hostname === 'www.pin.it' ||
            hostname === 'pinterest.com' ||
            hostname.endsWith('.pinterest.com') ||
            hostname === 'pinterest.in' ||
            hostname.endsWith('.pinterest.in') ||
            hostname === 'pinterest.co.uk' ||
            hostname.endsWith('.pinterest.co.uk') ||
            hostname === 'pinterest.ca' ||
            hostname.endsWith('.pinterest.ca');

        if (!isPinterest) {
            return new Response(JSON.stringify({ error: 'Please enter a valid Pinterest URL.' }), { status: 400, headers });
        }

        // Cache the resolved result under the exact input URL the user gave
        // (short link or canonical - whichever it was). A pin.it slug always
        // resolves to the same pin forever, so once we've paid the cost of
        // resolving it, repeats never need to touch Pinterest's redirect
        // service again - the one part of this pipeline that's shown
        // instability under volume.
        const cache = caches.default;
        const cacheKey = new Request(
            `https://pinterest-metadata-cache.internal/v1?input=${encodeURIComponent(decoded)}`,
            { method: 'GET' }
        );

        const cachedResponse = await cache.match(cacheKey);
        if (cachedResponse) {
            const cachedBody = await cachedResponse.json();
            return new Response(JSON.stringify(cachedBody), { status: 200, headers });
        }

        try {
            // --------------------------------------------------
            // Resolve short pin.it links to their canonical URL.
            // A HEAD request only reads the redirect chain's Location
            // headers - it never downloads the pin page itself.
            //
            // This step alone (not oEmbed) has shown intermittent failures
            // under load, so it gets a few cheap retries: each attempt is
            // just a HEAD request (no body downloaded either way), so
            // retrying costs next to nothing in CPU or bandwidth even when
            // every attempt fails.
            // --------------------------------------------------

            let resolvedUrl = decoded;
            const isShortLink = hostname === 'pin.it' || hostname === 'www.pin.it';
            let pinIdMatch = null;

            if (isShortLink) {
                const MAX_REDIRECT_ATTEMPTS = 3;

                for (let attempt = 1; attempt <= MAX_REDIRECT_ATTEMPTS; attempt++) {
                    const redirectController = new AbortController();
                    const redirectTimeout = setTimeout(() => redirectController.abort(), 6000);

                    try {
                        const redirectRes = await fetch(decoded, {
                            method: 'HEAD',
                            redirect: 'follow',
                            signal: redirectController.signal,
                            headers: { 'User-Agent': USER_AGENT },
                        });
                        resolvedUrl = redirectRes.url;
                    } catch {
                        // Network-level failure on this attempt - fall through to retry.
                    } finally {
                        clearTimeout(redirectTimeout);
                    }

                    pinIdMatch = resolvedUrl.match(/\/pin\/(?:[^/]*--)?(\d+)(?:\/|$)/);
                    if (pinIdMatch) break;

                    if (attempt < MAX_REDIRECT_ATTEMPTS) {
                        // A short gap does nothing here - testing showed the
                        // failure is a brief penalty window that doesn't
                        // clear in under a second, so attempts bunched close
                        // together just hit the same wall repeatedly. This
                        // needs real spacing to land in a different window.
                        await new Promise((resolve) => setTimeout(resolve, 2500));
                    }
                }
            } else {
                // Pull out the numeric pin ID and rebuild a clean canonical URL.
                // oEmbed rejects share-link URLs carrying invite_code/sender/sfo
                // tracking params, so this strips down to /pin/<id>/ regardless of
                // what form the link arrived in.
                pinIdMatch = resolvedUrl.match(/\/pin\/(?:[^/]*--)?(\d+)(?:\/|$)/);
            }

            if (!pinIdMatch) {
                return new Response(JSON.stringify({ error: 'Could not find an image in this Pinterest URL. Make sure the pin is public.' }), { status: 404, headers });
            }

            const canonicalUrl = `https://www.pinterest.com/pin/${pinIdMatch[1]}/`;

            // --------------------------------------------------
            // Pinterest's own oEmbed endpoint - the same mechanism it exposes
            // for third-party embeds (e.g. WordPress auto-embeds). Returns a
            // small JSON payload instead of the full ~1.3MB rendered page.
            // --------------------------------------------------

            const oembedController = new AbortController();
            const oembedTimeout = setTimeout(() => oembedController.abort(), 9000);

            let oembedRes;

            try {
                oembedRes = await fetch(
                    `https://www.pinterest.com/oembed.json?url=${encodeURIComponent(canonicalUrl)}`,
                    {
                        signal: oembedController.signal,
                        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
                    }
                );
            } finally {
                clearTimeout(oembedTimeout);
            }

            if (!oembedRes.ok) {
                return new Response(JSON.stringify({ error: 'Could not find an image in this Pinterest URL. Make sure the pin is public.' }), { status: 404, headers });
            }

            const oembedJson = await oembedRes.json();

            if (!oembedJson.thumbnail_url) {
                return new Response(JSON.stringify({ error: 'Could not find an image in this Pinterest URL. Make sure the pin is public.' }), { status: 404, headers });
            }

            const imageUrl = oembedJson.thumbnail_url;
            const title = (oembedJson.title || '').trim() || 'Pinterest Image';

            let category = 'Other';

            const t = title.toLowerCase();

            if (t.includes('wallpaper') || t.includes('background')) category = 'Wallpapers';
            else if (t.includes('bedroom') || t.includes('living room') || t.includes('interior') || t.includes('home decor')) category = 'Home Decor';
            else if (t.includes('mehndi') || t.includes('henna')) category = 'Mehndi';
            else if (t.includes('recipe') || t.includes('food') || t.includes('cake')) category = 'Food';
            else if (t.includes('car') || t.includes('bike')) category = 'Vehicles';
            else if (t.includes('cat') || t.includes('dog')) category = 'Animals';
            else if (t.includes('hair') || t.includes('hairstyle')) category = 'Hairstyles';
            else if (t.includes('dress') || t.includes('fashion')) category = 'Fashion';
            else if (t.includes('logo')) category = 'Logos';
            else if (t.includes('tattoo')) category = 'Tattoo';
            else if (t.includes('drawing') || t.includes('art')) category = 'Art';

            const sdUrl = withImageSize(imageUrl, '736x');

            // --------------------------------------------------
            // HD DOWNLOAD
            // Try Pinterest original first.
            // If unavailable or larger than 15 MB, use 736x.
            // --------------------------------------------------

            const MAX_ORIGINAL_SIZE = 15 * 1024 * 1024; // 15 MB

            const originalUrl = withImageSize(imageUrl, 'originals');

            let hdUrl;

            try {
                const originalController = new AbortController();
                const originalTimeout = setTimeout(() => originalController.abort(), 3000);

                let originalCheck;

                try {
                    originalCheck = await fetch(originalUrl, {
                        method: 'HEAD',
                        redirect: 'follow',
                        signal: originalController.signal,
                        headers: { 'User-Agent': USER_AGENT },
                    });
                } finally {
                    clearTimeout(originalTimeout);
                }

                const contentType = originalCheck.headers.get('content-type') || '';
                const contentLength = Number(originalCheck.headers.get('content-length') || 0);
                const isImage = contentType.toLowerCase().startsWith('image/');
                const sizeIsSafe = contentLength === 0 || contentLength <= MAX_ORIGINAL_SIZE;

                if (originalCheck.ok && isImage && sizeIsSafe) {
                    // Original exists and is acceptable.
                    hdUrl = originalUrl;
                } else {
                    // Original missing, invalid, or too large.
                    hdUrl = sdUrl;
                }
            } catch {
                // Pinterest check failed.
                // Safely fall back to 736x.
                hdUrl = sdUrl;
            }

            const resultBody = { hdUrl, sdUrl, title, category };

            ctx.waitUntil(
                cache.put(
                    cacheKey,
                    new Response(JSON.stringify(resultBody), {
                        status: 200,
                        headers: {
                            'Content-Type': 'application/json',
                            'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`,
                        },
                    })
                )
            );

            return new Response(JSON.stringify(resultBody), { status: 200, headers });
        } catch (err) {
            if (err.name === 'AbortError') {
                return new Response(JSON.stringify({ error: 'Request timed out. Pinterest took too long to respond.' }), { status: 504, headers });
            }
            console.error('Pinterest fetch error:', err.message);
            return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), { status: 500, headers });
        }
    },
};
