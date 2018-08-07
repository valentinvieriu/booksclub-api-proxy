'use strict';
// Setup server
const koa         = require('koa') ;
const api         = require('./src/api') ;
const description = require('./src/description') ;
const general     = require('./src/general') ;
const request     = require('./src/lib').request;
const kue         = require('kue');

const isProd  = process.env.NODE_ENV === 'production' ? true: false;
const useCluster  = process.env.USE_CLUSTER === 'true' ? true: false;

const cluster = require('cluster');
const os      = require('os');

function pingYourself() {
    console.info('PING=stay alive');
    return request(`http://${process.env.SELF}.herokuapp.com/healthcheck`).catch(error => null);
}

if ( process.env.IS_WORKER === 'true' ) {
    var queue         = kue.createQueue({
        jobEvents: false,
        redis: process.env.REDIS_URL
    });
}

if (isProd && useCluster && cluster.isMaster) {
    var numCPUs = os.cpus().length;
    var timeouts = [];

    for (var i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        console.error(['The worker #' + worker.id + ' has exited with exitCode ' + worker.process.exitCode]);
        clearTimeout(timeouts[worker.id]);
        // Don't try to restart the workers when disconnect or destroy has been called
        if (worker.suicide !== true) {
            console.log('Worker #' + worker.id + ' did not commit suicide, restarting');
            cluster.fork();
        }
    });
    cluster.on('disconnect', worker => console.log('The worker #' + worker.id + ' has disconnected'));
    
    if (!!process.env.SELF) {
        setInterval(pingYourself,60*1000);
    }
}
else {
    const app = new koa()
    .use(general)
    .use(api)
    .use(description.middleware)
    .use(async (ctx, next) => {
        ctx.body = 'Hello World! Not much to see here ...';
    })
    .listen(process.env.PORT || 3000, () => console.log('Http server listening on %d', process.env.PORT || 3000) );
    // We spawn the workser for the que
    if ( process.env.IS_WORKER === 'true' ) {
        description.queSubscribe(queue);
    }
    if (!useCluster && !!process.env.SELF) {
        setInterval(pingYourself,60*1000);
    }

}