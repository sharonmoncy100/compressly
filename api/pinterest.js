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

    const isPinterest =
        decoded.includes('pinterest.com') ||
        decoded.includes('pinterest.co.uk') ||
        decoded.includes('pinterest.in') ||
        decoded.includes('pinterest.ca') ||
        decoded.includes('pin.it');

    if (!isPinterest) {
        return res.status(400).json({ error: 'Please enter a valid Pinterest URL.' });
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
            return res
                .status(502)
                .json({ error: 'Could not reach Pinterest. Please try again.' });
        }

        const html = await response.text();

        // Try og:image (two attribute orders)
        const ogMatch =
            html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
            html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);

        if (!ogMatch || !ogMatch[1]) {
            return res
                .status(404)
                .json({ error: 'Could not find an image in this Pinterest URL. Make sure the pin is public.' });
        }

        let imageUrl = ogMatch[1];

        // Pinterest serves 736x images — upgrade to originals where possible
        imageUrl = imageUrl
            .replace(/\/236x\//, '/originals/')
            .replace(/\/474x\//, '/originals/')
            .replace(/\/736x\//, '/originals/');

        // Extract title if available
        const titleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
            html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
        const title = titleMatch ? titleMatch[1].trim() : 'Pinterest Image';

        return res.status(200).json({ imageUrl, title });
    } catch (err) {
        if (err.name === 'AbortError') {
            return res.status(504).json({ error: 'Request timed out. Pinterest took too long to respond.' });
        }
        console.error('Pinterest fetch error:', err.message);
        return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
}