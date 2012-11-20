module.exports.__info = {
  server: "hapi",
  version: "0.8.3"
};

// var kali = new require('kali').Local;
var os = require('os');
var Local = function () {
  
}
Local.prototype.send = function (obj) {
  if (process.send) {
    process.send(obj);
  }
}
Local.prototype.onMessage = function (msg) {
  switch (msg.action) {
    case 'mem':
      data = process.memoryUsage();
      break;
    case 'load':
      data = os.loadavg();
      break;
    default: 
      console.log("Local:: unexpected msg:", msg);
      data = null;
      break;
  }
  
  this.send({action: msg.action, data: data});
}


var kali = new Local();
var Hapi = require('hapi');


host = process.env.HOST || 'localhost'
port = process.env.PORT || 3000
var server = new Hapi.Server(host, port);
var hello = {
  method: 'GET',
  path: '/',
  config: {
    query: {
      id: Hapi.Types.String()
    },
    handler: function (req) {
      req.reply('Hello World.');
      kali.send({action: 'request', data: req.query.id})
    }
  }
}

server.addRoute(hello);
kali.send({action: 'started', data: 1});
server.start();