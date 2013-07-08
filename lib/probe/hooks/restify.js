module.exports = {
    '2.6.0': {
        'start': function (server, send, data) {

            server._startOrig = server.listen;
            server.listen = function (port, fn) {

                server._server = server._startOrig(port, function () {

                    send({
                        action: 'started', 
                        data: data || {}
                    });
                    fn && fn();
                });
            };
        },
        'stop': function (server) {

            server.close(function () {

                process.nextTick(function () {

                    process.exit(1);
                });
            });
        },
        'hook': function (server, send) {

            server.on('after', function (request, response, route, error) {

                send({action: 'request', data: {route: route}});
            });
        }
    }
};