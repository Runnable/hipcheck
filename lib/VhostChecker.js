var Url = require('url');
var Heartbeat = require('./Heartbeat');
var BackendHosts = require('./BackendHosts');
var throwError = require('./throwError');
var removeItemsFromArray = require('./removeItemsFromArray');
// var ci = require('correcting-interval');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var clone = require('clone');
var level = require('level');
var sublevel = require('level-sublevel');
var fno = require('fn-object');
var pluck = require('map-utils').pluck;

module.exports = VhostChecker;

function VhostChecker (options) {
  /* options
    hostsInterval, [redisHostname], [redisPort], [redisOpts]
  */
  /* options for hearbeat (passed through)
    url, host, interval, timeout, expectStatus,
  */
  options = options || {};
  this.options = options;
  var vhostUrlObj = Url.parse(options.url);
  this.vhost = vhostUrlObj.host;
  this.backendHosts = new BackendHosts(this.vhost, {
    redisHostname: options.redisHostname,
    redisPort:     options.redisPort,
    redisOpts:     options.redisOpts,
    dryrun:        options.dryrun
  });
  this.heartbeats = {};
  this.initCache();
}

util.inherits(VhostChecker, EventEmitter);

VhostChecker.prototype.start = function () {
  if (this.started) {
    this.log('already started');
    return;
  }
  this.restoreFromCache();
  this.started = true;
  this.log('started');
  var intervalTime = this.options.hostsInterval;
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
  var heartbeats = this.heartbeats;
  Object.keys(heartbeats).forEach(function (host) {
    heartbeats[host].stop();
  });
  if (this.cache) {
    var delistedHeartbeats = fno(heartbeats).vals
      .map(pluck('delisted'))
      .filter(value)
      .val();
    var delistedHosts = Object.keys(delistedHeartbeats);
    var cache = this.cache;
    cache.put('delistedHosts', delistedHosts, cache.close.bind(cache));
  }
};

// Below is "private"

VhostChecker.prototype.initCache = function () {
  if (this.options.noCache) return;
  var options = this.options;
  var self = this;
  this.cache = sublevel(level(options.cachePath, {
    valueEncoding: 'json'
  })).sublevel(this.vhost);
};

VhostChecker.prototype.restoreFromCache = function () {
  if (this.options.noCache) return;
  var self = this;
  if (this.options.deleteCache) {
    this.cache.del('delistedHosts', function (err) {
      if (err) {
        if (err.type == 'NotFoundError') return; //ignore and return
        return throwError(err);
      }
    });
  }
  else { // restore
    this.cache.get('delistedHosts', function (err, hosts) {
      if (err) {
        if (err.type == 'NotFoundError') return; //ignore and return
        return throwError(err);
      }
      self.handleLatestHosts(hosts);
    });
  }
};

VhostChecker.prototype.checkForHostUpdates = function () {
  var self = this;
  this.backendHosts.list(function (err, latestHosts) {
    if (err) return self.emit('error', err);

    self.handleLatestHosts(latestHosts);
  });
};

VhostChecker.prototype.handleLatestHosts = function (latestHosts) {
  var self = this;
  var currentHosts = Object.keys(this.heartbeats);
  var delistedHosts = currentHosts.filter(delisted);
  var activeHosts  = removeItemsFromArray(currentHosts, delistedHosts);
  var removedHosts = removeItemsFromArray(currentHosts, latestHosts);
  removedHosts     = removeItemsFromArray(removedHosts, delistedHosts); // dont remove delisted hosts
  var newHosts     = removeItemsFromArray(latestHosts, currentHosts);
  console.log('<Hosts>');
  if (activeHosts.length)   console.log('  active   -', activeHosts);
  if (delistedHosts.length) console.log('  delisted -', delistedHosts);
  if (removedHosts.length)  console.log('  missing  -', removedHosts);
  console.log('</Hosts>');
  newHosts.forEach(function (host) {
    self.createHeartbeatFor(host);
  });

  if (this.options.killDelisted) {
    delistedHosts.forEach(function (host) {
        self.removeHeartbeatFor(host);
    });
  }

  removedHosts.forEach(function (host) {
    self.removeHeartbeatFor(host);
  });
  function delisted (host) {
    return self.heartbeats[host].delisted;
  }
};

VhostChecker.prototype.createHeartbeatFor = function  (host) {
  var urlObj = Url.parse(this.options.url); // hipacheUrlObj
  urlObj.host = Url.parse(host).host;
  delete urlObj.hostname;
  delete urlObj.port;
  var boxUrl = Url.format(urlObj);
  // Heartbeat
  var options = clone(this.options);
  options.url = boxUrl;
  options.host = host;
  var heartbeat = new Heartbeat(options);

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
    this.warn('delisted '+heartbeat.host, this);
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
  var heartbeat = this.heartbeats[host];
  if (!heartbeat) {
    return false;
  }
  heartbeat.stop();
  this.warn(heartbeat.host + ' missing in redis', this);
  delete this.heartbeats[host];
  return true;
};

VhostChecker.prototype.warn = function (message) {
  this.emit('warn', 'VhostChecker - '+this.vhost+' - Warn! '+message, this);
};

VhostChecker.prototype.log = function (/* messageParts.. */) {
  var message = Array.prototype.slice.call(arguments).join(' ');
  this.emit('log', '\nVhostChecker - '+this.vhost+' - '+message+'\n', this);
};

VhostChecker.prototype.onError = function (err) {
  this.errorStreak++;
  var e = new Error('VhostChecker - '+this.vhost+' - Error! '+err.message);
  e.stack = err.stack;
  if (err.known) e.known = err.known;
  e.type = 'heartbeat';
  this.emit('error', e, this);
};


function value (v) {
  return v;
}
