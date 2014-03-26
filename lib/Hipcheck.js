var throwError = require('./throwError');
var camelize = require('camelize');
var defaults = require('defaults');
var VhostChecker = require('./VhostChecker');
var clone = require('clone');

module.exports = HipCheck;

function HipCheck (options) {
  options = options || {};

  options = camelize(options);
  options = defaults(options, {
    dryrun            : false,
    method            : 'GET',
    expectedStatus    : 200,
    timeout           : 3,
    interval          : 3,
    hostsCheckInterval: 3,
    redis             : '127.0.0.1:6379'
  });

  options.timeout *= 1000;
  options.interval *= 1000;
  options.hostsCheckInterval *= 1000;

  this.options = options;
  this.validateOptions();

  this.initRollbar();
  this.initRedis();
}

HipCheck.prototype.start = function () {
  var options = clone(this.options);
  var vhostChecker = this.vhostChecker = new VhostChecker(options);

  vhostChecker.on('error', function (err, source) {
    if (err.known) {
      console.error(err.message);
    }
    else {
      console.error(err);
      console.error(err.stack);
    }
    if (err.body) {
      console.error(err.body);
    }
    if (this.options.rollbarToken) {
      rollbar.handleError(err);
    }
  });
  vhostChecker.on('warn', function (message, source) {
    console.log(message);
    if (this.options.rollbarToken) {
      rollbar.reportMessage(err, 'warn');
    }
  });
  vhostChecker.on('log', function (message, source) {
    console.log(message);
  });

  this.redis.on('connect', function () {
    vhostChecker.start();
  });
};

HipCheck.prototype.stop = function () {
  this.redis.disconnect();
  this.vhostChecker.stop();
};

// below is "private"

HipCheck.prototype.validateOptions = function () {
  var options = this.options;
  if (!options.url) {
    throwError('Missing argument "url"',
      new Error('Missing argument "url"'));
  }
  else if (!~options.url.indexOf('//')) {
    throwError('"url" must include protocol (eg. http://)',
      new Error('"url" must include protocol (eg. http://)'));
  }
};

HipCheck.prototype.initRollbar = function () {
  var rollbarToken = this.options.rollbarToken;
  if (rollbarToken) {
    this.rollbar = require('rollbar');
    this.rollbar.init(rollbarToken);
  }
};

HipCheck.prototype.initRedis = function () {
  var options = this.options;
  var redisHostSplit = options.redis.split(':');
  options.redisHostname = redisHostSplit[0];
  options.redisPort = redisHostSplit[1];
  options.redisOpts = {
    auth_pass: options.redisPassword
  };

  this.redis = require('redis').createClient(
    options.redisPort,
    options.redisHostname,
    options.redisOpts
  );
  this.redis.on('error', throwError.bind(null, 'Redis Connection Error'));
};