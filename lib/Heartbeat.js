// var ci = require('correcting-interval');
var request = require('request');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

module.exports = Heartbeat;

function Heartbeat (opts) {
  this.method = opts.method.toLowerCase();
  this.url = opts.url;
  this.host = opts.host;
  this.interval = opts.interval;
  this.timeout  = opts.timeout;
  this.started = false;
  this.expectedStatusCode = opts.expectedStatusCode;
  this.niceUrl = this.method.toUpperCase()+' '+this.url;
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
  this.requestInt = setInterval(this.request.bind(this), this.interval);
};

Heartbeat.prototype.stop = function () {
  if (!this.started) {
    this.log('already stopped');
    return;
  }
  this.log('stopped');
  if (this.requestPending) {
    this.stopAfterRequest = true;
  }
  clearInterval(this.requestInt);
  this.started = false;
};

// Below is "private"

Heartbeat.prototype.request = function () {
  var self = this;
  this.requestPending = true;
  var opts = {
    timeout: this.timeout
  };
  request[this.method](this.url, opts, this.onResponse.bind(this));
};

Heartbeat.prototype.onResponse = function (err, res) {
  if (err) {
    this.onError(err);
  }
  else if (this.expectedStatusCode !== res.statusCode) {
    var errMessage = 'Unexpected status code: ' + res.statusCode +' expected:' + this.expectedStatusCode;
    this.onError(new Error(errMessage));
  }
  else {
    this.onSuccess();
  }
  this.requestPending = false;
  if (this.stopAfterRequest) {
    this.stopAfterRequest = false;
    this.stop();
  }
};

Heartbeat.prototype.log = function (/* messageParts.. */) {
  var message = Array.prototype.slice.call(arguments).join(' ');
  this.emit('log', 'Heartbeat ('+this.niceUrl+'): '+message, this);
};


Heartbeat.prototype.warn = function (/* messageParts.. */) {
  var message = Array.prototype.slice.call(arguments).join(' ');
  this.emit('warn', 'HeartbeatWarn ('+this.niceUrl+'): '+message, this);
};

Heartbeat.prototype.onError = function (err) {
  this.errorStreak++;
  var e = new Error('HeartbeatError! ('+this.niceUrl+'): '+err.message);
  e.stack = err.stack;
  e.type = 'heartbeat';
  this.emit('error', e, this);
};

Heartbeat.prototype.onSuccess = function () {
  this.errorStreak = 0;
  this.emit('success', this);
  this.log('success');
};