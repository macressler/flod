var Flod = require('../../'); // require('flod') if not run from this repo
var restify = require('restify');

var server = restify.createServer({
  name: 'restify@2.6.0',
  version: '1.0.0'
});
server.use(restify.acceptParser(server.acceptable));
server.use(restify.queryParser());
server.use(restify.bodyParser());

var probe = new Flod.Probe(server, {server: 'restify', version: '2.6.0'});
var ROUTE_TABLE_LENGTH = process.env.ROUTE_TABLE_LENGTH || 1000;

server.get('/', function (req, res, next) {
  res.send('Hello World.');
  return next();
});

var c = 0;
while (c < ROUTE_TABLE_LENGTH) {
    server.get('/' + c, function (req, res, next) {
      res.send('Hello World.');
      return next();
    });
    ++c;
}


server.listen(process.env.port || 3000, function () {
  console.log('%s listening on port %s', server.name, server.address().port);
});