var express = require('express');
module.exports = function createAppWithMiddleware (port, middleware) {
  var app = express();
  app.set('port', port);
  app.use(middleware);
  var server = app.listen(port);

  app.server = server;
  return app;
};