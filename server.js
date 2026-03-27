const express = require('express');
const cors = require('cors');
const cheerio = require('cheerio');

const app = express();
app.use(cors());

// Simple in-memory cache to avoid spamming motorist
let priceCache = {
    data: null,
    lastFetched: 0
};
const CACHE_DURATION_MS = 1000 * 60 * 60; // 1 hour

app.get('/api/fuel-prices', async (req, res) => {
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
        console.log('Fetching Motorist.sg...');
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
        } else {
            console.error('SG fetch status:', sgRes.status);
        }

        // 2. Fetch MY
        console.log('Fetching Motorist.my...');
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
        } else {
             console.error('MY fetch status:', myRes.status);
        }

        // Save to cache even if partial failure so we don't spam on errors
        priceCache.data = results;
        priceCache.lastFetched = now;

        res.json(results);
    } catch (e) {
        console.error('Error in /api/fuel-prices:', e);
        // Serve cache if available, else error
        if (priceCache.data) {
            res.json(priceCache.data);
        } else {
            res.status(500).json({ error: 'Failed to fetch fuel prices' });
        }
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Backend proxy running closely on http://localhost:${PORT}`);
});
