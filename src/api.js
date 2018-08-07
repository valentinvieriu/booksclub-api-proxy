const jsonParse   = require('./lib').jsonParse;
const saveBooks   = require('./lib').saveBooks;
const querystring = require('querystring');
// we might need to force the english language in the future langIds:           123,
const apiUrl = {
      base : 'https://api.bookdepository.com',
      queryparam : {
          currencies:        'AUD,EUR,USD,GBP,NZD,SGD,HKD,CAD,CZK,ILS,JPY,NOK,PLN,SEK,CHF,THB,DKK,HUF,TWD,ZAR,MXN,ARS,CLP,MYR,KRW,IDR',
          hasJacket:         '1',
          sortBy:            'popular',
          countryCode:       'US',
          langIds:           123,
          clientId:          '0e28adb3',
          availability:      '1',
          responseGroup:     'light',
          format:            '1,2,4',
          authenticationKey: process.env.API_KEY,
          images:            'large,medium,small'
      }
  };
function createUrl(path, input) {
    let queryparam = Object.assign({}, input, apiUrl.queryparam);
    if (input.responseGroup) {
        queryparam.responseGroup = input.responseGroup;
    }
    let url = apiUrl.base + path + '?' + querystring.stringify(queryparam).replace(/(%20|\.)/g,'+')
    return url;
}
const api = async (ctx, next) => {
    const regex = /\/api\/search\/(books|bestsellers|commingsoon|lookup)\/|\/api\/(countries|categories|languages)/g;
    let section = regex.exec(ctx.url);
    section = section && (section[2] || section[1]);
    if (!section) {
        await next();
        return;
    }

    try {
        const requestedPath = ctx.path.replace('/api','');
        const apiUrl = createUrl(requestedPath, ctx.query);
        // createUrl(ctx.query);
        const json = await jsonParse(apiUrl);
        ctx.type = 'application/json';
        ctx.set('Cache-Control', 'public, max-age=' + 3 * 24 * 60 * 60);
        ctx.body = JSON.stringify(json);
        
        if (['countries', 'categories', 'languages'].indexOf(section) === -1) {
            saveBooks(json, section);
        }

        
    } catch (error) {
        console.error(`ERROR=${error.message}`);
        ctx.throw(500,error.message);
    }
}
module.exports = api;
