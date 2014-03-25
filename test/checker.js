var redis = require('redis');
var spawn = require('child_process').spawn;
var createCount = require('callback-count');
var createAppWithMiddleware = require('./fixtures/createAppWithMiddleware');
var startHipcheck = require('./fixtures/startHipcheck');
var BackendHosts = require('../lib/BackendHosts');

describe('vhost checking', function() {
  describe('healthy', function() {
    beforeEach(function (done) {
      var self = this;
      this.vhost = 'test.domain.com';
      this.apps = [];
      // start apps
      this.apps.push(
        createAppWithMiddleware(3000, healthyMiddleware)
      );
      this.apps.push(
        createAppWithMiddleware(3001, healthyMiddleware)
      );
      function healthyMiddleware (req, res, next) {
        if (self.serverSpy) self.serverSpy();
        res.send(200, 'healthy');
      }
      // setup hipache redis
      var serverHosts = this.apps.map(function (app) {
        return 'http://localhost:'+app.get('port');
      });
      this.backendHosts = new BackendHosts(this.vhost);
      this.backendHosts.init(serverHosts, done);
    });
    afterEach(function (done) {
      this.apps.forEach(function (app) {
        app.server.close();
      });
      this.backendHosts.destroy(done);
    });

    it('should ping all the servers', function(done) {
      var count = createCount(2, done);
      this.serverSpy = count.next.bind(count);
      var opts = {
        timeout: 0.01,
        interval: 0.01,
        hosts_check_interval: 1
      };
      var hipcheck = startHipcheck(opts, 'http://'+this.vhost);
    });
  });

  describe('unhealthy', function() {
    beforeEach(function (done) {
      var self = this;
      this.vhost = 'test.domain.com';
      this.apps = [];
      // start apps
      this.apps.push(
        createAppWithMiddleware(3000, healthyMiddleware)
      );
      this.apps.push(
        createAppWithMiddleware(3001, healthyMiddleware)
      );
      function healthyMiddleware (req, res, next) {
        if (self.serverSpy) self.serverSpy();
        res.send(500, 'healthy');
      }
      // setup hipache redis
      var serverHosts = this.apps.map(function (app) {
        return 'http://localhost:'+app.get('port');
      });
      this.backendHosts = new BackendHosts(this.vhost);
      this.backendHosts.init(serverHosts, done);
    });
    afterEach(function (done) {
      this.apps.forEach(function (app) {
        app.server.close();
      });
      this.backendHosts.destroy(done);
    });

    it('should ping all the servers', function(done) {
      var count = createCount(2, done);
      this.serverSpy = count.next.bind(count);
      var opts = {
        timeout: 0.01,
        interval: 0.01,
        hosts_check_interval: 1
      };
      var hipcheck = startHipcheck(opts, 'http://'+this.vhost);
    });
  });
});