var _ = require('underscore');
var async = require('async');
var util = require('../support/util');

var Admin = require('./admin');
var Server = require('./server');

var Daemon = function (options, env) {

  env = env || {};
  util.mixin(this, require('../support/base'));
  util.mixin(this, require('./statistics'));
  
  this.debug = util.debug(env.DEBUG);
  
  this.init(options);
  process.on('SIGINT', this.bind(this.cleanup, this));
  process.on('uncaughtException', this.bind(this.cleanup, this));
  return this.start();
}

Daemon.prototype._defaultOptions = {
  port: 8000,
  host: 'localhost',
  metricInterval: 5000,
  fileExtension: ".js"
}

Daemon.prototype._isCleaning = false;

Daemon.prototype.init = function (options) {

  this.options = _.extend({}, this._defaultOptions, options || {});
  
  this.initStatistics();
  this.admin = new Admin(this, this.options);
  
  return this;
};

Daemon.prototype.cleanup = function (err) {

  if (this._isCleaning == true) {
    this.debug("already cleaning");
    return;
  }
  this._isCleaning = true;
  this.debug("performing cleanup");
  
  if (err) {
    throw err;
  }
  
  this.stop()
  this.admin.stop();
  this.finalizeData();
  
  process.exit();
};

Daemon.prototype.stop = function () {

  clearInterval(this.metricsTimer);
  this.record('ended', this.now());
  
  if (this.server != null) {
    this.server.removeAllListeners();
    if (this.server.cleanup) {
      this.server.cleanup();
    }
    this.server.kill('SIGINT');
    this.server = null;
  }
  return this.finalizeData();
};

Daemon.prototype.start = function () {

  this.admin.start();
  
  this.serverInit();
  
  return this;
}

Daemon.prototype.serverInit = function (settings) {

  if (this.server != null) {
    this.stop();
  }
  
  if (this.benchmark != null) {
    return "Cannot (re)start server while benchmark is in progress"
  }
  
  settings = _.extend({}, this.options, settings || {});
  
  this.server = new Server(this, settings);
  this.server.on('message', this.bind(this.onMessage, this))
  this.metricsTimer = setInterval(this.bind(this.pollMetrics, this), settings.metricInterval);
  
  return {};
}

module.exports = Daemon;