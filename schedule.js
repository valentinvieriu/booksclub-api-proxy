const request         = require('./src/lib').request;
const _               = require('lodash');
const kue             = require('kue');
const postgrestUrl    = process.env.POSTGREST || 'http://postgrest:3000';

const nameSpace = 'getDescription';

var queue  = kue.createQueue({
	jobEvents: false,
	redis: process.env.REDIS_URL
    });

function pushJob(isbn){
    const job = queue.create(nameSpace, {
        isbn,
        title:isbn,
    });
    job.removeOnComplete( true )
        .ttl(15000)
        .priority('high')
        .attempts(3)
            .backoff( {delay: 30*1000, type:'fixed'} )
        .save( function(err){
            if( !err ) console.log( `QUE_JOB=true JOB_ID=${job.id} ISBN=${isbn}` );
        });
}

function addItems(){
    return request(`${postgrestUrl}/book?select=id&long_description=is.null&limit=88`)
        .then(result => {
            var urlList = JSON.parse(result)
            console.log(urlList);
            urlList.forEach((book => pushJob(book.id)));
            return result;
        })
        .catch(error => console.error(`ERROR=[addItems]${error.message}`));
}
function cleanItems() {
    queue.failedCount( nameSpace, function( err, total ) {
    if( total > 0 ) {
        kue.Job.rangeByState( 'failed', 0, total, 'asc', function( err, jobs ) {
        jobs.forEach( async function( job ) {
            job.remove( function(){
                console.log( '\n Removed failed job ', job.id );
            });
        });
        });
    }
    });
}
cleanItems();
addItems();
queue.watchStuckJobs(1000);
// Adding new tasks if necesary
setInterval(() => {
    //we clean up the failed tasks every 5 min
    const cardByType = (...args) => new Promise((resolve, reject) => {
        queue.cardByType(...args, ( err, total ) => {
            return err ? reject(err) : resolve(total);
        })
    });

    Promise.all([cardByType( nameSpace, 'inactive' ), cardByType( nameSpace, 'active' )]).then( ([inactiveTotal, activeTotal]) => {
        if ( inactiveTotal == 0 && activeTotal == 0 ) {addItems();}

    }).catch(error => console.error(`ERROR=[queCheck]${error.message}`));

}, 1*1000);

// Cleaning up the failed jobs
setInterval(() => {
    //we clean up the failed tasks every 5 min
    cleanItems();
}, 60*60*1000);