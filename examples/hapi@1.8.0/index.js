var Flod = require('../../'); // require('flod') if not run from this repo
var Fs = require('fs');
var Hapi = require('hapi');

var server = new Hapi.Server(+process.env.port || 3000);
var probe = new Flod.Probe(server, {server: 'hapi', version: '1.8.0'});

var hello = {
    method: 'GET',
    path: '/',
    config: {
        validate: {
            query: {
                id: Hapi.types.String()
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
        handler: function () {

            this.reply(Fs.createReadStream(__filename));
        }
    }
};
server.addRoute(stream);

var fileroute = {
    method: 'GET',
    path: '/file',
    handler: {
        file: './index.js'
    }
};
server.addRoute(fileroute);


server.start(function(){
    console.log('server started on port ' + server.info.port);
});