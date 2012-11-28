var _ = require('underscore');
var async = require('async');
var joi = require('joi');
var util = require('../support/util');

var Admin = require('./admin');
var Server = require('./server');

var N = joi.Types.Number,
    S = joi.Types.String,
    B = joi.Types.Boolean;
var Flag = S().allow(false).allow(true);
var NumFlag = N().allow(false).allow(true);

var Daemon = function (options, env) {

  this.debug = util.debug(env.DEBUG || options['--verbose']);
  env = env || {};
  util.mixin(this, require('../support/base'));
  util.mixin(this, require('../support/statistics'));
  
  this.debug('args', options);
  
  this.init(options);
  
  process.on('SIGINT', this.bind(this.cleanup, this));
  process.on('uncaughtException', this.bind(this.cleanup, this));
  
  if (options['<action>'] == "clean" || options.clean == true) {
    return this.cleanLogs();
  }
  
  if (options['<action>'] == "run" || options.run == true) {
    return this.start();
  }
  
  this.debug('unknown action supplied: ', options['<action>']);
}

Daemon.prototype._defaultOptions = {
  'port': 8080,
  'host': 'localhost',
  '--metricInterval': 500,
  'rootPath': __dirname,
  '--logPath': './logs/',
  '--logPrefix': 'bench',
  'fileExtension': ".js",
  '<filename>': __dirname + "../../support/hapi/helloworld.js"
}

Daemon.prototype._optionsSchema = {
  '--help': Flag,
  '--verbose': Flag,
  '--version': Flag,
  '--noBackups': Flag,
  '--metricInterval': NumFlag,
  '--logPrefix': S(),
  '--logPath': S(),
  
  'port': N(),
  'host': S(),
  'fileExtension': S(),
  '<action>': S().allow(null),
  'clean': Flag,
  'run': Flag,
  '<filename>': S().allow(null),
  'rootPath': S() // special case
};

Daemon.prototype._isCleaning = false;

Daemon.prototype.init = function (options) {

  this.options = _.extend({}, this._defaultOptions, options || {});
  
  this.initStatistics();
  this.validateOptions();
  
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
    this.debug('#cleanup err', err.stack, JSON.stringify(err, null, 2));
    // throw err;
  }
  
  this.stop();
  this.admin.stop();
  
  process.nextTick(function (){
    process.exit();
  })
};

Daemon.prototype.stop = function () {

  this.debug('#Daemon.stop');
  this.record('ended', this.now());
  
  if (this.server != null) {
    this.server.removeAllListeners();
    this.server.kill('SIGINT');
  }
  
  this.initStatistics();
};

Daemon.prototype.start = function (options, callback) {

  options = options || this.options;
  callback = callback || function () {};
  
  this.debug("#Daemon.start");
  this.admin.start();
  
  // this.debug("#serverInit() from start")
  // this.serverInit(options, callback);
  
  return this;
}

Daemon.prototype.serverInit = function (settings, callback) {

  this.debug("#Daemon.serverInit");
  if (this.server != null) {
    this.stop();
    this.debug("#serverInit -> #stop()");
  }
  
  if (this.benchmark != null) {
    var msg = "Cannot (re)start server while benchmark is in progress";
    this.debug("#Daemon", msg);
    return msg;
  }
  
  settings = _.extend({}, this.options, settings || {});
  
  this.server = new Server(this, settings);
  this.server.on('message', this.bind(this.onMessage, this));
  this.server.send({action: 'info'});
  
  if (callback && typeof callback == 'function') {
    
    // console.log("message.started enabled")
    this.server.on('message', function (m) {
      if (m.action == 'started') {
        // console.log('server started')
        callback(null, {});
      }
    });
  }
  
  return {};
}

module.exports = Daemon;