module.exports = {
    '0.16.0': {
        'start': function (server, send, data) {

            server._startOrig = server.start;
            server.start = function (fn) {

                server._startOrig(function () {

                    send({
                        action: 'started', 
                        data: data || {}
                    });
                    fn && fn();
                });
            };
        },
        'stop': function (server) {

            server.stop({timeout: 1000}, function () {

                process.nextTick(function () {

                    process.exit(1);
                });
            });
        },
        'hook': function (server, send) {

            server.on('response', function (request, tags) {

                send({action: 'request', data: request.info});
            });
        }
    }
};