var _ = require('underscore');
var fs = require('fs');
var path = require('path');
var uuid = require('node-uuid');

var Statistics = module.exports = function () {
  
};

Statistics.prototype.initStatistics = function () {

  this.benchmark = null; // stores the current benchmark
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
  
  if (this._startTime !== null) {
    this.benchmark['started'] = this._startTime;
    this._startTime = null;
  }
  
  this.metricsTimer = setInterval(this.bind(this.pollMetrics, this), this.options.metricInterval);
  
  return this.benchmark;
}

Statistics.prototype.unregister = function (id) {

  this.debug('#Statistics.unregister');
  clearInterval(this.metricsTimer);
  if (id == null || 
      (this.benchmark && this.benchmark.id && this.benchmark.id != id)) {
    var msg = "No such benchmark found by that id (" + id + ")";
    this.debug('#Statistics.unregister', msg);
    return msg;
  }
  
  benchmark = this.finalizeData();
  stats = this.statistics(benchmark);
  return stats;
}

Statistics.prototype.statistics = function (data) {

  // TODO: 
  this.debug('#Statistics.statistics');
  return data;
}

Statistics.prototype.finalizeData = function () {

  this.debug('#Statistics.finalizeData');
  var benchmark = this.benchmark;
  this.benchmark = null;
  this.backupToFile(benchmark);
  
  return benchmark;
}


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

  this.debug('#Statistics.onMessage', m.action, m.data);
  var ts = this.now();
  switch (m.action) {
    case 'request':
      return this.aggregate(m.action, ts, m.data);
    case 'mem':
    case 'load':
      return this.record(m.action, ts, m.data);
    case 'started':
      return this._startTime = ts;
    case 'ended':
      return this.set(m.action, ts);
    case 'info':
      console.log('info msg received:', m)
      return this.options.info = m.data;
    default:
      throw "unspecified action supplied to Daemon::Statistics: " + m.action;
  }
}

Statistics.prototype.pollMetrics = function () {

  console.log('#Statistics.pollMetrics')
  if (this.server && this.server.send) {
    console.log('#Statistics.pollMetrics sending')
    this.server.send({
      action: 'mem'
    });
    
    this.server.send({
      action: 'load'
    });
  }
}

///////////////////
// Backup Related
///////////////////

Statistics.prototype.backupFilename = function () {

  this.debug('#Statistics.backupFilename', this.options.info)
  return "bench-" + this.now() + ".json";
}

Statistics.prototype.backupToFile = function (contents) {
  if (contents == null) {
    return;
  }
  
  var backupFilename = path.join(this.options.rootPath || __dirname, this.options.logPath, this.backupFilename());
  // fs.writeFileSync(backupFilename, JSON.stringify(contents));
}

///////////////////
// Math Related
///////////////////

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







