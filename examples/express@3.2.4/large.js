var Flod = require('../../'); // require('flod') if not run from this repo
var express = require('express');

var app = express();
app.server = require('http').createServer(app);
var ROUTE_TABLE_LENGTH = process.env.ROUTE_TABLE_LENGTH || 1000;
var probe = new Flod.Probe(app, {server: 'express', version: '3.2.4'});

app.get('/', function(req, res){
  res.send('Hello World');
});

var c = 0;
while (c < ROUTE_TABLE_LENGTH) {
    app.get('/' + c, function(req, res){
      res.send('Hello World');
    });
    ++c;
}

app.server.listen(process.env.port || 3000);
console.log("server started on port " + app.server.address().port);
