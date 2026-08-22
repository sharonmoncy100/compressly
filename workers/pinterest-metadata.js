const ALLOWED_ORIGINS = ['https://www.compressly.in', 'https://compressly.in'];

export default {
    async fetch(request) {
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

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 9000);

            const response = await fetch(decoded, {
                signal: controller.signal,
                headers: {
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Cache-Control': 'no-cache',
                },
            });

            clearTimeout(timeout);

            if (!response.ok) {
                return new Response(JSON.stringify({ error: 'Could not reach Pinterest. Please try again.' }), { status: 502, headers });
            }

            const html = await response.text();

            // Try og:image (two attribute orders)
            const ogMatch =
                html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
                html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);

            if (!ogMatch || !ogMatch[1]) {
                return new Response(JSON.stringify({ error: 'Could not find an image in this Pinterest URL. Make sure the pin is public.' }), { status: 404, headers });
            }

            let imageUrl = ogMatch[1];

            // Extract title if available
            const titleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
                html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
            const title = titleMatch ? titleMatch[1].trim() : 'Pinterest Image';

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

            let hdUrl = imageUrl;
            let sdUrl = imageUrl;

            // Quick Download = 736x where possible
            if (imageUrl.includes('/564x/')) {
                sdUrl = imageUrl.replace('/564x/', '/736x/');
            } else if (imageUrl.includes('/originals/')) {
                sdUrl = imageUrl.replace('/originals/', '/736x/');
            } else if (imageUrl.includes('/736x/')) {
                sdUrl = imageUrl;
            }

            // --------------------------------------------------
            // HD DOWNLOAD
            // Try Pinterest original first.
            // If unavailable or larger than 15 MB, use 736x.
            // --------------------------------------------------

            const MAX_ORIGINAL_SIZE = 15 * 1024 * 1024; // 15 MB

            let originalUrl = imageUrl
                .replace('/564x/', '/originals/')
                .replace('/736x/', '/originals/');

            try {
                const originalController = new AbortController();

                const originalTimeout = setTimeout(
                    () => originalController.abort(),
                    3000
                );

                let originalCheck;

                try {
                    originalCheck = await fetch(originalUrl, {
                        method: 'HEAD',
                        redirect: 'follow',
                        signal: originalController.signal,
                        headers: {
                            'User-Agent':
                                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36'
                        }
                    });
                } finally {
                    clearTimeout(originalTimeout);
                }

                const contentType =
                    originalCheck.headers.get('content-type') || '';

                const contentLength =
                    Number(originalCheck.headers.get('content-length') || 0);

                const isImage =
                    contentType.toLowerCase().startsWith('image/');

                const sizeIsSafe =
                    contentLength === 0 ||
                    contentLength <= MAX_ORIGINAL_SIZE;

                if (
                    originalCheck.ok &&
                    isImage &&
                    sizeIsSafe
                ) {
                    // Original exists and is acceptable.
                    hdUrl = originalUrl;

                } else {
                    // Original missing, invalid, or too large.
                    hdUrl = imageUrl
                        .replace('/564x/', '/736x/')
                        .replace('/originals/', '/736x/');
                }

            } catch {
                // Pinterest check failed.
                // Safely fall back to 736x.
                hdUrl = imageUrl
                    .replace('/564x/', '/736x/')
                    .replace('/originals/', '/736x/');
            }

            return new Response(JSON.stringify({ hdUrl, sdUrl, title, category }), { status: 200, headers });
        } catch (err) {
            if (err.name === 'AbortError') {
                return new Response(JSON.stringify({ error: 'Request timed out. Pinterest took too long to respond.' }), { status: 504, headers });
            }
            console.error('Pinterest fetch error:', err.message);
            return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), { status: 500, headers });
        }
    },
};
