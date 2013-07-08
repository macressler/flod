var Flod = require('../../'); // require('flod') if not run from this repo
var Fs = require('fs');
var express = require('express');

var app = express();
app.server = require('http').createServer(app);
var probe = new Flod.Probe(app, {server: 'express', version: '3.2.4'});

app.get('/', function(req, res){
  res.send('Hello World');
});

app.post('/echo', function(req, res){
  res.send(req.body.toString());
});

app.get('/stream', function(req, res){
  Fs.createReadStream(__filename).pipe(res);
});

app.get('/file', function(req, res){
  res.sendfile('./index.js');
});

app.server.listen(+process.env.port || 3000);
console.log("server started on port " + app.server.address().port);
