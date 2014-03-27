var spawn = require('child_process').spawn;
var path = require('path');

module.exports = function (opts, url) {
  if (typeof opts === 'string') {
    url = opts;
    opts = {};
  }
  var args = optsToArgs(opts).concat(url || []);
  var cwd = path.resolve(__dirname, '..', '..', 'bin');
  var hipcheck = spawn('./hipcheck', args, { cwd: cwd });
  hipcheck.stdout.pipe(process.stdout);
  hipcheck.stderr.pipe(process.stdout);
  return hipcheck;
};

function optsToArgs (opts) {
  return Object.keys(opts).reduce(function (arr, key) {
    arr.push('--'+key);
    if (opts[key] !== true) {
      arr.push(opts[key]);
    }
    return arr;
  }, []);
}