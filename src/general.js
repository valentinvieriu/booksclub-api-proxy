const general = async (ctx, next) => {
    if (ctx.url.startsWith('/favicon') ) {
        ctx.set('Cache-Control', 'public, max-age=' + 365 * 24 * 60 * 60);
        ctx.throw(404);
        return;
    }
    if (ctx.url.startsWith('/healthcheck') ) {
        ctx.type = 'application/json';
        ctx.set('Cache-Control', 'private, max-age=' + 0);
        ctx.body = JSON.stringify({ok:true});
        return;
    }

    await next();
}
module.exports = general;