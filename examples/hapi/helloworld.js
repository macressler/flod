// module.exports.__info = {
//   server: "hapi",
//   version: "0.8.3"
// };

var Kali = require('kali');

// module.exports.__info = {
//   server: "hapi",
//   version: "0.8.3"
// }

// var os = require('os');
// var util = require('../lib/support/util');
// var Local = function (options) {

//   util.mixin(this, require('../lib/support/base'));
  
//   this.options = options || {};
//   process.on('message', this.bind(this.onMessage, this));
// }
// Local.prototype.send = function (obj) {
//   if (process.send) {
//     process.send(obj);
//   }
// }
// Local.prototype.onMessage = function (msg) {
//   var data = null;
  
//   // console.log(msg.action)
//   switch (msg.action) {
//     case 'mem':
//       data = process.memoryUsage();
//       break;
//     case 'load':
//       data = os.loadavg();
//       break;
//     case 'info':
//       data = this.options;
//       break;
//     default: 
//       console.log("Local:: unexpected msg:", msg);
//       break;
//   }
  
//   this.send({action: msg.action, data: data});
// }


var kali = new Kali.Local({
  server: "hapi",
  version: "0.8.3",
  file: "helloworld"
});

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