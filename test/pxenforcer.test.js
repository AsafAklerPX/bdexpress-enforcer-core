'use strict';

const should = require('should');
const sinon = require('sinon');
const rewire = require('rewire');
const proxyquire = require('proxyquire');

const request = require('../lib/request');
const pxhttpc = require('../lib/pxhttpc');
const PxClient = rewire('../lib/pxclient');
const PxEnforcer = require('../lib/pxenforcer');
const { LoggerSeverity } = require('../lib/enums/LoggerSeverity');
const { ModuleMode } = require('../lib/enums/ModuleMode');

describe('PX Enforcer - pxenforcer.js', () => {
    let params, enforcer, req, stub, pxClient, pxLoggerSpy, logger;

    beforeEach(() => {
        params = {
            px_app_id: 'PX_APP_ID',
            px_cookie_secret: 'PX_COOKIE_SECRET',
            px_auth_token: 'PX_AUTH_TOKEN',
            px_blocking_score: 60,
            px_logger_severity: LoggerSeverity.DEBUG,
            px_ip_headers: ['x-px-true-ip'],
            px_max_activity_batch_size: 1,
            px_module_mode: ModuleMode.ACTIVE_BLOCKING,
        };

        req = {};
        req.headers = {};
        req.cookies = {};
        req.method = 'GET';
        req.originalUrl = '/';
        req.path = req.originalUrl.substring(req.originalUrl.lastIndexOf('/'));
        req.protocol = 'http';
        req.ip = '1.2.3.4';
        req.hostname = 'example.com';
        req.get = (key) => {
            return req.headers[key] || '';
        };

        pxLoggerSpy = {
            debug: sinon.spy(),
            error: sinon.spy(),
            init: () => {},
            '@global': true,
        };

        logger = function () {
            return pxLoggerSpy;
        };

        pxClient = new PxClient();
    });

    afterEach(() => {
        stub.restore();
    });

    it('enforces a call in a disabled module', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            return callback ? callback(null, data) : '';
        });
        params.px_module_enabled = false;
        const pxenforcer = proxyquire('../lib/pxenforcer', { './pxlogger': logger });
        enforcer = new pxenforcer(params, pxClient);
        enforcer.enforce(req, null, (response) => {
            pxLoggerSpy.debug.calledWith('Request will not be verified, module is disabled').should.equal(true);
            (response === undefined).should.equal(true);
            done();
        });
    });

    it('enforces a call in an enabled module', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            return callback ? callback(null, data) : '';
        });
        enforcer = new PxEnforcer(params, pxClient);
        enforcer.enforce(req, null, (response) => {
            (response === undefined).should.equal(true);
            done();
        });
    });

    it('uses first party to get client', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            return callback ? callback(null, data) : '';
        });
        const reqStub = sinon.stub(request, 'get').callsFake((data, config, callback) => {
            callback(null, { headers: { 'x-px-johnny': '1' }, body: 'hello buddy', proxy: '' });
        });
        req.originalUrl = '/_APP_ID/init.js';
        enforcer = new PxEnforcer(params, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            (response === undefined).should.equal(false);
            response.body.should.equal('hello buddy');
            response.headers['x-px-johnny'].should.equal('1');
            reqStub.restore();
            done();
        });
    });

    it('uses first party for xhr post request', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            return callback ? callback(null, data) : '';
        });
        const reqStub = sinon.stub(request, 'post').callsFake((data, config, callback) => {
            callback(null, { headers: { 'x-px-johnny': '1' }, body: 'hello buddy' });
        });
        req.originalUrl = '/_APP_ID/xhr/something';
        req.method = 'POST';
        req.body = 'test';
        enforcer = new PxEnforcer(params, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            (response === undefined).should.equal(false);
            response.body.should.equal('hello buddy');
            response.headers['x-px-johnny'].should.equal('1');
            reqStub.restore();
            done();
        });
    });

    it('uses first party for xhr get request', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            return callback ? callback(null, data) : '';
        });
        const reqStub = sinon.stub(request, 'get').callsFake((data, config, callback) => {
            callback(null, { headers: { 'x-px-johnny': '1' }, body: 'hello buddy' });
        });
        req.originalUrl = '/_APP_ID/xhr/something';
        req.method = 'GET';
        req.body = 'test';
        enforcer = new PxEnforcer(params, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            (response === undefined).should.equal(false);
            response.body.should.equal('hello buddy');
            response.headers['x-px-johnny'].should.equal('1');
            reqStub.restore();
            done();
        });
    });

    it('uses first party with pxvid cookie', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            return callback ? callback(null, data) : '';
        });
        const reqStub = sinon.stub(request, 'post').callsFake((data, config, callback) => {
            callback(null, { headers: { 'x-px-johnny': '1' }, body: 'hello buddy' });
        });
        req.originalUrl = '/_APP_ID/xhr/something';
        req.method = 'POST';
        req.cookies['_pxvid'] = 'abab-123';
        req.body = 'test';
        enforcer = new PxEnforcer(params, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            (response === undefined).should.equal(false);
            response.body.should.equal('hello buddy');
            response.headers['x-px-johnny'].should.equal('1');
            reqStub.restore();
            done();
        });
    });

    it('uses first party for xhr and passed trough bodyParser', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            return callback ? callback(null, data) : '';
        });
        const reqStub = sinon.stub(request, 'post').callsFake((data, config, callback) => {
            callback(null, { headers: { 'x-px-johnny': '1' }, body: 'hello buddy' });
        });
        req.originalUrl = '/_APP_ID/xhr/something';
        req.method = 'POST';
        req.body = { key: 'value', anotherKey: 'anotherValue' };
        enforcer = new PxEnforcer(params, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            (response === undefined).should.equal(false);
            response.body.should.equal('hello buddy');
            response.headers['x-px-johnny'].should.equal('1');
            reqStub.restore();
            done();
        });
    });

    it('should not use first party paths if originated from mobile', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            data.score = 100;
            data.action = 'b';
            return callback ? callback(null, data) : '';
        });
        const curParams = { ...params,
            px_module_mode: ModuleMode.ACTIVE_BLOCKING,
            px_first_party_enabled: true,
        };
        const reqStub = sinon.stub(request, 'post').callsFake((data, config, callback) => {
            callback(null, { headers: { 'x-px-johnny': '1' }, body: 'hello buddy' });
        });
        req.headers = { 'x-px-authorization': '3:some-fake-cookie' };
        req.method = 'POST';
        req.body = { key: 'value', anotherKey: 'anotherValue' };
        enforcer = new PxEnforcer(curParams, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            (response === undefined).should.equal(false);
            response.body.action.should.equal('block');
            reqStub.restore();
            done();
        });
    });

    it('should bypass monitor mode by header', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            data.score = 100;
            data.action = 'b';
            return callback ? callback(null, data) : '';
        });
        const curParams = { ...params,
            px_module_mode: ModuleMode.MONITOR,
            px_bypass_monitor_header: 'x-px-block',
        };
        req.headers = {
            'x-px-block': '1',
        };
        const reqStub = sinon.stub(req, 'post').callsFake((data, callback) => {
            callback(null, { body: 'hello buddy' });
        });
        req.method = 'POST';
        req.body = { key: 'value', anotherKey: 'anotherValue' };
        enforcer = new PxEnforcer(curParams, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            (response === undefined).should.equal(false);
            (response.body.indexOf('Please verify you are a human') > -1).should.equal(true);
            reqStub.restore();
            done();
        });
    });

    it('should ignore bypass monitor mode by header', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            data.score = 100;
            data.action = 'b';
            return callback ? callback(null, data) : '';
        });
        const curParams = { ...params,
            px_module_mode: ModuleMode.MONITOR,
            px_bypass_monitor_header: 'x-px-block',
        };
        req.headers = {
            'x-px-block': '0',
        };
        const reqStub = sinon.stub(req, 'post').callsFake((data, callback) => {
            callback(null, { body: 'hello buddy' });
        });
        req.method = 'POST';
        req.body = { key: 'value', anotherKey: 'anotherValue' };
        enforcer = new PxEnforcer(curParams, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            (response === undefined).should.equal(true);
            reqStub.restore();
            done();
        });
    });

    it('should ignore bypass monitor header as its not present', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            data.score = 100;
            data.action = 'b';
            return callback ? callback(null, data) : '';
        });
        const curParams = { ...params,
            px_module_mode: ModuleMode.MONITOR,
            px_bypass_monitor_header: 'x-px-block',
        };
        const reqStub = sinon.stub(req, 'post').callsFake((data, callback) => {
            callback(null, { body: 'hello buddy' });
        });
        req.method = 'POST';
        req.body = { key: 'value', anotherKey: 'anotherValue' };
        enforcer = new PxEnforcer(curParams, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            (response === undefined).should.equal(true);
            reqStub.restore();
            done();
        });
    });

    it('should ignore bypass monitor header as cookie is valid', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            data.score = 0;
            data.action = 'b';
            return callback ? callback(null, data) : '';
        });
        const curParams = { ...params,
            px_module_mode: ModuleMode.MONITOR,
            px_bypass_monitor_header: 'x-px-block',
        };
        req.headers = {
            'x-px-block': '1',
        };
        const reqStub = sinon.stub(req, 'post').callsFake((data, callback) => {
            callback(null, { body: 'hello buddy' });
        });
        req.method = 'POST';
        req.body = { key: 'value', anotherKey: 'anotherValue' };
        enforcer = new PxEnforcer(curParams, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            (response === undefined).should.equal(true);
            reqStub.restore();
            done();
        });
    });
    it('should not return json response when advancedBlockingResponse is false', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            data.score = 100;
            data.action = 'c';
            return callback ? callback(null, data) : '';
        });
        const curParams = { ...params,
            px_module_mode: ModuleMode.ACTIVE_BLOCKING,
            px_advanced_blocking_response_enabled: false,
        };
        const reqStub = sinon.stub(req, 'post').callsFake((data, callback) => {
            callback(null, { body: 'hello buddy' });
        });
        req.method = 'POST';
        req.body = { key: 'value', anotherKey: 'anotherValue' };
        req.headers = { 'content-type': 'application/json' };
        enforcer = new PxEnforcer(curParams, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            should.exist(response);
            should.equal(response.header.value, 'text/html');
            reqStub.restore();
            done();
        });
    });
    it('should return json response when advancedBlockingResponse is true (default)', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            data.score = 100;
            data.action = 'c';
            return callback ? callback(null, data) : '';
        });
        const curParams = { ...params,
            px_module_mode: ModuleMode.ACTIVE_BLOCKING
        };
        const reqStub = sinon.stub(req, 'post').callsFake((data, callback) => {
            callback(null, { body: 'hello buddy' });
        });
        req.method = 'POST';
        req.body = { key: 'value', anotherKey: 'anotherValue' };
        req.headers = { 'content-type': 'application/json' };
        enforcer = new PxEnforcer(curParams, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            should.exist(response);
            should.equal(response.header.value, 'application/json');
            reqStub.restore();
            done();
        });
    });

    it('should not monitor specific route when enforcer is disabled', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            return callback ? callback(null, data) : '';
        });

        params.px_monitored_routes = ['/profile'];
        params.px_module_enabled = false;

        req.originalUrl = '/profile';
        enforcer = new PxEnforcer(params, pxClient);
        enforcer.enforce(req, null, (response) => {
            (response === undefined).should.equal(true);
            done();
        });
    });

    it('should not monitor specific route regex when enforcer is disabled', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            return callback ? callback(null, data) : '';
        });

        params.px_monitored_routes = [new RegExp(/\/profile/)];
        params.px_module_enabled = false;

        req.originalUrl = '/profile';
        enforcer = new PxEnforcer(params, pxClient);
        enforcer.enforce(req, null, (response) => {
            (response === undefined).should.equal(true);
            done();
        });
    });

    it('should whitelist specific routes in blocking mode', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            data.score = 100;
            data.action = 'c';
            return callback ? callback(null, data) : '';
        });

        const curParams = { ...params,
            px_module_mode: ModuleMode.ACTIVE_BLOCKING,
            px_filter_by_route: ['/profile'],
        };

        req.originalUrl = '/profile';
        const pxenforcer = proxyquire('../lib/pxenforcer', { './pxlogger': logger });
        enforcer = new pxenforcer(curParams, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            should(error).not.be.ok();
            pxLoggerSpy.debug.calledWith('Found whitelist route /profile').should.equal(true);
            (response === undefined).should.equal(true);
            done();
        });
    });

    it('should whitelist specific routes regex in blocking mode', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            data.score = 100;
            data.action = 'c';
            return callback ? callback(null, data) : '';
        });

        const curParams = { ...params,
            px_module_mode: ModuleMode.ACTIVE_BLOCKING,
            px_filter_by_route: [/\/profile/],
        };

        req.originalUrl = '/profile';
        const pxenforcer = proxyquire('../lib/pxenforcer', { './pxlogger': logger });
        enforcer = new pxenforcer(curParams, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            should(error).not.be.ok();
            pxLoggerSpy.debug.calledWith('Found whitelist route by Regex /profile').should.equal(true);
            (response === undefined).should.equal(true);
            done();
        });
    });

    it('should monitor specific routes in blocking mode', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            data.score = 100;
            data.action = 'c';
            return callback ? callback(null, data) : '';
        });

        const curParams = { ...params,
            px_module_mode: ModuleMode.ACTIVE_BLOCKING,
            px_monitored_routes: ['/profile'],
        };

        req.originalUrl = '/profile';
        const pxenforcer = proxyquire('../lib/pxenforcer', { './pxlogger': logger });
        enforcer = new pxenforcer(curParams, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            should(error).not.be.ok();
            (response === undefined).should.equal(true);
            done();
        });
    });

    it('should monitor specific routes regex in blocking mode', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            data.score = 100;
            data.action = 'c';
            return callback ? callback(null, data) : '';
        });

        const curParams = { ...params,
            px_module_mode: ModuleMode.ACTIVE_BLOCKING,
            px_monitored_routes: [/\/profile/],
        };

        req.originalUrl = '/profile';
        const pxenforcer = proxyquire('../lib/pxenforcer', { './pxlogger': logger });
        enforcer = new pxenforcer(curParams, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            should(error).not.be.ok();
            (response === undefined).should.equal(true);
            done();
        });
    });

    it('should enforce routes in blocking mode that are not specified in px_monitored_routes', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            data.score = 100;
            data.action = 'c';
            return callback ? callback(null, data) : '';
        });

        const curParams = { ...params,
            px_module_mode: ModuleMode.ACTIVE_BLOCKING,
            px_monitored_routes: ['/profile'],
        };

        req.originalUrl = '/admin';
        const pxenforcer = proxyquire('../lib/pxenforcer', { './pxlogger': logger });
        enforcer = new pxenforcer(curParams, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            should(error).not.be.ok();
            (response === undefined).should.equal(false);
            done();
        });
    });

    it('should enforce routes in blocking mode that are not specified in px_monitored_routes regex', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            data.score = 100;
            data.action = 'c';
            return callback ? callback(null, data) : '';
        });

        const curParams = { ...params,
            px_module_mode: ModuleMode.ACTIVE_BLOCKING,
            px_monitored_routes: [/\/profile/],
        };

        req.originalUrl = '/admin';
        const pxenforcer = proxyquire('../lib/pxenforcer', { './pxlogger': logger });
        enforcer = new pxenforcer(curParams, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            should(error).not.be.ok();
            (response === undefined).should.equal(false);
            done();
        });
    });

    it('should monitor specific routes with enforced specific routes not in monitor', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            data.score = 100;
            data.action = 'c';
            return callback ? callback(null, data) : '';
        });

        const curParams = { ...params,
            px_module_mode: ModuleMode.ACTIVE_BLOCKING,
            px_enforced_routes: ['/profile', '/login'],
            px_monitored_routes: ['/'],
        };

        req.originalUrl = '/';
        const pxenforcer = proxyquire('../lib/pxenforcer', { './pxlogger': logger });
        enforcer = new pxenforcer(curParams, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            should(error).not.be.ok();
            (response === undefined).should.equal(true);
            done();
        });
    });

    it('should monitor specific routes regex with enforced specific routes regex not in monitor', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            data.score = 100;
            data.action = 'c';
            return callback ? callback(null, data) : '';
        });

        const curParams = { ...params,
            px_module_mode: 1,
            px_enforced_routes: [/\/profile/, /\/login/],
            px_monitored_routes: [new RegExp(/^\/$/)],
        };

        req.originalUrl = '/';
        const pxenforcer = proxyquire('../lib/pxenforcer', { './pxlogger': logger });
        enforcer = new pxenforcer(curParams, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            should(error).not.be.ok();
            (response === undefined).should.equal(true);
            done();
        });
    });

    it('should enforce specific routes with enforced specific routes not in monitor', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            data.score = 100;
            data.action = 'c';
            return callback ? callback(null, data) : '';
        });

        const curParams = { ...params,
            px_module_mode: 1,
            px_enforced_routes: ['/profile', '/login'],
            px_monitored_routes: ['/'],
        };

        req.originalUrl = '/login';
        const pxenforcer = proxyquire('../lib/pxenforcer', { './pxlogger': logger });
        enforcer = new pxenforcer(curParams, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            should(error).not.be.ok();
            (response === undefined).should.equal(false);
            done();
        });
    });

    it('should enforce specific routes regex with enforced specific routes regex not in monitor', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            data.score = 100;
            data.action = 'c';
            return callback ? callback(null, data) : '';
        });

        const curParams = { ...params,
            px_module_mode: 1,
            px_enforced_routes: [/\/profile/, /\/login/],
            px_monitored_routes: [new RegExp(/^\/$/)],
        };

        req.originalUrl = '/login';
        const pxenforcer = proxyquire('../lib/pxenforcer', { './pxlogger': logger });
        enforcer = new pxenforcer(curParams, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            should(error).not.be.ok();
            (response === undefined).should.equal(false);
            done();
        });
    });

    it('should not enforce a route not specified in enforced specific routes', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            data.score = 100;
            data.action = 'c';
            return callback ? callback(null, data) : '';
        });

        const curParams = { ...params,
            px_module_mode: 1,
            px_enforced_routes: ['/profile', '/login'],
        };


        req.originalUrl = '/';
        const pxenforcer = proxyquire('../lib/pxenforcer', { './pxlogger': logger });
        enforcer = new pxenforcer(curParams, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            should(error).not.be.ok();
            (response === undefined).should.equal(true);
            done();
        });
    });

    it('should not enforce a route not specified in enforced specific routes regex', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            data.score = 100;
            data.action = 'c';
            return callback ? callback(null, data) : '';
        });

        const curParams = { ...params,
            px_module_mode: 1,
            px_enforced_routes: [[/\/profile/, /\/login/]],
        };

        req.originalUrl = '/';
        const pxenforcer = proxyquire('../lib/pxenforcer', { './pxlogger': logger });
        enforcer = new pxenforcer(curParams, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            should(error).not.be.ok();
            (response === undefined).should.equal(true);
            done();
        });
    });

    it('Should skip verification because user agent is whitelisted', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            return callback ? callback(null, data) : '';
        });

        const curParams = { ...params,
            px_filter_by_user_agent: ['testme/v1.0'],
        };

        req.headers = { 'user-agent': 'TestME/v1.0' };
        const pxenforcer = proxyquire('../lib/pxenforcer', { './pxlogger': logger });
        enforcer = new pxenforcer(curParams, pxClient);
        enforcer.enforce(req, null, (response) => {
            pxLoggerSpy.debug
                .calledWith('Skipping verification for filtered user agent TestME/v1.0')
                .should.equal(true);
            (response === undefined).should.equal(true);
            done();
        });
    });

    it('Should skip verification because user agent regex is whitelisted', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            return callback ? callback(null, data) : '';
        });

        const curParams = { ...params,
            px_filter_by_user_agent: [/test/i],
        };

        req.headers = { 'user-agent': 'TestME/v1.0' };
        const pxenforcer = proxyquire('../lib/pxenforcer', { './pxlogger': logger });
        enforcer = new pxenforcer(curParams, pxClient);
        enforcer.enforce(req, null, (response) => {
            pxLoggerSpy.debug
                .calledWith('Skipping verification for filtered user agent TestME/v1.0')
                .should.equal(true);
            (response === undefined).should.equal(true);
            done();
        });
    });

    it('Should skip verification because ip is whitelisted', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            return callback ? callback(null, data) : '';
        });

        const curParams = { ...params,
            px_filter_by_ip: ['1.2.0.0/16'],
        };

        const pxenforcer = proxyquire('../lib/pxenforcer', { './pxlogger': logger });
        enforcer = new pxenforcer(curParams, pxClient);
        enforcer.enforce(req, null, (response) => {
            pxLoggerSpy.debug.calledWith('Skipping verification for filtered ip address 1.2.3.4').should.equal(true);
            (response === undefined).should.equal(true);
            done();
        });
    });

    it('Should skip verification because method is whitelisted', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            return callback ? callback(null, data) : '';
        });

        const curParams = { ...params,
            px_filter_by_http_method: ['get'],
        };

        const pxenforcer = proxyquire('../lib/pxenforcer', { './pxlogger': logger });
        enforcer = new pxenforcer(curParams, pxClient);
        enforcer.enforce(req, null, (response) => {
            pxLoggerSpy.debug.calledWith('Skipping verification for filtered method GET').should.equal(true);
            (response === undefined).should.equal(true);
            done();
        });
    });
});
