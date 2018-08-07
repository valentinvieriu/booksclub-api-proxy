// const fs        = require('fs');
const http         = require('http');
const https        = require('https');
const querystring  = require('querystring');
const parser       = require('libxml-to-js');
const url          = require('url');
const _            = require('lodash');
const postgrestUrl = process.env.POSTGREST || 'http://postgrest:3000';
// https.globalAgent.options.secureProtocol = 'TLSv1_method';

const wrapWithPromise = wrappedFunction => (...args) => (
  new Promise((resolve, reject) => {
    wrappedFunction(...args, (err, result) => {
      return err ? reject(err) : resolve(result);
    });
  })
);

const prepareBooks = async (result, section) => {
  let books  = {
    new: [],
    update: [],
    all: {}
  };

  let resultset = result.resultset;
  let items     = _.get(result,'items.item');
  let availableBooksIds = [];

  //we check if it's object
  if ( (!!items) && (items.constructor === Object) ) {
    items = [items]
  }

  items.forEach((item,index) => {
    let book = {};
    book.id = item.identifiers.isbn13;
    // We don't store yet the data maybe for the future
    // book.data = item;
    if (section === 'bestsellers') {
      book.bestseller_order = (resultset.currentPage - 1 ) * resultset.results + index;
    }
    books.all[book.id]= book;
    availableBooksIds.push(book.id );
  });
  const availableBooks = await request(`${postgrestUrl}/book?select=id&id=in.${availableBooksIds.join(',')}`).then(books => JSON.parse(books).map(book => book.id));
  // console.log(`${postgrestUrl}/book?select=id.${availableBooksIds.join(',')}\n`,availableBooks);
  for ( const key of Object.keys( books.all) ) {
    if (availableBooks.indexOf(key) === -1) {
      books.new.push(books.all[key]);
    } else {
      // we do not update the books yet, we just add the new ones
      if(books.all[key].bestseller_order) {
        books.update.push(books.all[key]);
      }
    }
  }
  return books;
}

const request = function request(reqUrl,options = {}) {
  // parse url to chunks
  reqUrl = url.parse(reqUrl);
  // http.request settings
  let settings = {
    protocol: reqUrl.protocol,
    host:     reqUrl.hostname,
    path:     reqUrl.path,
    port:     reqUrl.port ? reqUrl.port : (reqUrl.protocol === 'https:' ? 443 : 80),
    headers:  {
      // 'Accept-Encoding': 'gzip'
    },
    method:   'GET'
  };
  settings = Object.assign(settings,options);

  // if there are params:
  if (options.params) {
    options.params = JSON.stringify(options.params);
    settings.headers['Content-Type'] = 'application/json';
    //settings.headers['Content-Length'] = options.params.length;
  };
  // return new pending promise
  return new Promise((resolve, reject) => {
    // select http or https module, depending on reqested url
    const libHttp = settings.protocol === 'https:' ? https: http;
    const zlib    = require('zlib');
    const gunzip  = zlib.createGunzip({
        flush: zlib.Z_SYNC_FLUSH,
        finishFlush: zlib.Z_SYNC_FLUSH
    });
    const httpRequest = libHttp.request(settings);

    httpRequest.on('response', response => {
      // handle http errors
      if (response.statusCode < 200 || response.statusCode > 299) {
          reject(new Error('Failed to load page, status code: ' + response.statusCode));
          // consume response data to free up memory
          response.resume();
          return;
       }
      // temporary data holder
      const body = [];
      // This is when gzip is disabled
      response.on('data', (chunk) => body.push(chunk));
      response.on('end', () => resolve(body.join('')));

      //  this is when gzip is eanbled
      // response.pipe(gunzip);
      // // on every content chunk, push it to the data array
      // gunzip.on('data', (chunk) => body.push(chunk));
      // // we are done, resolve promise with those joined chunks
      // gunzip.on('finish', () => resolve(body.join('')));
      // gunzip.on('error', error => console.error(`ERROR=[gunzip]${error.message}`));
    });

    // handle connection errors of the request
    httpRequest.on('error', err => reject(err))

    // if there are params: write them to the request
    if (options.params){ 
      httpRequest.write(options.params) 
    };
    //we need to call end
    httpRequest.end();
  })
};
const jsonParse = async (apiUrl) => {
    apiUrl = querystring.unescape(apiUrl)
    console.log('URL=' + apiUrl);
    console.time('API_REQUEST=');
    const XMLbody = await request(apiUrl);
    console.timeEnd('API_REQUEST=');
    console.time('XML_CONVERT=');
    const json = await xmlParse(XMLbody);
    console.timeEnd('XML_CONVERT=');
    return json;
}

const saveBooks = async (booksData, section) => {
  const haveItems = _.get(booksData,'items.item');
  if (!haveItems) return false;

  try {
    var books = await prepareBooks(booksData, section);
  } catch (error) {
    console.error(`ERROR=[prepareBooks]${error.message}`);
    return;
  }
    //for new books - this can be improved if we send csv to the server
    if (books.new.length) {
      request(`${postgrestUrl}/book`,{
          method: 'POST',
          params: books.new
        }).catch(error => console.error(`ERROR=[newBooks]${error.message}`));
    }
    if (books.update.length) {
      let runUpdates = [];
      books.update.forEach(book => {
        runUpdates.push(
          request(`${postgrestUrl}/book?id=eq.${book.id}`,{
            method: 'PATCH',
            params: book
          })
        );
      });
      Promise.all(runUpdates).catch(error => console.error(`ERROR=[runUpdates]${error.message}`));
    }
}

const saveDescription = async (booksData, isbn, isExisting) => {
    const method = isExisting ? 'PATCH' : 'POST';
    console.time(`SAVING_DESCRIPTION=${isbn} TIME=`);
    return request(`${postgrestUrl}/book?id=eq.${isbn}`,{
        method: method,
        params: Object.assign({id: isbn}, booksData)
      })
      .then(response => {
        console.timeEnd(`SAVING_DESCRIPTION=${isbn} TIME=`);
        return response;
      })
      .catch((error) => console.error(`ERROR=[saveDescription] ${error.message}`));
}
// const readFilePromise = wrapWithPromise(fs.readFile);
// const writeFilePromise = wrapWithPromise(fs.writeFile);
const xmlParse = wrapWithPromise(parser);
module.exports = {
    wrapWithPromise,
    jsonParse,
    request,
    saveBooks,
    saveDescription
}