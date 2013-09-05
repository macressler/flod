var Fs = require('fs');
var Hoek = require('hoek');
var Hooks = require('./hooks');
var Os = require('os');
var Semver = require('semver');


// Probe code

var Probe = function (server, meta, options, overrides) {

    // Initialize
    this.meta = meta;
    this.server = server;
    this.options = options || {};
    
    // Bind to server's listen/start & request events
    this.instrument();
    
    // Report data on master process' request
    process.on('message', this.bind(this.onMessage, this));
    
    return this;
};


// Load default instrumentation hooks as static obj/class

Probe.Hooks = new Hooks(); 
// extend at runtime: Probe.Hooks.extend({'myserver': '0.0.0': function(server, send){...}});


Probe.prototype._instrument = function () {

    var hooks = Probe.Hooks.get();
    
    Hoek.assert(hooks.hasOwnProperty(this.meta.server), "Server " + this.meta.server + " is not supported by flod.Probe instrumentation");
    
    var probes = hooks[this.meta.server];
    var matchKey = Semver.maxSatisfying(Object.keys(probes), "<= " + this.meta.version);
    
    Hoek.assert(matchKey, "Server " + this.meta.server + "'s version (" + this.meta.version + ") is not supported by flod.Probe instrumentation");
    
    // TODO: this needs to me moved into server-specific hooks
    // Start hook
    var opsData = {
        server: [this.meta.server, "@", this.meta.version].join(""),
        // host: this.server.settings.host,
        // port: this.server.settings.port,
        os: {
            platform: Os.platform(),
            release: Os.release(),
            arch: Os.arch(),
            totalmem: Os.totalmem()
        }
    };
    if (this.server.settings && this.server.settings.host) {
        opsData['host'] = this.server.settings.host;
    }
    else if (this.server.info && this.server.info.host) {
        opsData['host'] = this.server.info.host;
    }
    else if (this.server.address && this.server.address() && this.server.address().address) {
        opsData['host'] = this.server.address().address;
    }
    else {
        
    }
    
    if (this.server.settings && this.server.settings.port) {
        opsData['port'] = this.server.settings.port;
    }
    else if (this.server.info && this.server.info.port) {
        opsData['port'] = this.server.info.port;
    }
    else if (this.server.address && this.server.address() && this.server.address().address) {
        opsData['port'] = this.server.address().address;
    }
    else {
        
    }
    
    hooks[this.meta.server][matchKey].start(this.options, this.server, this.send, opsData);
    
    this.server.__flodStop = hooks[this.meta.server][matchKey].stop;
    
    return hooks[this.meta.server][matchKey].hook(this.options, this.server, this.send);
};


Probe.prototype.instrument = function () {

    var self = this;
    
    self._instrument(); // Run instr fns specific to server and version
    
    // self.server._startOrig = self.server.listen;
    // self.server.listen = function (port, fn) {

    //     self.server._startOrig(port, function(){

    //         self.send({
    //             action: 'started', 
    //             data: {
    //                 server: [self.meta.server, "@", self.meta.version].join(""),
    //                 host: self.server.settings.host,
    //                 port: self.server.settings.port,
    //                 os: {
    //                     platform: Os.platform(),
    //                     release: Os.release(),
    //                     arch: Os.arch(),
    //                     totalmem: Os.totalmem()
    //                 }
    //             }
    //         });
    //         fn();
    //     });
    // };
};


Probe.prototype.bind = function (fn, self) {

    return function () {

        return fn.apply(self, arguments);
    };
};


Probe.prototype.onMessage = function (msg) {

    var data = null;
    switch (msg.action) {
        case 'mem':
            data = process.memoryUsage();
            break;
        case 'load':
            data = Os.loadavg();
            break;
        case 'info':
            data = this.options;
            break;
        case 'exit':
            // console.log('exit action detected')
            
            // this.server.stop({timeout: 1000}, function(){

            //     // console.log('server stopped')
            //     process.nextTick(function(){
            //         process.exit(1);
            //     });
            // });
            this.server.__flodStop(this.options, this.server);
            break;
        default: 
            return console.log("Local:: unexpected msg:", msg);
            break;
    }
    
    if (data) {
        this.send({action: msg.action, data: data});
    }
};


Probe.prototype.send = function (obj) {

    if (process.send) {
        process.send(obj);
    }
};


Probe.prototype.ready = function (data) {

    this.send({
        action: 'started', 
        data: data || {}
    });
};

module.exports = Probe;