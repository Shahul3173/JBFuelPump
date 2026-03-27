const cheerio = require('cheerio');

// Simple in-memory cache (persists across warm invocations)
let priceCache = {
    data: null,
    lastFetched: 0
};
const CACHE_DURATION_MS = 1000 * 60 * 60; // 1 hour

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    const now = Date.now();
    if (priceCache.data && (now - priceCache.lastFetched) < CACHE_DURATION_MS) {
        return res.json(priceCache.data);
    }

    try {
        const results = {
            sg: {},
            my: {}
        };

        // 1. Fetch SG
        const sgRes = await fetch('https://www.motorist.sg/petrol-prices', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        if (sgRes.ok) {
            const sgHtml = await sgRes.text();
            const $sg = cheerio.load(sgHtml);

            const sgGrades = ['92', '95', '98', 'Premium', 'Diesel'];

            $sg('tr').each((i, el) => {
                const text = $sg(el).text().replace(/\s+/g, ' ').trim();
                sgGrades.forEach(grade => {
                    if (text.startsWith(grade)) {
                        const priceMatch = text.match(/\$\s*(\d+\.\d{2})/);
                        if (priceMatch) {
                            const slug = grade.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
                            if (!results.sg[slug]) results.sg[slug] = parseFloat(priceMatch[1]);
                        }
                    }
                });
            });
        }

        // 2. Fetch MY
        const myRes = await fetch('https://www.motorist.my/petrol-prices', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        if (myRes.ok) {
            const myHtml = await myRes.text();
            const $my = cheerio.load(myHtml);

            const myGrades = [
                'RON 95 (Budi)', 'RON 95', 'RON 97', 'RON 100',
                'V-Power Racing', 'Diesel Euro 5 B10 (East)', 'Diesel Euro 5 B10',
                'Diesel Euro 5 B7 (East)', 'Diesel Euro 5 B7'
            ];

            $my('tr').each((i, el) => {
                const text = $my(el).text().replace(/\s+/g, ' ').trim();
                myGrades.forEach(grade => {
                    if (text.startsWith(grade)) {
                        const priceMatch = text.match(/RM\s*(\d+\.\d{2})/i);
                        if (priceMatch) {
                            const slug = grade.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
                            if (!results.my[slug]) results.my[slug] = parseFloat(priceMatch[1]);
                        }
                    }
                });
            });
        }

        priceCache.data = results;
        priceCache.lastFetched = now;

        res.json(results);
    } catch (e) {
        console.error('Error in /api/fuel-prices:', e);
        if (priceCache.data) {
            res.json(priceCache.data);
        } else {
            res.status(500).json({ error: 'Failed to fetch fuel prices' });
        }
    }
};
