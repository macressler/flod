var Util = require('util');

var Errors = {};

Errors.AbstractError = function (msg, constr) {

    this.message  = msg || 'Error';
};
Util.inherits(Errors.AbstractError, Error);
Errors.AbstractError.prototype.name = 'Abstract Error';

Errors.ConnectionError = function (msg, constr) {

    Errors.ConnectionError.super_.call(this, msg.url + ' refused connection. Try again with concurrency values lower than ' + msg.rps + '.', this.constructor);
};
Util.inherits(Errors.ConnectionError, Errors.AbstractError);
Errors.ConnectionError.prototype.name = 'Connection Error';


Errors.RequestOverloadError = function (msg, constr) {

    Errors.RequestOverloadError.super_.call(this, 'Timeout exceeded. ' + msg.url + ' could not maintain ' + msg.rps + ' requests per second.', this.constructor);
};
Util.inherits(Errors.RequestOverloadError, Errors.AbstractError);
Errors.RequestOverloadError.prototype.name = 'Request Overload Error';



module.exports = Errors;