var cp = require('child_process');
var Hapi = require('hapi');
var Path = require('path');

var domain = require("domain"),
serverDomain = domain.create();


var Stats = function () {

    this.mem = {};
    this.load = {};
    this.info = {};
    this.requestCount = 0;
    // this.startTime = null;
    // this.endTime = null;
};


var Daemon = function (options, env) {

    var self = this;
    this.options = options || {};
    this.env = env || {};
    
    this.debug = this.createDebug();
    
    this.benchStats = new Stats();
    this.metricTimer = null;
    this.serverStarted = false;
    this.server = null;
    this.admin = null;
    this.isRunning = false;
    
    if (this.options.filename[0] !== '/') {
        this.options.filename = Path.join(this.options.rootPath, this.options.filename);
    }
    
    serverDomain.run(function(){

        self.initAdmin();
    });
    
    return this;
};


Daemon.prototype.createDebug = function () {

    if (this.env.DEBUG) {
        return console.log;
    }
    else {
        return function () {};
    }
};


Daemon.prototype.initAdmin = function () {

    var self = this;
    
    this.admin = new Hapi.Server(+this.options.port+1);
    var home = {
        method: 'GET',
        path: '/',
        config: {
            handler: function (req) {

                req.reply('Flod Daemon Enabled.');
            }
        }
    };
    self.admin.addRoute(home);
    
    var start = {
        method: 'GET',
        path: '/start',
        config: {
            validate: {
                query: {
                    'metricInterval': Hapi.types.Number()
                }
            },
            handler: function (req) {

                self.debug('/start');
                if (self.server && self.server.pid) {
                    self.debug('self.server.pid', self.server.pid)
                    self.server.send({
                        action: 'exit'
                    });
                    self.server.setMaxListeners(0);
                    self.server.once('exit', function () {

                        self.debug('redirecting');
                        if (self.server && self.server.removeAllListeners) {
                            self.server.removeAllListeners();
                        }
                        delete self.server;
                        self.server = null;
                        self.serverStarted = false;
                        req.reply.redirect('/start').send();
                    });
                    return;
                }
                
                if (self.isRunning) {
                    return req.reply("Already running.");
                }
                
                self.isRunning = true;
                
                self.benchStats = new Stats();
                
                self.debug('forking', self.options.filename)
                self.server = cp.fork(self.options.filename, [], {silent: true, env: self.env});
                self.server.setMaxListeners(0);
                self.server.on('message', function (msg) {

                    var ts = Date.now();
                    switch(msg.action) {
                        case 'request':
                            self.benchStats.requestCount++;
                            break;
                        case 'mem':
                        case 'load':
                            self.benchStats[msg.action][ts] = msg.data;
                            break;
                        case 'started':
                            self.benchStats.info = msg.data;
                            self.benchStats.info.startTime = ts;
                            self.debug('started @', Date.now())
                            self.serverStarted = true;
                            req.reply({action: 'started', data: self.benchStats.info});
                            self.metricTimer = setInterval((function(){

                                if (self.server && self.server.send) {
                                    self.server.send({
                                        action: 'mem'
                                    });
                                    self.server.send({
                                        action: 'load'
                                    });
                                }
                                else {
                                    self.debug('no self.server.send')
                                }
                            }), req.query.metricInterval || self.options.metricInterval);
                            break;
                        default:
                            self.debug("unspecific action supplied " + msg.action);
                            // test.send({
                            //     action: 'exit'
                            // });
                            break;
                    }
                });
            }
        }
    };
    self.admin.addRoute(start);
    
    var finish = {
        method: 'GET',
        path: '/finish',
        config: {
            handler: function (req) {

                if (!self.serverStarted) {
                    return req.reply({});
                }
                
                self.debug('/finish')
                self.benchStats.info.endTime = Date.now();
                clearInterval(self.metricTimer);
                self.isRunning = false;
                
                self.server.setMaxListeners(0);
                self.server.once('exit', function(){

                    self.debug('finished')
                    if (self.server && self.server.removeAllListeners) {
                        self.server.removeAllListeners();
                    }
                    delete self.server;
                    self.server = null;
                    self.serverStarted = false;
                    req.reply(self.benchStats);
                });
                self.server.send({
                    action: 'exit'
                });
                self.debug('exiting server')
            }
        }
    };
    self.admin.addRoute(finish);
    
    return self.admin;
};


module.exports = Daemon;