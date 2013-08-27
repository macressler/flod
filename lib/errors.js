var Util = require('util');

var Errors = {};

Errors.AbstractError = function (msg, constr) {

    this.message  = msg || 'Error';
};
Util.inherits(Errors.AbstractError, Error);
Errors.AbstractError.prototype.name = "Abstract Error";

Errors.ConnectionError = function (msg, constr) {

    Errors.ConnectionError.super_.call(this, msg, this.constructor);
};
Util.inherits(Errors.ConnectionError, Errors.AbstractError);
Errors.ConnectionError.prototype.name = "Connection Error";
Errors.ConnectionError.prototype.message = "Server refused connection. Try again with lower concurrency values.";


Errors.RequestOverloadError = function (msg, constr) {

    Errors.RequestOverloadError.super_.call(this, msg, this.constructor);
    
    this.message = 'Timeout exceeded. Server could not maintain ' + msg + ' requests per second';
};
Util.inherits(Errors.RequestOverloadError, Errors.AbstractError);
Errors.RequestOverloadError.prototype.name = "Request Overload Error";



module.exports = Errors;