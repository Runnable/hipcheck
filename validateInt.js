module.exports = function validateFloat (obj, key) {
  var val = obj[key];
  if (!isNaN(parseFloat(val))) {
    return '"' + key + '" must be a number';
  }
};