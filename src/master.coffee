_ = require("underscore")
EventEmitter = require("events").EventEmitter
Hapi = require("hapi")
uuid = require("node-uuid")
fs = require("fs")
path = require("path")
{exec, spawn, fork} = require("child_process")

class Master extends EventEmitter
  constructor: (@port = 8080, options = {}) ->
    @init(options)
    @startAdmin()
    @start(@options)
  
  _defaultOptions: {
    host: "localhost",
    filePath: "./servers/",
    logPath: "../logs/",
    server: "hapi",
    test: "helloworld",
    metricInterval: 5000,
    debug: true
  }
  
  init: (options) ->
    @options = @_opts(options)
    @benchmark = null
    @benchmarkStarted = null
    process.on("SIGINT", @cleanup)
    process.on("uncaughtException", @cleanup)
  
  _opts: (options) ->
    options.port = @port
    @options = _.extend({}, @_defaultOptions, options)
  
  register: (query) ->
    id = query.id || uuid.v4()
    if @benchmark != null
      return Hapi.Error.badRequest("Benchmark in progress, please wait until finished")
    
    @benchmark = {
      id: id,
      query: query
    }
    if @benchmarkStarted != null
      @benchmark["started"] = @benchmarkStarted 
      @benchmarkStarted = null
    return @benchmark
  
  unregister: (id = null) ->
    return Hapi.Error.badRequest("No such benchmark found by that id (#{id})") if id == null or (@benchmark and @benchmark.id and @benchmark.id != id)
    benchmark = @finalizeData()
    stats = @statistics(benchmark)
    return stats
  
  finalizeData: () ->
    benchmark = @benchmark
    @benchmark = null
    
    @backupToFile(benchmark)
    
    return benchmark
  
  backupFilename: () ->
    return "bench-" + @now() + ".json"
  
  backupToFile: (contents) ->
    return if contents == null
    backupFilename = path.join(__dirname, @options.logPath, @backupFilename())
    # console.log(backupFilename)
    fs.writeFileSync(backupFilename, JSON.stringify(contents))
  
  statistics: (data) ->
    console.log(data)
    # TODO: merge from requests.coffee
    return data 
  
  aggregate: (action, timestamp, id) ->
    return null if @benchmark == null
    return null if @benchmark.id != id
    
    # inc = parseInt(increment)
    # throw "#{increment} is not a valid increment value for @aggregate" if isNaN(inc)
    
    if not @benchmark.hasOwnProperty(action)
      @benchmark[action] = {} 
    if not @benchmark[action].hasOwnProperty(timestamp)
      @benchmark[action][timestamp] = 0
    @benchmark[action][timestamp] += 1
  
  record: (action, timestamp, data = true) ->
    return null if @benchmark == null
    
    @benchmark[action] = {} if not @benchmark.hasOwnProperty(action)
    @benchmark[action][timestamp] = data
    
  now: () -> return Date.now()/1000>>0
    
  onMessage: (m) =>
    ts = @now()
    switch m.action
      when "request"
        @aggregate(m.action, ts, m.data)
      when "mem", "load"
        @record(m.action, ts, m.data)
      when "started"
        @benchmarkStarted = ts
      when "ended"
        @record(m.action, ts)
      else
        throw "unspecified action: #{m.action}"
  
  cleanup: (err = null) =>
    throw err if err
    
    clearInterval(@metricsTimer)
    @stop()
    @stopAdmin()
    process.nextTick(() ->
      process.exit()
    )
  
  pollMetrics: () =>
    if @server and @server.send
      @server.send({action: "mem"})
      @server.send({action: "load"})
  
  start: (settings) ->
    @stop() if @server != null
    return Hapi.Error.badRequest("Cannot (re)start server while benchmark is in progress") if @benchmark != null
    settings = _.extend({}, @options, settings)
    
    serverFile = path.join(__dirname, settings.filePath, settings.server, settings.test + ".coffee")
    console.log(serverFile) if @options.debug
    @server = fork(serverFile)
    @server.on('message', @onMessage)
    @metricsTimer = setInterval(@pollMetrics, @options.metricInterval)
    return {}
  
  stop: () ->
    @record("ended", @now())
    if @server
      @server.removeAllListeners()
      @server.kill()
      @server = null
    return @finalizeData()
  
  stopAdmin: () ->
    @admin.stop()
  
  startAdmin: () ->
    self = this
    
    @admin = new Hapi.Server(@options.host, @options.port)
    initializer = {
      method: "GET",
      path: "/bench/init",
      config: {
        query: {
          server: Hapi.Types.String().required(),
          test: Hapi.Types.String()
        },
        handler: (req) ->
          status = self.start(req.query)
          req.reply(status)
      }
    }
    
    reset = {
      method: "GET",
      path: "/bench/reset",
      config: {
        query: {
          code: Hapi.Types.String().required()
        },
        handler: (req) ->
          return req.reply(Hapi.Error.badRequest("Invalid code supplied")) if req.query.code != "walmartlabs"
          status = self.start(self.options)
          req.reply(status)
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
        handler: (req) ->
          id = self.register(req.query)
          req.reply(id)
      }
    }
    
    finisher = {
      method: "GET",
      path: "/bench/finish",
      config: {
        query: {
          id: Hapi.Types.String().required()
        },
        handler: (req) ->
          stats = self.unregister(req.query.id)
          req.reply(stats)
      }
    }
    
    @admin.addRoute(initializer)
    @admin.addRoute(reset)
    @admin.addRoute(starter)
    @admin.addRoute(finisher)
    @admin.start()
  
module.exports = Master