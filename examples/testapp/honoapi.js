'use strict';

const { Hono } = require('hono');
const apirouter = new Hono();

// API for tests

apirouter.get('/success', (c) => c.text('OK', 200));

apirouter.get('/redirect', (c) => c.redirect('/v2/success', 302));

apirouter.get('/client_error', (c) => c.text('Not found', 404));

apirouter.get('/server_error', (c) => c.text('Server Error', 500));

apirouter.get('/tester/:code', testerImpl);
apirouter.post('/tester/:code', testerImpl);
apirouter.put('/tester/:code', testerImpl);
apirouter.delete('/tester/:code', testerImpl);

apirouter.get('/noswagger/:code', testerImpl);
apirouter.post('/noswagger/:code', testerImpl);
apirouter.put('/noswagger/:code', testerImpl);
apirouter.delete('/noswagger/:code', testerImpl);

apirouter.all('/mockapi', mockApiImpl);

apirouter.get('/paramstest/:code/and/:value', testerImpl);

async function testerImpl(c) {
    let code = 500;
    let message = "ERROR: Wrong parameters";

    const codeParam = c.req.param('code');
    if (codeParam) {
        code = parseInt(codeParam, 10);
        message = "Request Method:" + c.req.method + ', params.code: ' + codeParam;
    }

    const delay = parseInt(c.req.query('delay') || '0', 10);

    if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    return c.json({ code: code, message: message }, code);
}

async function mockApiImpl(c) {
    let code = 500;
    let message = "MOCK API RESPONSE";
    let delay = 0;
    let payloadsize = 0;

    const hdrSwsRes = c.req.header('x-sws-res');
    if (typeof hdrSwsRes !== 'undefined') {
        try {
            const swsRes = JSON.parse(hdrSwsRes);
            if ('code' in swsRes) code = swsRes.code;
            if ('message' in swsRes) message = swsRes.message;
            if ('delay' in swsRes) delay = swsRes.delay;
            if ('payloadsize' in swsRes) payloadsize = swsRes.payloadsize;
        } catch (err) { }
    }

    if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    if (payloadsize <= 0) {
        return c.text(message, code);
    } else {
        const dummyPayload = [];
        let adjSize = payloadsize - 4;
        if (adjSize <= 0) adjSize = 1;
        dummyPayload.push('a'.repeat(adjSize));
        return c.json(dummyPayload, code);
    }
}

module.exports = apirouter;
