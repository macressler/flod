var Kali = require('kali').Local;
var kali = new Kali({
  server: "hapi",
  version: "0.8.3",
  file: "helloworld"
});

var Hapi = require('hapi');

var host = process.env.HOST || 'localhost';
var port = process.env.PORT || 3000;

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