var _ = require('underscore');

module.exports = {};

module.exports.mixin = function (self, parent) {

  for (var i in parent.prototype) {
        if (parent.prototype.hasOwnProperty(i)) {
            if (!self.hasOwnProperty(i)) {
                self[i] = parent.prototype[i];
            }
        }
    }
    return self;
};

module.exports.debug = function (enabled) {
  if (enabled === "true") {
    return console.log;
  } else {
    return function(){};
  }
}