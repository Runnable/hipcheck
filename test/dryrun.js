var redis = require('redis');
var createCount = require('callback-count');
var createAppWithMiddleware = require('./fixtures/createAppWithMiddleware');
var startHipcheck = require('./fixtures/startHipcheck');
var BackendHosts = require('../lib/BackendHosts');
var noop = function () {};

describe('dryrun (same tests with dryrun flag)', function() {
  describe('healthy', function() {
    beforeEach(function (done) {
      var count = createCount(done);
      var self = this;
      this.vhost = 'test.domain.com';
      this.apps = [];
      // start apps
      this.apps.push(
        createAppWithMiddleware(3000, healthyMiddleware, count.inc().next)
      );
      this.apps.push(
        createAppWithMiddleware(3001, healthyMiddleware, count.inc().next)
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
      this.backendHosts.init(serverHosts, count.inc().next);
    });
    afterEach(function (done) {
      this.apps.forEach(function (app) {
        app.server.close();
      });
      this.hipcheck.kill();
      this.backendHosts.destroy(done);
    });

    it('should ping all the backends', function(done) {
      var count = createCount(4, done);
      this.serverSpy = count.next.bind(count);
      var opts = {
        timeout: 0.10,
        interval: 0.10,
        hosts_interval: 1,
        dryrun: true
      };
      this.hipcheck = startHipcheck(opts, 'http://'+this.vhost);
    });
    it('should ignore stop checking backends removed externally', function(done) {
      var count = createCount(2, delistBackends); // 4 counts to give it some time to delist
      this.serverSpy = count.next.bind(count);
      var opts = {
        timeout: 0.10,
        interval: 0.10,
        hosts_interval: 0.20,
        dryrun: true
      };
      var self = this;
      this.hipcheck = startHipcheck(opts, 'http://'+this.vhost);
      function delistBackends (err) {
        if (err) return done (err);
        self.backendHosts.remAll(expectNoHeartbeats);
      }
      function expectNoHeartbeats (err) {
        if (err) return done (err);
        setTimeout(function () {
          self.serverSpy = function () {
            // this should not be called
            done(new Error('got heartbeat on delisted'));
            done = noop;
          };
          setTimeout(done, opts.hosts_interval*4); // wait another interval
        }, opts.interval*2); // wait full two interval to ensure no inprogress heartbeat
      }
    });
  });
  describe('unhealthy', function() {
    describe('delist', function() {
      beforeEach(function (done) {
        var count = createCount(done);
        var self = this;
        this.vhost = 'test.domain.com';
        this.apps = [];
        // start apps
        this.apps.push(
          createAppWithMiddleware(3000, timeoutMiddleware, count.inc().next)
        );
        this.apps.push(
          createAppWithMiddleware(3001, error500Middleware, count.inc().next)
        );
        function timeoutMiddleware (req, res, next) {
          if (self.serverSpy) self.serverSpy();
          // timeout..
        }
        function error500Middleware (req, res, next) {
          if (self.serverSpy) self.serverSpy();
          res.send(500, 'unhealthy');
        }
        // setup hipache redis
        var serverHosts = this.apps.map(function (app) {
          return 'http://localhost:'+app.get('port');
        });
        this.backendHosts = new BackendHosts(this.vhost);
        this.backendHosts.init(serverHosts, count.inc().next);
      });
      afterEach(function (done) {
        this.apps.forEach(function (app) {
          app.server.close();
        });
        this.hipcheck.kill();
        this.backendHosts.destroy(done);
      });

      it('should delist backends that fail (but still try to bring them back)', function(done) {
        var count = createCount(4, checkHosts); // 4 counts to give it some time to delist
        this.serverSpy = count.next.bind(count);
        var opts = {
          timeout: 0.10,
          interval: 0.10,
          hosts_interval: 1
        };
        var self = this;
        this.hipcheck = startHipcheck(opts, 'http://'+this.vhost);
        function checkHosts (err) {
          if (err) return done(err);
          self.backendHosts.list(function (err, hosts) {
            if (err) return done(err);
            hosts.should.have.lengthOf(0);
            var count2 = createCount(2, done); // verify heartbeat still working, after delist
            self.serverSpy = count2.next.bind(count2);
          });
        }
      });
    });
  });
});