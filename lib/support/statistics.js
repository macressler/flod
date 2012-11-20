var _ = require('underscore');
var fs = require('fs');
var joi = require('joi');
var path = require('path');
var uuid = require('node-uuid');

var Statistics = module.exports = function () {
  
};

Statistics.prototype.initStatistics = function () {

  this.benchmark = null; // stores the current benchmark
  this.benchmarks = [];  // stores recent benchmarks
  this._startTime = null; // stores start time while other code might still be starting up
};

Statistics.prototype.now = function () {

  return Date.now() / 1000 >> 0;
};

Statistics.prototype.register = function (query) {

  this.debug('#Statistics.register');
  var id = query.id || uuid.v4();
  if (this.benchmark !== null) {
    var msg = "Benchmark in progress, please wait until finished";
    this.debug('#register', msg);
    return msg;
  }
  
  delete query.id;
  this.benchmark = {
    id: id,
    query: query
  };
  this.debug('#register benchmark set')
  
  if (this._startTime !== null) {
    this.benchmark['started'] = this._startTime;
    this._startTime = null;
  }
  
  this.metricsTimer = setInterval(this.bind(this.pollMetrics, this), this.options['--metricInterval']);
  
  return this.benchmark;
}

Statistics.prototype.validateOptions = function (callback) {

  var o = _.clone(this.options);
  var self = this;
  
  joi.settings.saveConversions = true;
  joi.settings.skipFunctions = true;
  
  // debug('this.options before joi.validate', this.options)
  joi.validate(o, this._optionsSchema, function(err) {
    if (err) {
      throw err;
    }
    
    // self.debug('options after validate', o);
    
    self.options = o; // Save validated options
    
    callback && callback(null);
  })
}

Statistics.prototype.unregister = function (id) {

  this.debug('#Statistics.unregister');
  clearInterval(this.metricsTimer);
  this.set('ended', this.now());
  if (id == null || 
      (this.benchmark && this.benchmark.id && this.benchmark.id != id)) {
    var msg = "No such benchmark found by that id (" + id + ")";
    this.debug('#Statistics.unregister', msg);
    return msg;
  }
  
  if (this._startTime !== null) {
    this.benchmark['started'] = this._startTime;
    this._startTime = null;
  }
  
  this.debug('#unregister before finalizeData');
  var benchmark = this.finalizeData();
  this.debug('#unregister after finalizeData');
  var stats = this.statistics(benchmark);
  this.debug("#unregister stats done")
  return stats;
}

Statistics.prototype.statistics = function (data) {

  this.debug('#Statistics.statistics');
  data.info = this.options.info;
  return data;
}

Statistics.prototype.finalizeData = function () {

  this.debug('#Statistics.finalizeData');
  var benchmark = this.benchmark;
  this.benchmark = null;
  this.backupToFile(benchmark);
  
  // return this.benchmarks[this.benchmarks.length-1];
  return benchmark;
}

Statistics.prototype.calcStats = function (stats) {

  var result = {
    'rps': {
      name: "Requests Per Second",
      arr: Object.keys(stats.request).map(function(d){ return stats.request[d]})
    },
    "lat": {
      name: "Latencies",
      arr: stats.latencies
    },
    "mem": {
      name: "RSS Memory",
      arr: Object.keys(stats.mem).map(function(d){ return stats.mem[d].rss})
    },
    "load": {
      name: "CPU Load Avg",
      arr: Object.keys(stats.load).map(function(d){ return stats.load[d][0]})
    }
  };
  
  var keys = Object.keys(result);
  var fns = this.mathFunctions;
  for(var stat in keys){
    var key = keys[stat];
    for(var f in fns){
      if (result[key].arr) {
        result[key][fns[f]] = this[fns[f]](result[key].arr);
      }
    }
  }
  
  result['runtime'] = stats.ended - stats.started;
  result['benchmark'] = stats.info.server + "@" + stats.info.version;
  result['file'] = stats.info.file;
  result['totalReq'] = stats.query.n;
  result['concReq'] = stats.query.c;
  
  return result;
}



Statistics.prototype.printStats = function (stats) {

  var result = this.calcStats(stats);
  
  console.log("\nBenchmark (" + result.benchmark + ") ran " + result.totalReq + " requests (" + result.concReq + " concurrently) in " + result.runtime + " seconds.");
  
  var keys = Object.keys(result);
  var fns = this.mathFunctions;
  for(var stat in keys){
    var key = keys[stat];
    
    if (result[key].arr) {
      console.log('\n' + result[key].name);
      for(var f in fns){
        console.log('\t' + fns[f] + " =", result[key][fns[f]]);
      }
    }
  }
  
  // Backup this for comparisons?
  this.backupToFile(result);
};


Statistics.prototype.aggregate = function (action, ts, id, value) {

  if (value == null) {
    value = 1;
  }
  
  if (this.benchmark == null || this.benchmark.id !== id) {
    return null;
  }
  
  if (!this.benchmark.hasOwnProperty(action)) {
    this.benchmark[action] = {};
  }
  
  if (!this.benchmark[action].hasOwnProperty(ts)) {
    this.benchmark[action][ts] = 0;
  }
  
  return this.benchmark[action][ts] += value;
}

Statistics.prototype.record = function (action, ts, data) {

  if (this.benchmark == null) {
    return null;
  }
  
  if (!this.benchmark.hasOwnProperty(action)) {
    this.benchmark[action] = {};
  }
  
  return this.benchmark[action][ts] = data;
}

Statistics.prototype.set = function (action, data) {

  if (this.benchmark == null) {
    return null;
  }
  
  return this.benchmark[action] = data;
}

Statistics.prototype.onMessage = function (m) {

  // this.debug('#Statistics.onMessage'); //, m.action, m.data);
  var ts = this.now();
  
  switch (m.action) {
    case 'request':
      return this.aggregate(m.action, ts, m.data);
    case 'mem':
    case 'load':
      return this.record(m.action, ts, m.data);
    case 'started':
      return this._startTime = ts;
    // case 'ended':
    //   return this.set(m.action, ts);
    case 'info':
      console.log('info msg received:', m)
      return this.options.info = m.data;
    default:
      throw "unspecified action supplied to Daemon::Statistics: " + m.action;
  }
}

Statistics.prototype.pollMetrics = function () {

  if (this.server && this.server.send) {
    this.server.send({
      action: 'mem'
    });
    
    this.server.send({
      action: 'load'
    });
  }
}

Statistics.prototype.compare = function (files) {

  this.debug('#Statistics.compare', files)
}

///////////////////
// Backup Related
///////////////////

Statistics.prototype.backupFilename = function () {

  this.debug('#Statistics.backupFilename', this.options.info);
  return [this.options['--logPrefix'] || "bench", this.options.info.server, this.options.info.version, this.options.info.file, this.now()].join('-') + ".json";
}

Statistics.prototype.backupToFile = function (contents) {

  this.debug('#backupToFile');
  if (contents == null) {
    this.debug('#backupToFile null contents');
    return;
  }
  
  if (this.options.noBackups == true) {
    this.debug("#backupToFile: options.noBackups set, not saving to disk");
    return;
  }
  
  var backupFilename = path.join(this.options.rootPath || __dirname, this.options['--logPath'], this.backupFilename());
  
  this.debug('will backup to', backupFilename);
  fs.writeFileSync(backupFilename, JSON.stringify(contents));
}

Statistics.prototype.cleanLogs = function () {

  var dir = path.join(this.options.rootPath || __dirname, this.options['--logPath']);
  var files = fs.readdirSync(dir).filter(function(d){ 
    return d.indexOf('.json') >= 0; }
  )
  for(var i in files){
    fs.unlinkSync(path.join(dir, files[i]));
  }
}

///////////////////
// Math Related
///////////////////

Statistics.prototype.mathFunctions = ["min", "max", "mean", "median", "stdDev"];

Statistics.prototype.min = function (arr) {

  return Math.min.apply(this, arr);
}

Statistics.prototype.max = function (arr) {

  return Math.max.apply(this, arr);
}

Statistics.prototype.mean = function (arr) {

  return arr.reduce(function (a, b) { return a + b; }) / arr.length;
}

Statistics.prototype.median = function (arr) {

  var sortedArr = arr.slice(0).sort(function (a, b){ return a - b; });
  var midpoint = (sortedArr.length / 2) >> 0;
  
  if (sortedArr.length % 2 == 1) {
    return sortedArr[midpoint];
  }
  else {
    return this.mean([sortedArr[midpoint - 1], sortedArr[midpoint]]);
  }
}

Statistics.prototype.stdDev = function (a) {

  var arr = a.slice(0);
  var arrMean = this.mean(arr);
  var differences = arr.map(function(d){
    return +(Math.pow(d - arrMean, 2)).toFixed(2);
  });
  var sumDiff = differences.reduce(function (a,b) { return a + b; });
  var variance = (1 / (arr.length - 1)) * sumDiff;
  sdev = Math.sqrt(variance);
  return sdev;
}


