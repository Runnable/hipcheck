module.exports = function throwError (message, err) {
  console.error(message+'::\n');
  if (err) throw err;
};