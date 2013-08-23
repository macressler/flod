module.exports = {
    '2.6.0': {
        'start': function (options, server, send, data) {

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
        'stop': function (options, server) {

            server.close(function () {

                process.nextTick(function () {

                    process.exit(1);
                });
            });
        },
        'hook': function (options, server, send) {

            server.on('after', function (request, response, route, error) {

                send({action: 'request', data: {route: route}});
            });
        }
    }
};