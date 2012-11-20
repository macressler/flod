var Kali = require('kali').Local;
var kali = new Kali({
  server: "restify",
  version: "1.4.4",
  file: "helloworld"
});

var restify = require('restify');

var server = restify.createServer();
server.use(restify.queryParser());

var host = process.env.HOST || 'localhost';
var port = process.env.PORT || 3000;

server.get('/', function (req, res) {

  res.send("Hello World.");
  kali.send({action: 'request', data: req.query.id});
})

kali.send({action: 'started', data: 1});
server.listen(port);