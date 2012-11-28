var _ = require('underscore');
var async = require('async');
var joi = require('joi');
var qs = require('querystring');
var request = require('request');
var util = require('../support/util');

var N = joi.Types.Number,
    S = joi.Types.String,
    B = joi.Types.Boolean,
    A = joi.Types.Array;
var Flag = S().allow(false).allow(true);

var debug = null; // "global" until confirmed that this.debug will work in all references

var Client = function (options, env) {

  debug = this.debug = util.debug(env.DEBUG);
  
  debug('args', options);
  this.options = _.extend({}, this._defaultOptions, options);
  env = env || {};
  this.payload = null;
  
  util.mixin(this, require('../support/base'));
  util.mixin(this, require('../support/statistics'));
  
  if (options['<action>'] == 'init') {
    console.log("action=init: not implemented yet")
    return; // TODO: grab flod-webservers
  }
  
  if (options['<action>'] == 'reset') {
    return this.resetBench();
  }
  
  if (options['<action>'] == "clean") {
    return this.cleanLogs();
  }
  
  if (options['<action>'] == "compare" || options['compare'] == true) {
    return this.compare(options['<files>']);
  }
  
  this.processSTDIN(this.bind(this.init, this));
}

Client.prototype._defaultOptions = {
  
}

Client.prototype.init = function (err, payload){
  debug('init', arguments)
  if (err) {
    debug('processSTDIN err', err);
  }
  
  this.payload = payload;
  this.requestCounter = 0;
  this.responseCounter = 0;
  this.latencies = new Array(this.options['-n']);
  
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
  '--logPrefix': S(),
  '--logPath': S(),
  
  'compare': Flag,
  '<files>': A(),
  'rootPath': S() // special case
};


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
    
    // debug(stats, "stats");
    if (stats.info && stats.info.server) {
      self.options.info = stats.info;
    }
    
    self.backupToFile(stats);
    
    self.printStats(stats);
  })
}

Client.prototype.initBench = function (callback) {

  var url = [this.options['--admin'], "bench", "init"].join("/");
  
  var params = {};
  if (typeof this.options['--serverFile'] == "string") {
    params.serverFile = this.options['--serverFile'];
  }
  var paramstr = qs.stringify(params);
  if (paramstr.length > 0) {
    url += "?" + paramstr;
  }
  
  var opts = {
    method: "GET",
    uri: url
  };
  
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
  };
  url += "?" + qs.stringify(params);
  var opts = {
    method: "GET",
    uri: url
  };
  
  debug('registerBench opts', opts);
  
  request(opts, function (err, res, body) {

    if (err) {
      return callback(err);
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
    
    return callback(null);
  });
}

Client.prototype.stopBench = function (callback) {

  debug('#Client.stopBench');
  var url = [this.options['--admin'], "bench", "latencies"].join('/');
  
  var params = {
    id: this.options.id
  };
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
      return callback(err);
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
  };
  url += "?" + qs.stringify(params);
  var opts = {
    method: "GET",
    uri: url
  };
  
  debug('finishBench opts', opts);
  
  request(opts, function (err, res, body) {

    if (err) {
      return callback(err);
    }
    
    try {
      var data = JSON.parse(body);
    } catch (e) {
      debug(body);
      return callback(e);
    }
    
    callback && callback(null, data);
  })
}

Client.prototype.resetBench = function (callback) {

  var url = [this.options['--admin'], "bench", "reset"].join("/");
  
  var params = {
    code: this.options['--code'] || ""
  };
  url += "?" + qs.stringify(params);
  var opts = {
    method: "GET",
    uri: url
  };
  
  debug('resetBench opts', opts);
  
  request(opts, function (err, res, body) {

    if (err) {
      return callback(err);
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
  });

  process.stdin.on('end', function () {
    process.stdin.pause();
    callback(null, new Buffer(buffers.join("")))
  });
  
  setTimeout((function (){
    if (hasData !== true) {
      // No data from STDIN; continue
      process.stdin.pause();
      callback('no data');
    }
  }), 100);
}

Client.prototype.range = function (start, end) {

  var arr = [];
  for (var i = start; start <= end ? i <= end : i >= end; start <= end ? i++ : i--) {
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
  };
  
  debug("#get opts", opts)
  request(opts, function (err, res, body) {
    var end_time = Date.now();
    self.latencies[i] = end_time - start_time;
    self.responseCounter++;
    
    debug('#get request/response/max', self.requestCounter, self.responseCounter, self.options['-n']);
    
    if (err){
      console.log(arguments)
      throw err;
    }
    
    callback(err);
  })
}

Client.prototype.post = function (i, callback) {

  var self = this;
  var i = self.requestCounter;
  self.requestCounter++;
  var start_time = Date.now();
  var opts = {
    method: 'POST',
    uri: self.options['--host'] + "/?id=" + self.options.id,
    body: this.payload
  }
  
  request(opts, function (err, res, body) {

    var end_time = Date.now();
    self.latencies[i] = end_time - start_time;
    self.responseCounter++;
    
    debug('#post request/response/max', self.requestCounter, self.responseCounter, self.options['-n']);
    
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
  
  debug('#Client.bench args, handler', arguments, handler);
  
  async.forEach(this.range(1, concurrents), self.bind(self[handler], self), function (err) {

    if (err) {
      return callback(err);
    }
    
    debug('next bench: ', index+concurrents, concurrents, max)
    self.bench(index + concurrents, concurrents, max, callback);
  })
}

module.exports = Client;