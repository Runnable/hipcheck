var redis = require('redis');
var createCount = require('callback-count');
var removeItemsFromArray = require('./removeItemsFromArray');
var noop = function () {};

module.exports = BackendHosts;

function BackendHosts (vhost, opts) {
  opts = opts || {};
  this.key = 'frontend:'+vhost;
  this.redis = redis.createClient(opts.redisPort, opts.redisHostname, opts.redisOpts);
  if (opts.dryrun) {
    this.dryrun = true;
    this.fakeAdded = [];
    this.fakeRemoved = [];
  }
}

BackendHosts.prototype.init = function (entries, cb) {
  var self = this;
  var count = createCount(cb);
  entries.unshift('name-'+Math.random());
  this.destroy(function (err) {
    if (err) return cb(err);
    entries.forEach(function (entry) {
      self.add(entry, count.inc().next);
    });
  });
};

BackendHosts.prototype.range = function (start, end, cb) {
  this.redis.lrange(this.key, start, end, function (err, hosts) {
    if (err) return cb(err);
    if (this.dryrun) hosts = hosts.concat(this.fakeAdded);
    cb(null, hosts);
  });
};

BackendHosts.prototype.rem = function (item, cb) {
  if (this.dryrun) return this.fakeRem(cb);
  this.redis.lrem(this.key, 0, item, cb);
};

BackendHosts.prototype.remAll = function (cb) { // remove all hosts
  var self = this;
  self.list(function (err, hosts) {
    if (err) return cb(err);
    if (self.dryrun) return this.fakeRemAll(cb);
    var remCount = createCount(cb);
    hosts.forEach(function (host) {
      self.rem(host, remCount.inc().next);
    });
  });
};

BackendHosts.prototype.add = function (item, cb) {
  if (this.dryrun) return this.fakeAdd(cb);
  this.redis.rpush(this.key, item, cb);
};

BackendHosts.prototype.list = function (cb) {
  this.range(1, -1, cb);
};

BackendHosts.prototype.destroy = function (cb) {
  if (this.dryrun) return cb(); // block if dryrun
  this.redis.del(this.key, cb);
};


//
BackendHosts.prototype.fakeAdd = function (host, cb) {
  cb = cb || noop;
  var hosts = [host];
  removeItemsFromArray(this.fakeAdded, hosts);
  removeItemsFromArray(this.fakeRemoved, hosts); // ensures no duplicates
  this.fakeAdded = this.fakeAdded.concat(hosts);
  return cb();
};
BackendHosts.prototype.fakeRem = function (host, cb) {
  cb = cb || noop;
  this.fakeRemAll([host], cb);
};
BackendHosts.prototype.fakeRemAll = function (hosts, cb) {
  cb = cb || noop;
  removeItemsFromArray(this.fakeAdded, hosts);
  removeItemsFromArray(this.fakeRemoved, hosts); // ensures no duplicates
  this.fakeRemoved = this.fakeRemoved.concat(hosts);
  return cb();
};
