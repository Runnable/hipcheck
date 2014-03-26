var express = require('express');
module.exports = function createAppWithMiddleware (port, middleware, cb) {
  var app = express();
  app.set('port', port);
  app.use(middleware);
  var server = app.listen(port, cb);

  app.server = server;
  return app;
};