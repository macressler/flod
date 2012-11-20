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
        serverFile: Hapi.Types.String()
      },
      handler: function (req) {
        var status = self.parent.serverInit();
        self.parent.debug("#serverInit() from handler")
        
        if (typeof status == 'string') {
          status = Hapi.Error.badRequest(status);
        }
        
        return req.reply(status);
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
        var id = self.parent.register(req.query);
        
        if (typeof id == "string") {
          id = Hapi.Error.badRequest(id);
        }
        req.reply(id);
      }
    }
  }
  
  uploadLatencies = {
    method: "POST",
    path: "/bench/latencies",
    config: {
      query: {
        id: Hapi.Types.String()
      },
      handler: function (req) {
        console.log('/bench/latencies', req.query)
        try {
          var data = JSON.parse(req.payload.latencies)
        } catch (e) {
          console.log(req.payload)
          return req.reply(Hapi.Error.badRequest(e));
        }
        
        self.parent.set('latencies', data);
        req.reply({});
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
        self.parent.debug('finisher#handler');
        var stats = self.parent.unregister(req.query.id);
        
        if (typeof stats == "string") {
          stats = Hapi.Error.badRequest(stats);
        }
        
        return req.reply(stats)
      }
    }
  }
  
  this.server.addRoute(initializer);
  this.server.addRoute(reset);
  this.server.addRoute(starter);
  this.server.addRoute(uploadLatencies);
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