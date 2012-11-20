var Kali = require('kali').Local;
var kali = new Kali({
  server: "director",
  version: "1.1.8",
  file: "helloworld"
});

var director = require('director');
var http = require('http');
var qs = require('querystring');
var host = process.env.HOST || 'localhost'
var port = process.env.PORT || 3000

var helloWorld = function () {

  this.res.writeHead(200, {'Content-Type': 'text/plain'});
  this.res.end("Hello World.");
  kali.send({action: 'request', data: qs.parse(this.req.url.slice(2)).id});
}

var router = new director.http.Router({
  '/': {
    get: helloWorld
  }
});

var server = http.createServer(function (req, res) {
  router.dispatch(req, res, function (err) {
    if (err) {
      res.writeHead(404);
      res.end();
    }
  })
})

kali.send({action: 'started', data: 1});
server.listen(port);