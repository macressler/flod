var Flod = require('../../'); // require('flod') if not run from this repo
var Fs = require('fs');
var Hapi = require('hapi');

var server = new Hapi.Server(process.env.port || 3000);
var probe = new Flod.Probe(server, {server: 'hapi', version: '0.16.0'});


var hello = {
    method: 'GET',
    path: '/',
    config: {
        validate: {
            query: {
                id: Hapi.Types.String()
            }
        },
        handler: function (request) {

            request.reply('Hello World.');
        }
    }
};
server.addRoute(hello);

var echoPOST = {
    method: 'POST',
    path: '/echo',
    config: {
        validate: {
            query: true,
            payload: true
        },
        handler: function (request) {

            request.reply(request.payload);
        }
    }
};
server.addRoute(echoPOST);

var stream = {
    method: 'GET',
    path: '/stream',
    config : {
        payload: 'stream',
        handler: function (request) {

            request.reply(Fs.createReadStream(__filename));
        }
    }
};
server.addRoute(stream);

server.start(function(){
    console.log('server started on port ' + server.settings.port);
});