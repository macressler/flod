var Os = require('os');


var Probe = function (server, meta, overrides) {

    // Initialize
    this.meta = meta;
    this.server = server;
    
    // Bind to server's listen/start & request events
    this.instrument();
    
    // Report data on master process' request
    process.on('message', this.bind(this.onMessage, this));
    
    return this;
};


Probe.prototype.instrument = function () {

    // require('./support/' + this.meta.name)
    var self = this;
    
    // Hapi-specific instrumentation
    self.server.on('response', function (request, tags) {

        self.send({action: 'request', data: request.info});
    });
    
    self.server._startOrig = self.server.start;
    self.server.start = function (fn) {

        self.server._startOrig(function(){

            self.send({
                action: 'started', 
                data: {
                    server: [self.meta.server, "@", self.meta.version].join(""),
                    host: self.server.settings.host,
                    port: self.server.settings.port,
                    os: {
                        platform: Os.platform(),
                        release: Os.release(),
                        arch: Os.arch(),
                        totalmem: Os.totalmem()
                    }
                }
            });
            fn();
        });
    };
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
            this.server.stop({timeout: 1000}, function(){

                // console.log('server stopped')
                process.nextTick(function(){
                    process.exit(1);
                });
            });
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

module.exports = Probe;