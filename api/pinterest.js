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

        // Pinterest commonly serves these sizes
        if (hdUrl.includes('/736x/')) {
            sdUrl = hdUrl.replace('/736x/', '/474x/');
        } else if (hdUrl.includes('/564x/')) {
            sdUrl = hdUrl.replace('/564x/', '/474x/');
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