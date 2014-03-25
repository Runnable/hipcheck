var redis = require('redis');
var createCount = require('callback-count');

module.exports = BackendHosts;

function BackendHosts (vhost, opts) {
  opts = opts || {};
  this.key = 'frontend:'+vhost;
  this.redis = redis.createClient(opts.redisPort, opts.redisHostname, opts.redisOpts);
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
  var args = [this.key].concat([].slice.call(arguments));
  this.redis.lrange.apply(this.redis, args);
};

BackendHosts.prototype.rem = function (item, cb) {
  this.redis.lrem(this.key, 0, item, cb);
};

BackendHosts.prototype.add = function (item, cb) {
  this.redis.rpush(this.key, item, cb);
};

BackendHosts.prototype.list = function (cb) {
  this.range(1, -1, cb);
};

BackendHosts.prototype.destroy = function (cb) {
  this.redis.del(this.key, cb);
};