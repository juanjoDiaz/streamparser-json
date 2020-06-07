// Slow code to string converter (only used when throwing syntax errors)
function getKeyFromValue(obj, value) {
  return Object.entries(obj).find(([_, possibleValue]) => possibleValue === value)[0];
}

module.exports = {
  getKeyFromValue,
};