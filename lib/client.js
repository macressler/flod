var _ = require('underscore');
var Async = require('async');
var Cp = require('child_process');
var Cluster = require('cluster');
var Daemon = require('./daemon');
var Fs = require('fs');
var Http = require('http')
var Joi = require('joi');
var Path = require('path');
var Qs = require('querystring');
var Request = require('request');
var Statistics = require('./statistics');
var Table = require('easy-table');
var Url = require('url');
var Util = require('util');

// Joi Validation Presets
var N = Joi.Types.Number,
    S = Joi.Types.String,
    B = Joi.Types.Boolean,
    A = Joi.Types.Array;
var Flag = S().allow(false).allow(true);


Http.globalAgent.maxSockets = 1024;


var Client = function (options, env) {

    var self = this;
    self.options = self.validateOptions(options);
    self.env = env || {};
    
    // TODO: Move instantiations to initialize() once finalized
    self.url = null;
    self._ignoreRemoteData = false;
    self._soloBenchMode = false;
    self._startupMessagePrinted = false;
    self.version = require('../package.json').version;
    self.Math = new Statistics();
    
    self.initialize();
    
    var filename = self.options['<filename_or_url>']
    self.filenames = [];
    
    if (filename instanceof Array) {
        self.filenames = filename;
    }
    else {
        self._soloBenchMode = true;
        self.filenames = [filename];
    }
    
    Async.mapSeries(self.filenames, self.execBench.bind(self), self.printResults.bind(self));
};


Client.prototype._optionsSchema = {
    '<filename_or_url>': A(),
    '--help': Flag,
    '--verbose': Flag,
    '--silent': Flag,
    '--daemon': Flag,
    '--store-responses': B(),
    '--store-data': B(),
    '-m': Flag, // Method
    '-u': Flag, // URI 
    '-p': Flag, // Payload JSON file
    '-f': Flag, // Payload file
    '-l': Flag, // Log file
    '-o': Flag, // Output file
    '-C': Flag, // Cookies (keyvalue pairs)
    
    '-n': N(), // Number of requests per batch
    '-c': S().regex(/(\d+\.\.\d+|\d+)/), // Range of concurrent requests to attempt per batch format: n..m
    '-i': N(), // Concurrent increment between batch endpoints
    '-z': N(), // Metric Interval
    
    '--host': S(),
    '--port': N(),
    '--https': B(),
    
    'rootPath': S(),
    '<url>': S().allow(false).allow(null).allow(true)
};


Client.prototype.validateOptions = function (options) {

    var o = _.clone(options);
    
    Joi.settings.saveConversions = true;
    Joi.settings.skipFunctions = true;
    
    var err = Joi.validate(o, this._optionsSchema);
    if (err) {
        throw "Invalid Option(s):  " + err._errors.map(function(d){ return d.path; });
    }
    
    return o;
};


Client.prototype.initialize = function () {

    this.payload = null;
    this._log = [];
    this.batchData = {};
    
    this.silentMode = this.options['--silent'];
    
    if (this.options['-p']) { // payload file
        this.payload = Fs.readFileSync(this.options['-p']).toString();
    }
    
    if (this.options['-f']) {
        this.payloadFile = Fs.readFileSync(this.options['-f']); // as buffer
    }
    
    if (this.options['-C']) { // cookie jar file
        this.cookiejar = Fs.readFileSync(this.options['-C']).toString();
    }
    
    // Handle cleanup
    process.on("SIGINT", this.bind(this.cleanup, this));
    process.on('uncaughtException', this.bind(this.cleanup, this));
};


Client.prototype.isURL = function (str) {

    return (str.indexOf('http') == 0);
};


Client.prototype.getAdminURL = function (uriPath) {

    var url = this.url;
    uriPath = uriPath || '/start';
    
    url = [url.protocol, '//', url.hostname, ':', (+url.port + 1), uriPath, "?metricInterval=" + this.options['-z']].join('');
    return url;
};


Client.prototype.log = function () {

    if (this.env.DEBUG || !this.silentMode) {
        console.log.apply(null, arguments);
    }
    else {
        this._log.push(Array.prototype.slice.apply(arguments).shift(Date.now()).join(' '));;
    }
};


Client.prototype.debug = function () {

    if (this.env.DEBUG) {
        console.log.apply(null, arguments);
    }
};


Client.prototype.execBench = function (filename, callback) {

    var self = this;
    if (self.isURL(filename)) {
        self.url = Url.parse(filename);
        self.remoteBench(filename, callback);
    }
    else {
        self.localBench(filename, callback);
    }
};


Client.prototype.printStartupMessage = function () {

    var self = this;
    if (!self._startupMessagePrinted) {
        self._startupMessagePrinted = true;
        
        // Startup messages
        self.log('This is Flod, version ' + self.version);
        self.log('Copyright 2013 Walmart, http://github.com/spumko/flod');
        self.log('\nBenchmarking (hold on)...\n');
    }
};


Client.prototype.printResults = function (err, batchData) {

    if (err) {
        throw err;
    }
    
    var self = this;
    var ts = Date.now();
    
    self.debug("=============");
    self.debug('batchData:')
    self.debug(JSON.stringify(batchData, null, 2));
    self.debug("=============");
    
    var rows = [];
    var fuzzyByteFormat = function (value) {

        if (value >= 1000000000) {
            return Math.floor(value / 1000000000).toString() + "G"
        }
        else if (value >= 1000000) {
            return Math.floor(value / 1000000).toString() + "M"
        }
        else if (value >= 1000) {
            return Math.floor(value / 1000).toString() + "K"
        }
        else {
            return value;
        }
    };
    
    
    self.filenames.forEach(function (filename, index) {

        var data = batchData[index];
        var info = data.info;
        Object.keys(data).filter(function(d){ return !isNaN(+d);}).forEach(function (rps, jIndex) {

            var row = {
                server: info.server || filename,
                rps: rps,
                latency: '',
                mem: '',
                load: ''
            }
            if (data[rps].latencies) {
                row.latency = self.Math.mean(data[rps].latencies).toFixed(2) + " ± " + self.Math.stdDev(data[rps].latencies).toFixed(2);
            }
            if (data[rps].metrics) { // remoteBench with flod probe support
                if (data[rps].metrics.mem) {
                    var mem = Object.keys(data[rps].metrics.mem).map(function(d){return data[rps].metrics.mem[d].rss;});
                    row.mem = fuzzyByteFormat(self.Math.mean(mem)) + " ± " + fuzzyByteFormat(self.Math.stdDev(mem));
                }
                if (data[rps].metrics.load) {
                    var load = Object.keys(data[rps].metrics.load).map(function(d){return data[rps].metrics.load[d][0];});
                    row.load = self.Math.mean(load).toFixed(2) + " ± " + self.Math.stdDev(load).toFixed(2);
                }
            }
            
            rows.push(row);
        });
    });
    
    // Output to file
    var outputPath = self.options['-o'] || '/tmp/';
    var filename = ts + '-' + process.pid + ".json";
    if (outputPath[0] !== '/') {
        outputPath = Path.join(self.options.rootPath, outputPath);
    }
    
    // Pretty Print Rows
    var t = new Table;
    rows.forEach(function (r) {

        t.cell('Server', r.server);
        t.cell('Requests/sec', r.rps);
        t.cell('Latency', r.latency);
        t.cell('Memory', r.mem);
        t.cell('Load', r.load);
        t.newRow();
    });
    
    self.log(t.toString());
    
    if (self.options['--store-data']) {
        var writePath = Path.join(outputPath, filename);
        Fs.writeFileSync(writePath, JSON.stringify(batchData));
        console.log("Data written to " + writePath);
    }
    
    // // Output info table
    // var colWidth = 25;
    // var padRight = function (str, width, pad) {

    //     if (isNaN(width)) {
    //         throw 'width (' + width + ') is not a number';
    //     }
    //     pad = pad || ' ';
        
    //     return (str + (new Array(width)).join(pad)).slice(0, width);
    // };
    
    // var defaultInfo = {
    //     server: ''
    // };
    // var info = _.extend(defaultInfo, self.batchData.info || {});
    
    // var totalNumReqs = Object.keys(self.batchData).map(function (key) {

    //     if (self.batchData[key] && self.batchData[key].responseCounter) { 
    //         return self.batchData[key].responseCounter; 
    //     }
    // }).filter(function(d){ return !!d; }).reduce(function(a,b){ return a + b; });
    
    // var properties = [
    //     ['Server:', info.server || ''],
    //     ['Hostname:', self.url.hostname],
    //     ['Port:', self.url.port],
    //     ['Path:', self.url.path],
    //     ['Total # Responses', totalNumReqs],
    //     ['Total Duration:', ((info.endTime - info.startTime) / 1000).toFixed(2) + " seconds"]
    // ];
    // properties.forEach(function (prop) {

    //     self.log([padRight(prop[0], colWidth), padRight(prop[1], colWidth)].join(""));
    // });
    
    
    // self.batchTable = {};
    // self.batchMeta = {
    //     head: ['Requests per sec']
    // };
    
    // var labeled = {};
    
    // Object.keys(self.batchData).forEach(function (key) {

    //     if (isNaN(+key)) {
    //         return;
    //     }
        
    //     // var duration = (self.batchData.info.endTime - self.batchData.info.startTime) / 1000;
    //     self.batchTable[key] = {};
        
    //     var defaultFormatter = function (value) { return value.toFixed(2); };
    //     var fuzzyByteFormat = function (value) {

    //         if (value >= 1000000000) {
    //             return Math.floor(value / 1000000000).toString() + "G"
    //         }
    //         else if (value >= 1000000) {
    //             return Math.floor(value / 1000000).toString() + "M"
    //         }
    //         else if (value >= 1000) {
    //             return Math.floor(value / 1000).toString() + "K"
    //         }
    //         else {
    //             return value;
    //         }
    //     }
        
    //     if (!self._ignoreRemoteData) {
    //         var columns = [
    //             // label, array data, units
    //             ['latency', self.batchData[key].latencies, 'ms'],
    //             ['memory', Object.keys(self.batchData[key].metrics.mem).map(function(d){return self.batchData[key].metrics.mem[d].rss;}), 'bytes', fuzzyByteFormat],
    //             ['load', Object.keys(self.batchData[key].metrics.load).map(function(d){return self.batchData[key].metrics.load[d][0];})]
    //         ];
    //     }
    //     else {
    //         var columns = [
    //             ['latency', self.batchData[key].latencies, 'ms']
    //         ];
    //     }
        
    //     columns.forEach(function (col) {

    //         var format = col[3] || defaultFormatter;
    //         self.batchTable[key][col[0]] = {};
    //         self.batchTable[key][col[0]].mean = format(self.Math.mean(col[1]));
    //         self.batchTable[key][col[0]].sdev = format(self.Math.stdDev(col[1]));
            
    //         // Add to table head once
    //         labeled[col[0]] = labeled[col[0]] || false;
    //         if (labeled[col[0]] === false) {
    //             labeled[col[0]] = true;
    //             var headCols = ['Avg', col[0]];
    //             if (col[2]) {
    //                 headCols.push('(' + col[2] + ')');
    //             }
    //             self.batchMeta.head.push(headCols.join(" "));
    //         }
    //     });
    // });

    // // Output to Stdout
    // var head = self.batchMeta.head.map(function (label) {

    //     return padRight(label, colWidth);
    // }).join("");
    // self.log('\n' + head);
    
    // Object.keys(self.batchTable).forEach(function (rps) {

    //     var row = [
    //         padRight(rps, colWidth),
    //         padRight(self.batchTable[rps].latency.mean + ' ± ' + self.batchTable[rps].latency.sdev, colWidth)
    //     ];
    //     if (!self._ignoreRemoteData) {
    //         row.push(padRight(self.batchTable[rps].memory.mean + ' ± ' + self.batchTable[rps].memory.sdev, colWidth));
    //         row.push(padRight(self.batchTable[rps].load.mean + ' ± ' + self.batchTable[rps].load.sdev, colWidth));
    //     }
    //     self.log(row.join(""));
    // });
    
    // // Output File
    // var outputPath = self.options['-o'];
    // if (outputPath[0] !== '/') {
    //     outputPath = Path.join(self.options.rootPath, outputPath);
    // }
    
    // var filename = info.server + '-' + ts + '-' + process.pid + ".json";
    // if (!self.options['--store-responses']) {
    //     Object.keys(self.batchData).forEach(function (key) {

    //         if (self.batchData[key].responses){
    //             delete self.batchData[key].responses;
    //         }
    //     });
    // }
    // if (self.options['--store-data']) {
    //     Fs.writeFileSync(Path.join(outputPath, filename), JSON.stringify(self.batchData));
    // }
    
    
    // // Log file
    // if (self.options['--daemon']) { 
    //     var logPath = self.options['--daemon'];
    //     if (logPath[0] !== '/') {
    //         logPath = Path.join(self.options.rootPath, logPath);
    //     }
    //     Fs.writeFileSync(Path.join(logPath, filename), self._log.join('\n'));
    // }
}


Client.prototype.remoteBench = function (filename, callback) {

    var self = this;
    
    // Check output path
    if (this.options['-o']) { // output file
        var self = this;
        if (this.options['-o'][0] !== '/') {
            this.options['-o'] = Path.join(this.options.rootPath, this.options['-o']);
        }
        // TODO: make this synchronous
        Fs.lstat(this.options['-o'], function(err, stats) {

            if (!err && stats.isDirectory()) {
                // Folder exists
            }
            else {
                // throw "No such outputpath folder found: " + self.options['-o'];
                Fs.mkdirSync(self.options['-o']);
                self.log('[Warn]: created output path folder (' + self.options['-o'] + ')');
            }
        });
    }
    
    // Split into Batches
    self.concurrentStart = self.options['-c'];
    self.concurrentEnd = self.options['-c'];
    self.concurrentIncrement = (+self.options['-i']);
    
    if (self.options['-c'].indexOf('..') > 0) {
        var concSplit = self.options['-c'].split('..');
        self.concurrentStart = +concSplit[0];
        self.concurrentEnd = +concSplit[1];
        
        if (self.concurrentEnd < self.concurrentStart) {
            throw "Concurrents x..y: y cannot be less than x";
        }
    }
    else {
        self.concurrentStart = +self.concurrentStart;
        self.concurrentEnd = +self.concurrentEnd;
    }
    self.numBatches = Math.ceil((self.concurrentEnd - self.concurrentStart) / self.concurrentIncrement) + 1;
    
    var executeBatch = function (i, cb) {

        // Identify current batch w/ concurrent requests per second to attempt
        self.currentBatch = self.concurrentStart + (i * self.concurrentIncrement);
        
        // Initialize batch data
        self.batchData[self.currentBatch] = {};
        self.batchData[self.currentBatch].metrics = null;
        self.batchData[self.currentBatch].responses = {};
        self.batchData[self.currentBatch].requestCounter = 0;
        self.batchData[self.currentBatch].responseCounter = 0;
        self.batchData[self.currentBatch].latencies = new Array(this.options['-n']);
        
        if (self.options['--store-responses']) {
            self.batchData[self.currentBatch].responses = new Array(this.options['-n']);
        }
        
        // Execute Batch
        Async.waterfall([
            self.bind(self.startBench, self),
            // self.bind(self.sleep, self),
            self.bind(self.bench, self),
            self.bind(self.finishBench, self)
        ], function (err, stats) {

            if (err) {
                self.debug('waterfall err', err, stats)
                throw err;
            }
            
            // Store Batch data
            if (!self._ignoreRemoteData) {
                self.batchData[self.currentBatch].metrics = stats;
                self.batchData.info = stats.info;
                delete self.batchData[self.currentBatch].metrics.info;
            }
            
            cb();
        });
    };
    
    self.printStartupMessage();
    
    // Execute Batches
    Async.timesSeries(self.numBatches, executeBatch.bind(self), function(err){

        // Copy data to prevent overwrite due to pass by reference
        var batchDataSlice = self.batchData;
        self.batchData = {};
        
        return callback(err, batchDataSlice);
    });
};


Client.prototype.sleep = function (callback, sleepTime) {

    sleepTime = sleepTime || 1000;
    
    setTimeout((function () {

        callback();
    }), sleepTime);
};


// If benchmark client is interrupted, let the server daemon know
Client.prototype.cleanup = function (err) {

    var self = this;
    if (err) {
        self.log(err);
    }
    
    if (!this._finishedBench) {
        self.debug('interrupted, sending finishBench request');
        this.finishBench(function(){

            process.exit(1);
        });
    }
    else {
        process.nextTick(function(){
            process.exit(1);
        });
    }
};


Client.prototype.startBench = function (callback) {

    var self = this;
    var req = {
        method: 'GET',
        uri: self.getAdminURL('/start')
        // pool: {maxSockets: 8}
    };
    self._finishedBench = false;
    self.debug("startBench");
    self.debug(["doing batch", self.currentBatch].join(" "));
    
    Request(req, function (err, res, body) {

        if (err) {
            self.debug('startBench err', err)
            self._ignoreRemoteData = true;
            self.debug('[WARN]: server does not support flod.probe metrics, ignoring mem/cpu data')
            return callback();
        }
        self.debug('/start called', req);
        
        var data = body;
        if (res.headers['content-type'].indexOf('application/json;') == 0) {
            try {
                data = JSON.parse(body);
            }
            catch (e) {
                self.log.push("Error parsing JSON from startBench: " + e); // TODO: replace with something better
            }
        }
        
        self.debug('started at', data);
        return callback(err);
    });
};


Client.prototype.bench = function (callback) {

    var self = this;
    var concurrents = self.currentBatch; // targeted # of requests per second
    var max = +self.options['-n'];
    var waves = Math.ceil(max / concurrents);
    self.batchData.info = self.batchData.info || {};
    self.batchData.info.startTime = Date.now();
    self.debug("starting .bench")
    
    var handler = function (i, cb) {

        self.debug(['\thandler', i*concurrents, concurrents, max].join(" "));
        var start = Date.now();
        var shortcircuited = false;
        
        var timer = setTimeout((function () {

            shortcircuited = true;
            cb('could not maintain ' + concurrents + ' requests per second');
        }), 1500);
        
        self._bench(i * concurrents, concurrents, max, function (err) {

            clearTimeout(timer);
            if (err) {
                self.debug('.bench err', err)
                return !shortcircuited && cb(err);
            }
            
            var end = Date.now();
            var elapsed = (end - start);
            self.debug(['\t'+elapsed, "ms elasped for wave", i, end, start, self.batchData[self.currentBatch].latencies.length].join(" "));
            if (elapsed >= 1000) {
                return !shortcircuited && cb(err);
            }
            else {
                setTimeout((function(){
                    !shortcircuited && cb(err);
                }), 1000 - elapsed);
            }
        });
    };
    
    Async.timesSeries(waves, self.bind(handler, self), function (err) {

        self.batchData.info.endTime = Date.now();
        return callback(err);
    });
};


// This function attempts to maintain `concurrents` # of requests per seconds
Client.prototype._bench = function (index, concurrents, max, callback) {

    if (!concurrents || isNaN(concurrents)) return callback('invalid concurrents value to _bench()');
    if (!max || isNaN(max)) return callback('invalid max value to _bench()');
    if (index > (max - concurrents)) return callback(null);

    var self = this;
    var handler = self._request(self.options['-m'], self.url.href, index);
    
    Async.times(concurrents, self.bind(handler, self), function (err) {

        return callback(err);
    });
};


Client.prototype._request = function (method, uri, index) {

    var self = this;
    index = index || 0;
    var req = {
        method: method,
        uri: uri
        // pool: {maxSockets:8}
    };
    
    // Add Payload
    if (method == 'POST' || method == 'PUT') {
        if (this.payloadFile) {
            req.body = this.payloadFile;
        }
        else if (this.payload) {
            req.json = this.payload;
        }
        else {
            req.body = "";
        }
    }
    
    // Add Cookies
    if (self.options['-C']) { 
        var cookies = Fs.readFileSync(self.options['-C']).toString().split('\n');
        var jar = Request.jar();
        cookies.forEach(function (cookie) {

            jar.add(cookie);
        });
        req.jar = jar;
    }
    
    return function (i, callback) {

        var start_time = Date.now();
        self.batchData[self.currentBatch].requestCounter++;
        // var timelimit = self.options['-t'];
        var reqno = i+index;
        
        // timeouts[reqno] = setTimeout((function(){

        //     if (self.latencies[reqno] == null) {
        //         return callback("Request #" + reqno + " timed out.");
        //     }
        // }), timelimit);
        
        self.debug('\t' + req.method.toUpperCase(), req.uri, Date.now());
        Request(req, function (err, res, body) {

            if (err) {
                self.debug('_request err', err, req, res, i);
                return callback(err);
            }
            // clearTimeout(timers[reqno]);
            
            var end_time = Date.now();
            self.batchData[self.currentBatch].latencies[reqno] = end_time - start_time;
            self.batchData[self.currentBatch].responseCounter++;
            
            // var bodyStringified;
            // try {
            //     bodyStringified = JSON.stringify(body);
            // }
            // catch (e){
            //     // do nothing
            // }
            
            // if (bodyStringified) {
            //     body = bodyStringified;
            // }
            
            self.batchData[self.currentBatch].responses[reqno] = body;
            
            return callback(err);
        });
    }
}


Client.prototype.finishBench = function (callback) {

    var self = this;
    if (self._ignoreRemoteData) {
        return callback(null);
    }
    
    var req = {
        method: 'GET',
        uri: this.getAdminURL('/finish')
    };
    
    Request(req, function (err, res, body) {

        self._finishedBench = true;
        self.debug('/finish called');
        if (err) {
            self.debug('finishBench err', err);
            return callback(err);
        }
        
        var data = body;
        if (res.headers['content-type'].indexOf('application/json;') == 0) {
            try {
                data = JSON.parse(body);
            }
            catch (e) {
                self.log.push("Error parsing JSON from finishBench: " + e); // TODO: use levels.WARN or similar
            }
        }
        
        return callback(null, data);
    });
};


Client.prototype.localBench = function (filename, callback) {

    var self = this;
    var protocol = (this.options['--https'] ? 'https:' : 'http:');
    this.url = {
        protocol: protocol,
        slashes: true,
        auth: null,
        host: this.options['--host'] + ':' + this.options['--port'],
        port: this.options['--port'],
        hostname: this.options['--host'],
        hash: null,
        search: null,
        query: null,
        pathname: this.options['-u'],
        path: this.options['-u'],
        href: [protocol, '//', this.options['--host'], ':', this.options['--port'], this.options['-u']].join("")
    };
    
    var settings = {
        filename: filename,
        hostname: this.options['--host'],
        port: this.options['--port'],
        metricInterval: this.options['-z'],
        rootPath: this.options.rootPath
    };
    
    self.daemon = new Daemon(settings, self.env);
    self.daemon.admin.start(function () {

        self.debug('server started on port ' + self.daemon.admin.info.port + " at " + Date.now());
        
        if (!self.options['--daemon']) {
            self.remoteBench(filename, function(err, batchData){

                self.daemon && self.daemon.admin.stop();
                process.nextTick(function(){

                    delete self.daemon;
                    self.daemon = null;
                    
                    return callback(err, batchData);
                });
            });
        }
    });
};


Client.prototype.bind = function (fn, self) {

    return function () {

        return fn.apply(self, arguments);
    };
};


module.exports = Client;