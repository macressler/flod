var _ = require('underscore');
var fs = require('fs');
var joi = require('joi');
var path = require('path');
var Table = require('cli-table');
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
  // return Date.now();
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
  this.debug('#register benchmark set');
  
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
  joi.validate(o, this._optionsSchema, function (err) {
    if (err) {
      throw err;
    }
    
    // self.debug('options after validate', o);
    
    self.options = o; // Save validated options
    
    callback && callback(null);
  })
};


Statistics.prototype.unregister = function (id) {

  this.debug('#Statistics.unregister');
  clearInterval(this.metricsTimer);
  this.set('ended', Date.now());
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
  this.debug("#unregister stats done");
  return stats;
};


Statistics.prototype.statistics = function (data) {

  this.debug('#Statistics.statistics');
  data.info = this.options.info;
  return data;
};


Statistics.prototype.finalizeData = function () {

  this.debug('#Statistics.finalizeData');
  var benchmark = this.benchmark;
  this.benchmark = null;
  this.backupToFile(benchmark);
  
  return benchmark;
};


Statistics.prototype.calcStats = function (stats) {

  if (!stats) {
    throw "Statistics#calcStats requires valid input object";
  }
  
  var result = {};
  
  if (stats.request) {
    result.rps = {
      name: "Requests Per Second",
      arr: Object.keys(stats.request).map(function (d){ return stats.request[d]})
    };
  }
  
  if (stats.latencies) {
    result.lat = {
      name: "Latencies",
      arr: stats.latencies
    };
  }
  
  if (stats.mem) {
    result.mem = {
      name: "RSS Memory",
      arr: Object.keys(stats.mem).map(function (d){ return stats.mem[d].rss})
    };
  }
  
  if (stats.load) {
    result.load = {
      name: "CPU Load Avg",
      arr: Object.keys(stats.load).map(function (d){ return stats.load[d][0]})
    };
  }
  
  var keys = Object.keys(result);
  var fns = this.mathFunctions;
  for (var stat in keys){
    var key = keys[stat];
    for (var f in fns){
      if (result[key] && result[key].arr) {
        result[key][fns[f]] = this[fns[f]](result[key].arr);
      }
    }
  }
  
  result['benchmark'] = stats.info.server;
  if (stats.info.version) {
    result['benchmark'] +=  "@" + stats.info.version;
  }
  result['runtime'] = ((parseInt(stats.ended) - parseInt(stats.started))/1000).toFixed(2);
  result['file'] = stats.info.file;
  result['totalReq'] = stats.query.n;
  result['concReq'] = stats.query.c;
  
  // console.log('result', result);
  return result;
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
};


Statistics.prototype.record = function (action, ts, data) {

  if (this.benchmark == null) {
    return null;
  }
  
  if (!this.benchmark.hasOwnProperty(action)) {
    this.benchmark[action] = {};
  }
  
  return this.benchmark[action][ts] = data;
};


Statistics.prototype.set = function (action, data) {

  if (this.benchmark == null) {
    return null;
  }
  
  return this.benchmark[action] = data;
};


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
      return this._startTime = Date.now();
    // case 'ended':
    //   return this.set(m.action, ts);
    case 'info':
      console.log('info msg received:', m)
      return this.options.info = m.data;
    default:
      throw "unspecified action supplied to Daemon::Statistics: " + m.action;
  }
};


Statistics.prototype.pollMetrics = function () {

  if (this.server && this.server.send) {
    this.server.send({
      action: 'mem'
    });
    
    this.server.send({
      action: 'load'
    });
  }
};


///////////////////
// STDOUT Related
///////////////////

Statistics.prototype._tableDataFns = {
  ' ': {
    delta: false,
    // get: function (data, files, index){ return files[index].ended + ".json"}
    get: function (data, files, index){ return [files[index].info.server, "@", files[index].info.version].join("") + " (.." + files[index].ended.toString().slice(-4) + ".json)"  || 'n/a'; }
  },
  "total/conc": {
    delta: false,
    get: function (data){ return [data.totalReq, data.concReq].join('/') || 'n/a'; }
  },
  "runtime": {
    get: function (data){ return data.runtime || 'n/a'; },
  },
  "avg rps": {
    get: function (data){ return data.rps && data.rps.mean || 'n/a'; },
  },
  "avg lat": {
    get: function (data){ return data.lat && data.lat.mean || 'n/a'; },
  },
  "avg mem": {
    get: function (data){ return data.mem && data.mem.mean || 'n/a'; },
  },
  "avg load": {
    get: function (data){ return data.load && data.load.mean || 'n/a'; },
  },
};


Statistics.prototype.compare = function (filenames) {

  this.debug('#Statistics.compare', filenames);
  var self = this;
  var files = filenames.map(function (d) { 
    var output = JSON.parse(fs.readFileSync(path.join(self.options.rootPath, d)).toString());
    return output;
  })
  
  console.log("\nComparing benchmarks:");
  console.log("=====================");
  
  // labels
  var table = [
    [' '],
    ['total/conc'],
    ['runtime'],
    ['avg rps'],
    ['avg lat'],
    ['avg mem'],
    ['avg load'],
  ];
  
  var rows = table.length - 1;
  
  for (var f in files){
    var filename = filenames[f];
    var data = this.calcStats(files[f]);
    
    // table[0].push([data.info.server, "@", data.info.version, "-", data.info.file].join(""));
    for (var i = 0; i <= rows; ++i){
      table[i].push(this._tableDataFns[table[i][0]].get(data, files, f));
    }
    
    
    if (+f > 0) {
      // this.debug("+f+1", "1", "current", "dependent");
      for (var i = 2; i <= rows; i++){
        var current = parseFloat(table[i][+f+1]);
        var dependent = parseFloat(table[i][1]);
        
        if (this._tableDataFns[table[i][0]].delta !== false && !isNaN(current)) {
          var delta = current - dependent;
          
          var clr = "red";
          var arrow = "⧩"[clr];
          if (delta >= 0) {
            clr = "blue";
            arrow = "▴"[clr];
          }
          table[i][+f+1] = current + " (" + arrow + " " + delta.toFixed(2)[clr] + ")";
        }
      }
    }
  }
  
  // Print Table
  var t = new Table({
    head: table[0],
  })
  t.push.apply(t, table.slice(1));
  console.log(t.toString());
};


Statistics.prototype.printStats = function (stats) {

  var result = this.calcStats(stats);
  
  console.log("\nBenchmark (" + result.benchmark + ") ran " + result.totalReq + " requests (" + result.concReq + " concurrently) in " + result.runtime + " seconds.");
  
  var keys = Object.keys(result);
  var fns = this.mathFunctions;
  for (var stat in keys){
    var key = keys[stat];
    
    if (result[key] && result[key].arr) {
      console.log('\n' + result[key].name);
      for (var f in fns){
        console.log('\t' + fns[f] + " =", result[key][fns[f]]);
      }
    }
  }
};


///////////////////
// Backup Related
///////////////////

Statistics.prototype.backupFilename = function () {

  this.debug('#Statistics.backupFilename', this.options.info);
  return [this.options['--logPrefix'] || "bench", this.options.info.server, this.options.info.version, this.options.info.file, this.now()].join('-') + ".json";
};


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
};


Statistics.prototype.cleanLogs = function () {

  var dir = path.join(this.options.rootPath || __dirname, this.options['--logPath']);
  var files = fs.readdirSync(dir).filter(function (d) { 
    return d.indexOf('.json') >= 0; 
  });
  for (var i in files){
    fs.unlinkSync(path.join(dir, files[i]));
  }
};


///////////////////
// Math Related
///////////////////

Statistics.prototype.mathFunctions = ["min", "max", "mean", "median", "stdDev"];


Statistics.prototype.min = function (arr) {

  return Math.min.apply(this, arr);
};


Statistics.prototype.max = function (arr) {

  return Math.max.apply(this, arr);
};


Statistics.prototype.mean = function (arr) {

  return arr.reduce(function (a, b) { return a + b; }) / arr.length;
};


Statistics.prototype.median = function (arr) {

  var sortedArr = arr.slice(0).sort(function (a, b){ return a - b; });
  var midpoint = (sortedArr.length / 2) >> 0;
  
  if (sortedArr.length % 2 == 1) {
    return sortedArr[midpoint];
  }
  else {
    return this.mean([sortedArr[midpoint - 1], sortedArr[midpoint]]);
  }
};


Statistics.prototype.stdDev = function (a) {

  var arr = a.slice(0);
  var arrMean = this.mean(arr);
  var differences = arr.map(function (d){
    return +(Math.pow(d - arrMean, 2)).toFixed(2);
  });
  var sumDiff = differences.reduce(function (a,b) { return a + b; });
  var variance = (1 / (arr.length - 1)) * sumDiff;
  sdev = Math.sqrt(variance);
  return sdev;
};