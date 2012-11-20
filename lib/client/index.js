var _ = require('underscore');
var async = require('async');
// var http = require('http');
var request = require('request');
var qs = require('querystring');
var util = require('../support/util');

var debug = null;

var Client = function (options, env) {

  this.options = _.extend({}, this._defaultOptions, options);
  env = env || {};
  this.payload = null;
  
  util.mixin(this, require('../support/base'));
  debug = util.debug(env.DEBUG);
  
  // http.globalAgent.maxSockets = 
  //   http.Agent.defaultMaxSockets = 
  //     this.options.concurrents;
  
  this.processSTDIN(this.bind(this.init, this));
}

Client.prototype._defaultOptions = {
  
}

Client.prototype.init = function(err, payload){
  debug('init', arguments)
  if (err) {
    debug('processSTDIN err', err);
  }
  
  this.payload = payload;
  this.requestCounter = 0;
  this.responseCounter = 0;
  
  if (this.options["--reset"]) {
    this.resetBench();
  }
  
  this.start();
}

Client.prototype.start = function () {

  debug("Client.start()");
  
  async.waterfall([
    this.bind(this.initBench, this),
    this.bind(this.registerBench, this),
    this.bind(this.startBench, this),
    this.bind(this.stopBench, this),
    this.bind(this.finishBench, this)
  ], function (err) {
    if (err) {
      throw err;
    }
    
    // done; clean up if necessary
  })
}

Client.prototype.initBench = function (callback) {

  var url = [this.options['--admin'], 'bench', 'init'].join('/');
  var params = {
    
  }
  url += "?" + qs.stringify(params);
  var opts = {
    method: "GET",
    uri: url
  }
  
  debug('opts', opts);
  
  request(opts, function (err, res, body) {
    if (err) {
      throw err;
    }
    
    try {
      var data = JSON.parse(body);
    } catch (e) {
      debug('initBench body', body)
      throw e;
    }
    
    debug('initBench request uri', opts.uri);
    debug('initBench request response', data);
    
    callback(null)
  })
}

Client.prototype.registerBench = function (callback) {

  var url = [this.options['--admin'], "bench", "start"].join("/"); // TODO
  var params = {
    n: this.options['-n'],
    c: this.options['-c']
  }
  url += "?" + qs.stringify(params);
  var opts = {
    method: "GET",
    uri: url
  };
  
  debug('registerBench opts', opts);
  
  request(opts, function (err, res, body) {
    if (err) {
      return callback(err)
    }
    
    try {
      data = JSON.parse(body);
    } catch (e) {
      return callback(e);
    }
    
    debug('registerBench request uri', opts.uri);
    debug('registerBench request response', data);
    
    callback(null, data);
  })
}

Client.prototype.startBench = function (data, callback) {

  if (data.id == undefined) {
    return callback(data);
  }
  this.options.id = data.id;
  debug("registerBench returned with id = " + data.id);
  
  this.bench(0, this.options['-c'], this.options['-n'], function (err) {
    if (err) {
      return callback(err);
    }
    
    return callback(null)
  })
}

Client.prototype.stopBench = function (callback) {
  debug('finishing bench')
  callback(null);
}

Client.prototype.finishBench = function (response, callback) {

  debug('bench response', response)
  // TODO: upload latency data
  // backup to file
  // print stats? 
  
  return callback(null);
}

Client.prototype.processSTDIN = function (callback) {

  var buffers = [];
  var hasData = false;
  
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', function (chunk) {
    hasData = true;
    buffers.push(chunk);
  })

  process.stdin.on('end', function () {
    process.stdin.pause();
    callback(null, new Buffer(buffers.join("")))
  })
  
  setTimeout((function(){
    if (hasData !== true) {
      // No data from STDIN; continue
      process.stdin.pause();
      callback('no data');
    }
  }), 100);
}

Client.prototype.range = function (start, end) {

  var arr = [];
  for(var i = start; start <= end ? i <= end : i >= end; start <= end ? i++ : i--) {
    arr.push(i);
  }
  return arr;
}

Client.prototype.get = function (i, callback) {

  var self = this;
  var i = self.requestCounter;
  self.requestCounter++;
  var start_time = Date.now();
  var opts = {
    method: 'GET',
    uri: self.options['--host'] + "/?id=" + self.options.id
  }
  
  request(opts, function (err, res, body) {
    var end_time = Date.now();
    // self.latency[i] = end_time - start_time;
    self.responseCounter++;
    
    debug('get request uri', opts.uri);
    debug('get request response', data);
    
    callback(err);
  })
}

Client.prototype.bench = function (index, concurrents, max, callback) {

  var self = this;
  var handler = (self.options.method || "GET").toLowerCase();
  
  debug('Client.bench args', arguments)
  debug('Client.bench started with handler =', handler)
  
  async.forEach(this.range(1, concurrents), self.bind(self[handler], self), function (err) {
    if (err) {
      return callback(err);
    }
    
    self.bench(index + concurrents, concurrents, max, callback);
  })
}

module.exports = Client;