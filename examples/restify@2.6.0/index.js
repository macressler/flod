var Flod = require('../../'); // require('flod') if not run from this repo
var Fs = require('fs');
var restify = require('restify');

var server = restify.createServer({
  name: 'restify@2.6.0',
  version: '1.0.0'
});
server.use(restify.acceptParser(server.acceptable));
server.use(restify.queryParser());
server.use(restify.bodyParser());

var probe = new Flod.Probe(server, {server: 'restify', version: '2.6.0'});

server.get('/', function (req, res, next) {
  res.send('Hello World.');
  return next();
});

server.post('/echo', function (req, res, next) {
  res.send(req.body);
  return next();
});

server.get('/file', function (req, res, next) {
  res.send(Fs.readFileSync('./index.js').toString());
  return next();
});

server.get('/stream', function (req, res, next) {
  Fs.createReadStream(__filename).pipe(res);
  return next();
})

server.listen(+process.env.port || 3000, function () {
  console.log('%s listening on port %s', server.name, server.address().port);
});