const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Swaps whatever size segment an i.pinimg.com URL currently has
// (236x, 564x, 736x, originals, ...) for the one we actually want.
function withImageSize(imageUrl, size) {
    return imageUrl.replace(/\/(\d+x|originals)\//, `/${size}/`);
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'URL is required.' });
    }

    const decoded = decodeURIComponent(url).trim();

    let parsedInput;
    try {
        parsedInput = new URL(decoded);
    } catch {
        return res.status(400).json({ error: 'Please enter a valid Pinterest URL.' });
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
        return res.status(400).json({ error: 'Please enter a valid Pinterest URL.' });
    }

    try {
        // --------------------------------------------------
        // Resolve short pin.it links to their canonical URL.
        // A HEAD request only reads the redirect chain's Location
        // headers - it never downloads the pin page itself.
        // --------------------------------------------------

        let resolvedUrl = decoded;
        const isShortLink = hostname === 'pin.it' || hostname === 'www.pin.it';

        if (isShortLink) {
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
            } finally {
                clearTimeout(redirectTimeout);
            }
        }

        // Pull out the numeric pin ID and rebuild a clean canonical URL.
        // oEmbed rejects share-link URLs carrying invite_code/sender/sfo
        // tracking params, so this strips down to /pin/<id>/ regardless of
        // what form the link arrived in.
        const pinIdMatch = resolvedUrl.match(/\/pin\/(?:[^/]*--)?(\d+)(?:\/|$)/);

        if (!pinIdMatch) {
            return res
                .status(404)
                .json({ error: 'Could not find an image in this Pinterest URL. Make sure the pin is public.' });
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
            return res
                .status(404)
                .json({ error: 'Could not find an image in this Pinterest URL. Make sure the pin is public.' });
        }

        const oembedJson = await oembedRes.json();

        if (!oembedJson.thumbnail_url) {
            return res
                .status(404)
                .json({ error: 'Could not find an image in this Pinterest URL. Make sure the pin is public.' });
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

        return res.status(200).json({
            hdUrl,
            sdUrl,
            title,
            category
        });
    } catch (err) {
        if (err.name === 'AbortError') {
            return res.status(504).json({ error: 'Request timed out. Pinterest took too long to respond.' });
        }
        console.error('Pinterest fetch error:', err.message);
        return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
}
