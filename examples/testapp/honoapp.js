var http = require('http');
var path = require('path');
var debug = require('debug')('sws:testapp');
var swaggerParser = require('swagger-parser');
var swStats = require('../../lib');

var { Hono } = require('hono');
var { serve } = require('@hono/node-server');

var API = require('./honoapi');

var app = new Hono();

// all environments
var port = process.env.PORT || 3041;

app.get('/', (c) => {
    return c.redirect('/swagger-stats/');
});

const swaggerSpec = require('./petstore.json');

app.get('/apidoc.json', (c) => {
    return c.json(swaggerSpec);
});

var tlBucket = 60000;
if (process.env.SWS_TEST_TIMEBUCKET) {
    tlBucket = parseInt(process.env.SWS_TEST_TIMEBUCKET);
}

const parser = new swaggerParser();
let server = null;

parser.validate(swaggerSpec, function (err, api) {
    if (!err) {
        debug('Success validating swagger file!');

        const swsMiddleware = swStats.getMiddleware({
            name: 'swagger-stats-testapp',
            version: '0.99.7',
            timelineBucketDuration: tlBucket,
            uriPath: '/swagger-stats',
            swaggerSpec: swaggerSpec,
            elasticsearch: 'http://127.0.0.1:9200',
        });

        // Use custom wrapper for Hono
        app.use('*', async (c, next) => {
            const req = c.env.incoming;
            const res = c.env.outgoing;

            req.query = Object.assign({}, c.req.query());

            const ended = await new Promise((resolve) => {
                const originalEnd = res.end;

                res.redirect = function (url) {
                    res.statusCode = 302;
                    res.setHeader('Location', url);
                    res.end('Redirecting to ' + url);
                };

                res.end = function (...args) {
                    resolve(true);
                    return originalEnd.apply(this, args);
                };

                try {
                    swsMiddleware(req, res, () => {
                        resolve(false);
                    });
                } catch (e) {
                    resolve(false);
                }
            });

            if (ended) {
                return new Response(null, {
                    headers: { 'x-hono-already-sent': 'true' }
                });
            }

            await next();
        });

        app.get('/stats', (c) => {
            return c.json(swStats.getCoreStats());
        });

        app.route('/v2', API);

        server = serve({
            fetch: app.fetch,
            port: port
        });

        debug(`Server started on port ${port} http://localhost:${port}`);
    }
});

module.exports.app = {
    get: (key) => {
        if (key === 'port') return port;
    }
};
module.exports.server = server;
