var Hapi = require('hapi');

var Admin = function (self, options) {

  this.parent = self;
  this.options = options;
  
  return this;
}

Admin.prototype.start = function () {

  var self = this;
  this.server = new Hapi.Server(this.options.host, this.options.port);
  
  initializer = {
    method: "GET",
    path: "/bench/init",
    config: {
      query: {
        // server: Hapi.Types.String().required(),
        // test: Hapi.Types.String()
      },
      handler: function (req) {
        var status = self.parent.serverInit()
        if (typeof status == 'string') {
          status = Hapi.Error.badRequest(status);
        }
        req.reply(status)
      }
    }
  }
  
  reset = {
    method: "GET",
    path: "/bench/reset",
    config: {
      query: {
        code: Hapi.Types.String().required()
      },
      handler: function (req) {
        if (req.query.code != "walmartlabs") {
          return req.reply(Hapi.Error.badRequest("Invalid code supplied"))
        }
        var status = self.parent.start(self.options)
        req.reply(status)
      }
    }
  }
  
  starter = {
    method: "GET",
    path: "/bench/start",
    config: {
      query: {
        n: Hapi.Types.Number(),
        c: Hapi.Types.Number(),
        id: Hapi.Types.String()
      },
      handler: function (req) {
        id = self.parent.register(req.query);
        if (typeof id == "string") {
          id = Hapi.Error.badRequest(id);
        }
        req.reply(id)
      }
    }
  }
  
  finisher = {
    method: "GET",
    path: "/bench/finish",
    config: {
      query: {
        id: Hapi.Types.String().required()
      },
      handler: function (req) {
        stats = self.parent.unregister(req.query.id);
        if (typeof id == "string") {
          id = Hapi.Error.badRequest(id);
        }
        req.reply(stats)
      }
    }
  }
  
  this.server.addRoute(initializer);
  this.server.addRoute(reset);
  this.server.addRoute(starter);
  this.server.addRoute(finisher);
  
  this.server.start();
  
  return this;
}

Admin.prototype.stop = function (){

  if (this.server.stop && typeof this.server.stop === "function")  {
    this.server.stop();
  }
}

module.exports = Admin;