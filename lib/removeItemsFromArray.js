module.exports = function removeItemsFromArray (array, itemsToRemove) {
  return array.filter(function (item) {
    return !~itemsToRemove.indexOf(item);
  });
};