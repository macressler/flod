var _ = require('underscore');
var async = require('async');
// var http = require('http');
var joi = require('joi');
var qs = require('querystring');
var request = require('request');
var util = require('../support/util');

var debug = null;

var N = joi.Types.Number,
    S = joi.Types.String,
    B = joi.Types.Boolean;
var Flag = S().allow(false).allow(true);

var Client = function (options, env) {

  debug = this.debug = util.debug(env.DEBUG);
  
  debug('args', options);
  this.options = _.extend({}, this._defaultOptions, options);
  env = env || {};
  this.payload = null;
  
  util.mixin(this, require('../support/base'));
  util.mixin(this, require('../support/statistics'));
  
  
  debug('client.options', this.options);
  
  // http.globalAgent.maxSockets = 
  //   http.Agent.defaultMaxSockets = 
  //     this.options.concurrents;
  
  if (options['<action>'] == 'init') {
    console.log("action=init: not implemented yet")
    return; // TODO: grab flod-webservers
  }
  
  if (options['<action>'] == 'reset') {
    return this.resetBench();
  }
  
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
  this.latencies = new Array(this.options['-n']);
  
  // if (this.options["--reset"]) {
  //   this.resetBench();
  // }
  
  this.validateOptions();
  debug("this.options after validate line", this.options);
  
  this.start();
}



Client.prototype._optionsSchema = {
  '--help': Flag,
  '--verbose': Flag,
  '--version': Flag,
  '-n': N(),
  '-c': N(),
  '--host': S(),
  '--admin': S(),
  '--serverFile': Flag,
  '--reset': Flag,
  '<action>': S().allow(null),
};

Client.prototype.validateOptions = function (callback) {

  var o = _.clone(this.options);
  var self = this;
  
  joi.settings.saveConversions = true;
  joi.settings.skipFunctions = true;
  
  debug('this.options before joi.validate', this.options)
  joi.validate(o, this._optionsSchema, function(err) {
    if (err) {
      throw err;
    }
    
    debug('options after validate', o);
    
    self.options = o; // Save validated options
    
    callback && callback(null);
  })
}

Client.prototype.start = function () {

  debug("Client.start()");
  var self = this;
  
  async.waterfall([
    this.bind(this.initBench, this),
    this.bind(this.registerBench, this),
    this.bind(this.startBench, this),
    this.bind(this.stopBench, this),
    this.bind(this.finishBench, this)
  ], function (err, stats) {
    if (err) {
      throw err;
    }
    
    debug(stats, "stats");
    
    // done; clean up if necessary
    var min = self.min(self.latencies);
    var max = self.max(self.latencies);
    var mean = self.mean(self.latencies);
    var median = self.median(self.latencies);
    var stddev = self.stdDev(self.latencies);
    
    console.log("Latencies:")
    console.log("\tmin =", min)
    console.log("\tmax =", max)
    console.log("\tmean =", mean)
    console.log("\tmedian =", median)
    console.log("\tstd dev =", stddev)
  })
}

Client.prototype.initBench = function (callback) {

  var url = [this.options['--admin'], "bench", "init"].join("/");
  
  var params = {}
  if (typeof this.options['--serverFile'] == "string" &&
      ( this.options['--serverFile'].indexOf('.js') ||
        this.options['--serverFile'].indexOf('.coffee'))) {
        params.serverFile = this.options['--serverFile'];
  }
  var paramstr = qs.stringify(params);
  if (paramstr.length > 0) {
    url += "?" + paramstr;
  }
  
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

  var url = [this.options['--admin'], "bench", "start"].join("/");
  
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
      var data = JSON.parse(body);
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
  // debug('finishing bench')
  // callback(null);
  var url = [this.options['--admin'], "bench", "latencies"].join('/');
  
  var params = {
    id: this.options.id
  }
  url += "?" + qs.stringify(params);
  var opts = {
    method: "POST",
    uri: url,
    json: {
      latencies: this.latencies
    }
  };
  
  debug('stopBench req uri', opts.uri);
  
  request(opts, function (err, res, body) {
    if (err) {
      return callback(err)
    }
    
    
    var data = body;
    if (typeof data == 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) {
        debug('error body', body)
        return callback(e, null);
      }
      
      if (data.error) {
        return callback('stopBench error: ' + JSON.stringify(data));
      }
    }
    
    debug('stopBench request response', data);
    
    callback(null);
  })
}

Client.prototype.finishBench = function (callback) {

  debug('finishBench arguments', arguments)
  
  var url = [this.options['--admin'], "bench", "finish"].join("/");
  
  var params = {
    id: this.options.id
  }
  url += "?" + qs.stringify(params);
  var opts = {
    method: "GET",
    uri: url
  };
  
  debug('finishBench opts', opts);
  
  request(opts, function (err, res, body) {
    if (err) {
      return callback(err)
    }
    
    try {
      data = JSON.parse(body);
    } catch (e) {
      debug(body);
      return callback(e);
    }
    
    debug('finishBench request response', data);
    
    // backup to file
    
    callback && callback(null, data);
  })
}

Client.prototype.resetBench = function (callback) {

  var url = [this.options['--admin'], "bench", "reset"].join("/");
  
  var params = {
    code: this.options['--code'] || ""
  }
  url += "?" + qs.stringify(params);
  var opts = {
    method: "GET",
    uri: url
  };
  
  debug('resetBench opts', opts);
  
  request(opts, function (err, res, body) {
    if (err) {
      return callback(err)
    }
    
    try {
      var data = JSON.parse(body);
    } catch (e) {
      return callback(e);
    }
    
    debug('resetBench request response', data);
    
    callback && callback(null, data);
  })
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
    self.latencies[i] = end_time - start_time;
    self.responseCounter++;
    
    // debug('get request uri', opts.uri);
    // debug('get request response', data);;
    debug('#get request/response/max', self.requestCounter, self.responseCounter, self.options['-n'])
    
    callback(err);
  })
}

Client.prototype.bench = function (index, concurrents, max, callback) {

  // Validate input
  if (!concurrents || isNaN(concurrents)) return callback('invalid concurrents value');
  if (!max || isNaN(max)) return callback("invalid max value");
  if (index > ( max - concurrents)) return callback(null);

  var self = this;
  var handler = (self.options.method || "GET").toLowerCase();
  
  debug('Client.bench args', arguments)
  debug('Client.bench started with handler =', handler)
  
  async.forEach(this.range(1, concurrents), self.bind(self[handler], self), function (err) {
    if (err) {
      return callback(err);
    }
    
    debug('next bench: ', index+concurrents, concurrents, max)
    self.bench(index + concurrents, concurrents, max, callback);
  })
}

module.exports = Client;