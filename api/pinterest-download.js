export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const { url } = req.query;

    if (!url) return res.status(400).send('URL required');

    const decoded = decodeURIComponent(url).trim();

    // Only allow Pinterest CDN domains
    const allowed = [
        'i.pinimg.com',
        'pinimg.com',
        's.pinimg.com',
    ];

    let isAllowed = false;
    try {
        const parsed = new URL(decoded);
        isAllowed = allowed.some(d => parsed.hostname.endsWith(d));
    } catch {
        return res.status(400).send('Invalid URL');
    }

    if (!isAllowed) {
        return res.status(403).send('Forbidden domain');
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const imgResponse = await fetch(decoded, {
            signal: controller.signal,
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                Referer: 'https://www.pinterest.com/',
            },
        });

        clearTimeout(timeout);

        if (!imgResponse.ok) {
            return res.status(502).send('Failed to fetch image');
        }

        const contentType = imgResponse.headers.get('content-type') || 'image/jpeg';
        const buffer = await imgResponse.arrayBuffer();

        // Derive filename from URL
        const urlPath = decoded.split('?')[0];
        const filename = urlPath.split('/').pop() || 'pinterest-image.jpg';

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.send(Buffer.from(buffer));
    } catch (err) {
        if (err.name === 'AbortError') {
            return res.status(504).send('Timeout');
        }
        return res.status(500).send('Server error');
    }
}