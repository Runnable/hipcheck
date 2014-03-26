var redis = require('redis');
var createCount = require('callback-count');
var createAppWithMiddleware = require('./fixtures/createAppWithMiddleware');
var startHipcheck = require('./fixtures/startHipcheck');
var BackendHosts = require('../lib/BackendHosts');

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
        hosts_check_interval: 1
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
