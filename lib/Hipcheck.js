var throwError = require('./throwError');
var camelize = require('camelize');
var defaults = require('defaults');
var VhostChecker = require('./VhostChecker');
var clone = require('clone');
var rollbar = require('rollbar');
var path = require('path');

module.exports = HipCheck;

function HipCheck (options) {
  options = options || {};

  options = camelize(options);
  // console.log(options);
  options = defaults(options, {
    dryrun        : false,
    method        : 'GET',
    expectStatus  : 200,
    timeout       : 3,
    interval      : 3,
    hostsInterval : 3,
    redis         : '127.0.0.1:6379',
    cachePath     : path.join(process.env.HOME, '.hipcheck'),
    deleteCache   : false,
    noCache       : false
  });

  options.timeout *= 1000;
  options.interval *= 1000;
  options.hostsInterval *= 1000;

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
    if (this.options.rollbar) {
      rollbar.handleError(err);
    }
  });
  vhostChecker.on('warn', function (message, source) {
    console.log(message);
    if (this.options.rollbar) {
      rollbar.reportMessage(message, 'warn');
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
  var rollbarToken = this.options.rollbar;
  if (rollbarToken) {
    rollbar.init(rollbarToken);
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

rollbar.init('34dfc593cf14456985c66ffc12c6acc4');
rollbar.reportMessage('heyyyy', 'warn');