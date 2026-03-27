const cheerio = require('cheerio');

async function testSG() {
    const r = await fetch('https://www.motorist.sg/petrol-prices');
    const html = await r.text();
    const $ = cheerio.load(html);
    console.log('--- SG ---')
    $('tr').each((i, el) => {
        console.log($(el).text().replace(/\s+/g, ' ').trim());
    });
}

async function testMY() {
    const r = await fetch('https://www.motorist.my/petrol-prices');
    const html = await r.text();
    const $ = cheerio.load(html);
    console.log('--- MY ---')
    $('tr').each((i, el) => {
        console.log($(el).text().replace(/\s+/g, ' ').trim());
    });
}

testSG().then(testMY);
