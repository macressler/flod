var fork = require('child_process').fork;
var path = require('path');

var Server = function (self, options) {

  this.parent = self;
  this.options = options;
  
  var filename = this.options.serverFile || (this.options.test + this.options.fileExtension);
  var serverFile = path.join(this.options.rootPath || __dirname, this.options.filePath, this.options.server, filename);
  
  this.parent.debug("forking", serverFile);
  server = fork(serverFile);
  return server;
}

module.exports = Server;