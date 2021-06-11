'use strict';
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
var events = require('events');
var net = require('net');
var Promise = require('bluebird');
var Duplex = require('stream').Duplex;
var utils = require('./utils');
var Telnet = /** @class */ (function (_super) {
    __extends(Telnet, _super);
    function Telnet() {
        var _this = _super.call(this) || this;
        _this.socket = null;
        _this.state = null;
        return _this;
    }
    Telnet.prototype.connect = function (opts) {
        var _this = this;
        var promise;
        return promise = new Promise(function (resolve, reject) {
            var host = (typeof opts.host !== 'undefined' ? opts.host : '127.0.0.1');
            var port = (typeof opts.port !== 'undefined' ? opts.port : 23);
            var localAddress = (typeof opts.localAddress !== 'undefined' ? opts.localAddress : '');
            var socketConnectOptions = (typeof opts.socketConnectOptions !== 'undefined' ? opts.socketConnectOptions : {});
            _this.timeout = (typeof opts.timeout !== 'undefined' ? opts.timeout : 500);
            // Set prompt regex defaults
            _this.shellPrompt = (typeof opts.shellPrompt !== 'undefined' ? opts.shellPrompt : /(?:\/ )?#\s/);
            _this.loginPrompt = (typeof opts.loginPrompt !== 'undefined' ? opts.loginPrompt : /login[: ]*$/i);
            _this.passwordPrompt = (typeof opts.passwordPrompt !== 'undefined' ? opts.passwordPrompt : /Password[: ]*$/i);
            _this.failedLoginMatch = opts.failedLoginMatch;
            _this.loginPromptReceived = false;
            _this.extSock = (typeof opts.sock !== 'undefined' ? opts.sock : undefined);
            _this.debug = (typeof opts.debug !== 'undefined' ? opts.debug : false);
            _this.username = (typeof opts.username !== 'undefined' ? opts.username : 'root');
            _this.password = (typeof opts.password !== 'undefined' ? opts.password : 'guest');
            _this.irs = (typeof opts.irs !== 'undefined' ? opts.irs : '\r\n');
            _this.ors = (typeof opts.ors !== 'undefined' ? opts.ors : '\n');
            _this.echoLines = (typeof opts.echoLines !== 'undefined' ? opts.echoLines : 1);
            _this.stripShellPrompt = (typeof opts.stripShellPrompt !== 'undefined' ? opts.stripShellPrompt : true);
            _this.pageSeparator = (typeof opts.pageSeparator !== 'undefined'
                ? opts.pageSeparator : '---- More');
            _this.negotiationMandatory = (typeof opts.negotiationMandatory !== 'undefined'
                ? opts.negotiationMandatory : true);
            _this.initialLFCR = (typeof opts.initialLFCR !== 'undefined' ? opts.initialLFCR : false);
            _this.initialCTRLC = (typeof opts.initialCTRLC !== 'undefined' ? opts.initialCTRLC : false);
            _this.execTimeout = (typeof opts.execTimeout !== 'undefined' ? opts.execTimeout : 2000);
            _this.sendTimeout = (typeof opts.sendTimeout !== 'undefined' ? opts.sendTimeout : 2000);
            _this.maxBufferLength = (typeof opts.maxBufferLength !== 'undefined' ? opts.maxBufferLength : 1048576);
            /* if socket is provided and in good state, just reuse it */
            if (_this.extSock) {
                if (!_this._checkSocket(_this.extSock))
                    return reject(new Error('socket invalid'));
                _this.socket = _this.extSock;
                _this.state = 'ready';
                _this.emit('ready');
                resolve(_this.shellPrompt);
            }
            else {
                _this.socket = net.createConnection(__assign({ port: port,
                    host: host,
                    localAddress: localAddress }, socketConnectOptions), function () {
                    _this.state = 'start';
                    _this.emit('connect');
                    if (_this.initialCTRLC === true)
                        _this.socket.write(Buffer.from('03', 'hex'));
                    if (_this.initialLFCR === true)
                        _this.socket.write('\r\n');
                    if (_this.negotiationMandatory === false)
                        resolve();
                });
            }
            _this.inputBuffer = '';
            _this.socket.setTimeout(_this.timeout, function () {
                if (promise.isPending()) {
                    /* if cannot connect, emit error and destroy */
                    if (_this.listeners('error').length > 0)
                        _this.emit('error', 'Cannot connect');
                    _this.socket.destroy();
                    return reject(new Error('Cannot connect'));
                }
                _this.emit('timeout');
                return reject(new Error('timeout'));
            });
            _this.socket.on('data', function (data) {
                if (_this.state === 'standby')
                    return _this.emit('data', data);
                _this._parseData(data, function (event, parsed) {
                    if (promise.isPending() && event === 'ready') {
                        resolve(parsed);
                    }
                });
            });
            _this.socket.on('error', function (error) {
                if (_this.listeners('error').length > 0)
                    _this.emit('error', error);
                if (promise.isPending())
                    reject(error);
            });
            _this.socket.on('end', function () {
                _this.emit('end');
                if (promise.isPending())
                    reject(new Error('Socket ends'));
            });
            _this.socket.on('close', function () {
                _this.emit('close');
                if (promise.isPending())
                    reject(new Error('Socket closes'));
            });
        });
    };
    Telnet.prototype.shell = function (callback) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            resolve(new Stream(_this.socket));
        }).asCallback(callback);
    };
    Telnet.prototype.exec = function (cmd, opts, callback) {
        var _this = this;
        if (opts && opts instanceof Function)
            callback = opts;
        return new Promise(function (resolve, reject) {
            if (opts && opts instanceof Object) {
                _this.shellPrompt = opts.shellPrompt || _this.shellPrompt;
                _this.loginPrompt = opts.loginPrompt || _this.loginPrompt;
                _this.failedLoginMatch = opts.failedLoginMatch || _this.failedLoginMatch;
                _this.timeout = opts.timeout || _this.timeout;
                _this.execTimeout = opts.execTimeout || _this.execTimeout;
                _this.irs = opts.irs || _this.irs;
                _this.ors = opts.ors || _this.ors;
                _this.echoLines = (typeof opts.echoLines !== 'undefined' ? opts.echoLines : _this.echoLines);
                _this.maxBufferLength = opts.maxBufferLength || _this.maxBufferLength;
            }
            cmd += _this.ors;
            if (!_this.socket.writable)
                return reject(new Error('socket not writable'));
            _this.socket.write(cmd, function () {
                var execTimeout = null;
                _this.state = 'response';
                _this.emit('writedone');
                _this.once('responseready', responseHandler);
                _this.once('bufferexceeded', buffExcHandler);
                if (_this.execTimeout) {
                    execTimeout = setTimeout(function () {
                        execTimeout = null;
                        _this.removeListener('responseready', responseHandler);
                        _this.removeListener('bufferexceeded', buffExcHandler);
                        reject(new Error('response not received'));
                    }, _this.execTimeout);
                }
                function responseHandler() {
                    if (execTimeout !== null) {
                        clearTimeout(execTimeout);
                    }
                    if (this.response !== 'undefined') {
                        resolve(this.response.join('\n'));
                    }
                    else
                        reject(new Error('invalid response'));
                    /* reset stored response */
                    this.inputBuffer = '';
                    /* set state back to 'standby' for possible telnet server push data */
                    this.state = 'standby';
                    this.removeListener('bufferexceeded', buffExcHandler);
                }
                function buffExcHandler() {
                    if (execTimeout !== null) {
                        clearTimeout(execTimeout);
                    }
                    if (!this.inputBuffer)
                        return reject(new Error('response not received'));
                    resolve(this.inputBuffer);
                    /* reset stored response */
                    this.inputBuffer = '';
                    /* set state back to 'standby' for possible telnet server push data */
                    this.state = 'standby';
                }
            });
        }).asCallback(callback);
    };
    Telnet.prototype.send = function (data, opts, callback) {
        var _this = this;
        if (opts && opts instanceof Function)
            callback = opts;
        return new Promise(function (resolve, reject) {
            if (opts && opts instanceof Object) {
                _this.ors = opts.ors || _this.ors;
                _this.sendTimeout = opts.timeout || _this.sendTimeout;
                _this.maxBufferLength = opts.maxBufferLength || _this.maxBufferLength;
                _this.waitfor = (opts.waitfor ? (opts.waitfor instanceof RegExp ? opts.waitfor : RegExp(opts.waitfor)) : false);
            }
            data += _this.ors;
            if (_this.socket.writable) {
                _this.on('data', sendHandler);
                var response_1 = '';
                try {
                    _this.socket.write(data, function () {
                        _this.state = 'standby';
                        if (!_this.waitfor || !opts) {
                            setTimeout(function () {
                                if (response_1 === '') {
                                    _this.removeListener('data', sendHandler);
                                    reject(new Error('response not received'));
                                    return;
                                }
                                _this.removeListener('data', sendHandler);
                                resolve(response_1);
                            }, _this.sendTimeout);
                        }
                    });
                }
                catch (e) {
                    _this.removeListener('data', sendHandler);
                    reject(new Error('send data failed'));
                }
                var self_1 = _this;
                function sendHandler(data) {
                    response_1 += data.toString();
                    if (self_1.waitfor) {
                        if (!self_1.waitfor.test(response_1))
                            return;
                        self_1.removeListener('data', sendHandler);
                        resolve(response_1);
                    }
                }
            }
            else {
                reject(new Error('socket not writable'));
            }
        }).asCallback(callback);
    };
    Telnet.prototype.getSocket = function () {
        return this.socket;
    };
    Telnet.prototype.end = function () {
        var _this = this;
        return new Promise(function (resolve) {
            _this.socket.end();
            resolve();
        });
    };
    Telnet.prototype.destroy = function () {
        var _this = this;
        return new Promise(function (resolve) {
            _this.socket.destroy();
            resolve();
        });
    };
    Telnet.prototype._parseData = function (chunk, callback) {
        var promptIndex = '';
        if (chunk[0] === 255 && chunk[1] !== 255) {
            this.inputBuffer = '';
            var negReturn = this._negotiate(chunk);
            if (negReturn == undefined)
                return;
            else
                chunk = negReturn;
        }
        if (this.state === 'start') {
            this.state = 'getprompt';
        }
        if (this.state === 'getprompt') {
            var stringData = chunk.toString();
            var promptIndex_1 = utils.search(stringData, this.shellPrompt);
            if (utils.search(stringData, this.loginPrompt) !== -1) {
                /* make sure we don't end up in an infinite loop */
                if (!this.loginPromptReceived) {
                    this.state = 'login';
                    this._login('username');
                    this.loginPromptReceived = true;
                }
            }
            else if (utils.search(stringData, this.passwordPrompt) !== -1) {
                this.state = 'login';
                this._login('password');
            }
            else if (typeof this.failedLoginMatch !== 'undefined' && utils.search(stringData, this.failedLoginMatch) !== -1) {
                this.state = 'failedlogin';
                this.emit('failedlogin', stringData);
                this.destroy();
            }
            else if (promptIndex_1 !== -1) {
                if (!(this.shellPrompt instanceof RegExp))
                    this.shellPrompt = stringData.substring(promptIndex_1);
                this.state = 'standby';
                this.inputBuffer = '';
                this.loginPromptReceived = false;
                this.emit('ready', this.shellPrompt);
                if (callback)
                    callback('ready', this.shellPrompt);
            }
            else
                return;
        }
        else if (this.state === 'response') {
            if (this.inputBuffer.length >= this.maxBufferLength) {
                return this.emit('bufferexceeded');
            }
            var stringData = chunk.toString();
            this.inputBuffer += stringData;
            promptIndex = utils.search(this.inputBuffer, this.shellPrompt);
            if (promptIndex === -1 && stringData.length !== 0) {
                if (utils.search(stringData, this.pageSeparator) !== -1) {
                    this.socket.write(Buffer.from('20', 'hex'));
                }
                return;
            }
            var response = this.inputBuffer.split(this.irs);
            for (var i = response.length - 1; i >= 0; --i) {
                if (utils.search(response[i], this.pageSeparator) !== -1) {
                    response[i] = response[i].replace(this.pageSeparator, '');
                    if (response[i].length === 0)
                        response.splice(i, 1);
                }
            }
            if (this.echoLines === 1)
                response.shift();
            else if (this.echoLines > 1)
                response.splice(0, this.echoLines);
            /* remove prompt */
            if (this.stripShellPrompt) {
                var idx = response.length - 1;
                response[idx] = utils.search(response[idx], this.shellPrompt) > -1
                    ? response[idx].replace(this.shellPrompt, '')
                    : '';
            }
            this.response = response;
            this.emit('responseready');
        }
    };
    Telnet.prototype._login = function (handle) {
        var _this = this;
        if ((handle === 'username' || handle === 'password') && this.socket.writable) {
            this.socket.write(this[handle] + this.ors, function () {
                _this.state = 'getprompt';
            });
        }
    };
    Telnet.prototype._negotiate = function (chunk) {
        /* info: http://tools.ietf.org/html/rfc1143#section-7
         * refuse to start performing and ack the start of performance
         * DO -> WONT WILL -> DO */
        var packetLength = chunk.length;
        var negData = chunk;
        var cmdData = null;
        var negResp = null;
        for (var i = 0; i < packetLength; i += 3) {
            if (chunk[i] != 255) {
                negData = chunk.slice(0, i);
                cmdData = chunk.slice(i);
                break;
            }
        }
        negResp = negData.toString('hex').replace(/fd/g, 'fc').replace(/fb/g, 'fd');
        if (this.socket.writable)
            this.socket.write(Buffer.from(negResp, 'hex'));
        if (cmdData != undefined)
            return cmdData;
        else
            return;
    };
    Telnet.prototype._checkSocket = function (sock) {
        return this.extSock !== null &&
            typeof this.extSock === 'object' &&
            typeof this.extSock.pipe === 'function' &&
            this.extSock.writable !== false &&
            typeof this.extSock._write === 'function' &&
            typeof this.extSock._writableState === 'object' &&
            this.extSock.readable !== false &&
            typeof this.extSock._read === 'function' &&
            typeof this.extSock._readableState === 'object';
    };
    return Telnet;
}(events.EventEmitter));
exports.default = Telnet;
var Stream = /** @class */ (function (_super) {
    __extends(Stream, _super);
    function Stream(source, options) {
        var _this = _super.call(this, options) || this;
        _this.source = source;
        _this.source.on('data', function (data) { return _this.push(data); });
        return _this;
    }
    Stream.prototype._write = function (data, encoding, cb) {
        if (!this.source.writable) {
            cb(new Error('socket not writable'));
        }
        this.source.write(data, encoding, cb);
    };
    Stream.prototype._read = function () { };
    return Stream;
}(Duplex));
//# sourceMappingURL=index.js.map