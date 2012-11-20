var _ = require('underscore');
var async = require('async');
var util = require('../support/util');

var Admin = require('./admin');
var Server = require('./server');

var Daemon = function (options, env) {

  env = env || {};
  util.mixin(this, require('../support/base'));
  util.mixin(this, require('../support/statistics'));
  
  this.debug = util.debug(env.DEBUG);
  
  this.init(options);
  
  process.on('SIGINT', this.bind(this.cleanup, this));
  // process.on('uncaughtException', this.bind(this.cleanup, this));
  // process.on('uncaughtException', function (error) {
  //   console.log(error.stack);
  //   console.dir(error);
  // });
    
  return this.start();
}

Daemon.prototype._defaultOptions = {
  port: 8080,
  host: 'localhost',
  metricInterval: 5000,
  rootPath: process.cwd(),
  logPath: './logs/',
  fileExtension: ".js",
  serverFile: __dirname + "../../examples/helloworld.js"
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
    this.debug('#cleanup err', err.stack, JSON.stringify(err, null, 2))
    // throw err;
  }
  
  
  this.stop()
  this.admin.stop();
  
  // this.unregister(this.benchmarks[this.benchmarks.length-1].id);
  // this.finalizeData();
  
  process.nextTick(function(){
    process.exit();
  })
};

Daemon.prototype.stop = function () {

  this.debug('Daemon.stop');
  var self = this;
  clearInterval(this.metricsTimer);
  this.record('ended', this.now());
  
  if (this.server != null) {
    this.server.removeAllListeners();
    if (this.server.cleanup) {
      this.server.cleanup();
    }
    this.debug("Daemon#stop server#kill")
    this.server.send({action: 'exit'});
    this.server.kill('SIGINT');
    
    
    
    // this.server.on('exit', function(code, signal){
    //   self.debug("server exited")
    //   self.server.removeAllListeners();
    //   self.server = null;
    // })
  }
  
  this.initStatistics();
  // return this.finalizeData();
  
  // return this.benchmark;
};

Daemon.prototype.start = function () {

  this.debug('Daemon.start');
  this.admin.start();
  
  // this.debug("#serverInit() from start")
  // this.serverInit();
  
  return this;
}

Daemon.prototype.serverInit = function (settings) {

  this.debug('#serverInit');
  if (this.server != null) {
    this.stop();
    this.debug("#serverInit -> #stop()")
  }
  
  if (this.benchmark != null) {
    var msg = "Cannot (re)start server while benchmark is in progress";
    this.debug(msg);
    return msg
  }
  
  settings = _.extend({}, this.options, settings || {});
  
  this.server = new Server(this, settings);
  this.server.on('message', this.bind(this.onMessage, this));
  // this.server.on('close', this.bind(this.serverInit, this));
  this.server.on('disconnect', function(){
    console.log('server disconnected')
  })
  this.server.on('close', function(){
    console.log('server closed')
  })
  this.server.on('exit', function(){
    console.log('server exited')
  })
  this.metricsTimer = setInterval(this.bind(this.pollMetrics, this), settings.metricInterval);
  
  return {};
}

module.exports = Daemon;