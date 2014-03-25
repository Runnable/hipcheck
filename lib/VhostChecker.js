var Url = require('url');
var Heartbeat = require('./Heartbeat');
var BackendHosts = require('./BackendHosts');
// var ci = require('correcting-interval');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

module.exports = VhostChecker;

function VhostChecker (program) {
  var vhostUrlObj = Url.parse(program.url);
  this.vhost = vhostUrlObj.host;
  this.options = program;
  this.backendHosts = new BackendHosts(this.vhost, {
    redisHostname: program.redisHostname,
    redisPort:     program.redisPort,
    redisOpts:     program.redisOpts
  });
  this.heartbeats = {};
}

util.inherits(VhostChecker, EventEmitter);

VhostChecker.prototype.start = function () {
  if (this.started) {
    this.log('already started');
    return;
  }
  this.started = true;
  this.log('started');
  var intervalTime = this.options.check_hosts_interval;
  this.hostCheckInt =
    setInterval(this.checkForHostUpdates.bind(this), intervalTime);
};

VhostChecker.prototype.stop = function () {
  if (!this.started) {
    this.log('already stopped');
    return;
  }
  this.log('stopped');
  clearInterval(this.hostCheckInt);
  heartbeat.forEach(function (heartbeat) {
    heartbeat.stop();
  });
};

// Below is "private"

VhostChecker.prototype.checkForHostUpdates = function () {
  var self = this;
  this.backendHosts.list(function (err, latestHosts) {
    if (err) return self.emit('error', err);

    self.handleLatestHosts(latestHosts);
  });
};

VhostChecker.prototype.handleLatestHosts = function (latestHosts) {
  var currentHosts = Object.keys(this.heartbeats);
  var removedHosts = removeItemsFromArray(currentHosts, latestHosts);
  var newHosts     = removeItemsFromArray(latestHosts, currentHosts);
  var self = this;
  newHosts.forEach(function (host) {
    self.createHeartbeatFor(host);
  });
  removedHosts.forEach(function (host) {
    if (self.heartbeats[host].delisted) {
      return; // dont stop hearbeats bc they were delisted by self
    }
    self.removeHeartbeatFor(host);
  });
};

VhostChecker.prototype.createHeartbeatFor = function  (host) {
  var opts = this.options;
  var urlObj = Url.parse(opts.url); // hipacheUrlObj
  urlObj.host = Url.parse(host).host;
  delete urlObj.hostname;
  delete urlObj.port;
  var boxUrl = Url.format(urlObj);
  // Heartbeat
  var heartbeat = new Heartbeat({
    method : opts.method,
    url    : boxUrl,
    host   : host,
    timeout : opts.timeout,
    interval: opts.interval,
    expectedStatusCode: opts.expected_status
  });

  heartbeat.start();

  // Heartbeat events
  heartbeat.on('error',   this.handleHeartbeatError.bind(this));
  heartbeat.on('success', this.handleHeartbeatSuccess.bind(this));
  heartbeat.on('warn',    this.emit.bind(this, 'warn')); // bubble through ..
  heartbeat.on('log',     this.emit.bind(this, 'log'));  // bubble through ..

  // Add to heartbeats hash
  this.heartbeats[host] = heartbeat;
};

VhostChecker.prototype.handleHeartbeatError = function (err, heartbeat) {
  this.emit('error', err, heartbeat); // bubble error through..

  if (!heartbeat.delisted) {
    // remove from backends on error aka delist it
    this.warn('delisted ', heartbeat.host);
    heartbeat.delisted = true;
    this.backendHosts.rem(heartbeat.host);
  }
};

VhostChecker.prototype.handleHeartbeatSuccess = function (heartbeat) {
  var self = this;

  if (heartbeat.delisted) {
    // reAdd it as backend host
    heartbeat.delisted = false;
    this.backendHosts.add(heartbeat.host, function (err) {
      if (err) self.onError(err);
    });
  }
};

VhostChecker.prototype.removeHeartbeatFor = function (host) {
  if (!this.heartbeats[host]) {
    return false;
  }
  this.heartbeats[host].stop();
  delete this.heartbeats[host];
  return true;
};

VhostChecker.prototype.warn = function (/* messageParts.. */) {
  var message = Array.prototype.slice.call(arguments).join(' ');
  this.emit('warn', 'VhostCheckerWarn ('+this.vhost+'): '+message, this);
};

VhostChecker.prototype.log = function (/* messageParts.. */) {
  var message = Array.prototype.slice.call(arguments).join(' ');
  this.emit('log', 'VhostChecker ('+this.vhost+'): '+message, this);
};

VhostChecker.prototype.onError = function (err) {
  this.errorStreak++;
  var e = new Error('VhostCheckerError! ('+this.vhost+'): '+err.message);
  e.stack = err.stack;
  e.type = 'heartbeat';
  this.emit('error', e, this);
};


function removeItemsFromArray (array, itemsToRemove) {
  return array.filter(function (item) {
    return !~itemsToRemove.indexOf(item);
  });
}