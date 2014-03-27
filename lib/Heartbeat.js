// var ci = require('correcting-interval');
var request = require('request');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

module.exports = Heartbeat;

function Heartbeat (options) {
  /* options
    url, host, interval, timeout, expectStatus,
  */
  options = options || {};
  this.options = options;

  this.host = options.host;
  this.started = false;
  var url = this.options.url;
  var method = this.options.method;
  this.niceUrl = method.toUpperCase()+' '+url;
}

util.inherits(Heartbeat, EventEmitter);

Heartbeat.prototype.start = function () {
  if (this.started) {
    this.log('already started');
    return;
  }
  this.started = true;
  this.log('started');
  this.errorStreak = 0;
  var intervalMs = this.options.interval;
  this.requestInt = setInterval(this.request.bind(this), intervalMs);
};

Heartbeat.prototype.stop = function () {
  if (!this.started) {
    this.log('already stopped');
    return;
  }
  this.log('stopped');
  clearInterval(this.requestInt);
  this.started = false;
};

// Below is "private"

Heartbeat.prototype.request = function () {
  this.requestPending = true;
  var url         = this.options.url;
  var methodLower = this.options.method.toLowerCase();
  var timeout     = this.options.timeout;
  var opts = {
    timeout: timeout
  };
  request[methodLower](url, opts, this.onResponse.bind(this));
};

Heartbeat.prototype.onResponse = function (err, res, body) {
  this.requestPending = false;
  var expectStatus = this.options.expectStatus;
  if (err) {
    if (err.message.match(/(TIMEDOUT)|(ECONN)/)) {
      err.known = true;
    }
    this.onError(err);
  }
  else if (expectStatus && expectStatus !== res.statusCode) {
    var errMessage = [
      'Unexpected status code', res.statusCode,
      '(expected', expectStatus+')'
    ].join(' ');
    err = new Error(errMessage);
    err.known = true;
    err.body = body;
    this.onError(err);
  }
  else {
    this.onSuccess(res.statusCode);
  }
};

Heartbeat.prototype.log = function (/* messageParts.. */) {
  var message = Array.prototype.slice.call(arguments).join(' ');
  this.emit('log', 'Heartbeat - '+this.niceUrl+' - '+message, this);
};


Heartbeat.prototype.warn = function (/* messageParts.. */) {
  var message = Array.prototype.slice.call(arguments).join(' ');
  this.emit('warn', 'Heartbeat - '+this.niceUrl+' - Warn! '+message, this);
};

Heartbeat.prototype.onError = function (err) {
  this.errorStreak++;
  var e = new Error('Heartbeat - '+this.niceUrl+' - Error! '+err.message);
  e.stack = err.stack;
  e.body = err.body;
  if (err.known) e.known = err.known;
  e.type = 'heartbeat';
  this.emit('error', e, this);
};

Heartbeat.prototype.onSuccess = function (code) {
  this.errorStreak = 0;
  this.log('success '+code);
};