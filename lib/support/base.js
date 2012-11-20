var Base = module.exports = function () {
  
}

Base.prototype.bind = function (fn, self) {

  return function () {

    return fn.apply(self, arguments);
  };
};