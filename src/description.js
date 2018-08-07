const request         = require('./lib').request;
const saveDescription = require('./lib').saveDescription;
const postgrestUrl    = process.env.POSTGREST || 'http://postgrest:3000';
const _               = require('lodash');
const kue             = require('kue');

console.info('POSTGREST_URL=',postgrestUrl);

async function getCached(bookIsbn) {

    console.time(`CACHE_CHECK_DESCRIPTION=${bookIsbn} TIME=`);
    const data           = await request(`${postgrestUrl}/book?select=long_description,meta_description,entity_description&id=eq.${bookIsbn}`);
    console.timeEnd(`CACHE_CHECK_DESCRIPTION=${bookIsbn} TIME=`);

    const jsonData = JSON.parse(data);
    const [descriptions] = jsonData;

    if ( descriptions === undefined || !descriptions.meta_description) {
        return {
            inDatabase:   jsonData.length,
            descriptions: null
        }
    }
    return {
        inDatabase: jsonData.length,
        descriptions
    };
}

async function makeRequest(requestedUrl, bookIsbn) {
    const apiUrl = `https://www.bookdepository.com${requestedUrl}`;

    console.time(`SCRAPE_DESCRIPTION=${bookIsbn} TIME=`);
    const html = await request(apiUrl);
    console.timeEnd(`SCRAPE_DESCRIPTION=${bookIsbn} TIME=`);
    const regexLongDescription = /<div class="item-excerpt trunc" itemprop="description" data-height="230">((?:.|\r?\n)*?)<a class='read-more'>/g;
    // const regexMetaDescription = /<meta name="description" content="((?:.|\r?\n)*?)" \/>/g
    let longDescription = regexLongDescription.exec(html);
    // let metaDescription = regexMetaDescription.exec(html);

    longDescription = _(longDescription).get('[1]','').trim();
    // metaDescription = _(metaDescription).get('[1]','').trim();
    

    if (!longDescription || longDescription === '') {
        console.warn(`EMPTY_SCRAPE_DESCRIPTION=${bookIsbn}`);
    }
    return {
        long_description: longDescription
    };
};

async function getDescrption(url, bookIsbn) {
    const cached = await getCached(bookIsbn).catch(error => null);

    if (cached.descriptions) {
        return cached.descriptions;
    }

    const freshData = await makeRequest(url, bookIsbn);

    saveDescription(freshData, bookIsbn, cached && cached.inDatabase);

    return freshData;
}

function extractIsbn(url) {
    const regex = /\/description\/.*\/(.*)/g;
    let bookIsbn = regex.exec(url);
    return bookIsbn && bookIsbn[1];
}

async function middleware(ctx, next) {
    if (!ctx.url.startsWith('/description/')) {
        return next();
    }
    const bookIsbn = extractIsbn(ctx.url);
    const requestedUrl = ctx.url.replace('/description', '');
    if (!bookIsbn) {
        return next();
    }

    return await getDescrption(requestedUrl, bookIsbn)
        .then((json) => {
            ctx.type = 'application/json';
            ctx.set('Cache-Control', 'public, max-age=' + 3 * 24 * 60 * 60);
            ctx.body = JSON.stringify(json);
        })
        .catch((error) => {
            console.error(`ERROR=[descriptionMiddleware] ${error.message}`);
            ctx.throw(500, error.message);
        });
}

function queSubscribe(queue) {
    console.log('Subscribed to kue');
    queue.process('getDescription', 1, async (job, done) => {
        const url          = `/The-Hitchhiker-s-Guide-to-the-Galaxy-${job.data.isbn}/${job.data.isbn}`;
        const bookIsbn     = job.data.isbn;

        getDescrption(url, bookIsbn)
        .then((json) => {
            _.delay(done,_.random(500,3000));
        })
        .catch((error) => {
            console.error(`ERROR=[getDescrptionQue] ${error.message} url:${url}`);
            _.delay(() => done(error),_.random(500,3000));
        });
    });
}

module.exports = {
    middleware,
    queSubscribe
};