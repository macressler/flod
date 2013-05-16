<a href="https://github.com/spumko"><img src="https://raw.github.com/spumko/spumko/master/images/from.png" align="right" /></a>
![flod Logo](https://raw.github.com/spumko/flod/master/images/flod.png)

A systematic toolchain for benchmarking and comparing Node.js web server frameworks. **flod** enables developers to compare the performance of different versions of their frameworks and to other frameworks.

[![Build Status](https://secure.travis-ci.org/spumko/flod.png)](http://travis-ci.org/spumko/flod)

**Warning**: Only Hapi web server is currently supported by v0.1.0. Other servers will be supported in the future, see [**TODO**](#todo) for more information.


# Table of Contents

- [**Installation**](#installation)
- [**Quick Start**](#quick-start)
- [**Usage**](#usage)
    - [Local Testing](#local-bench)
    - [Remote Testing](#remote-testing)
    - [Probe](#probe)
    - [Daemon](#daemon)
- [**TODO**](#todo)


## Installation

Install using npm:

    npm install -g flod

OR by cloning this repository:

    git clone https://github.com/spumko/flod.git


## Quick Start

If installed globally with `-g`, the fastest way to try out flod is to run a local benchmark. Here are instructions on how to run a local benchmark on hapi version 1.0.0:

    cd examples/hapi@1.0.0
    npm install
    flod index.js


To see all of the available options and settings, run:

    flod -h


## Usage

Flod is designed to benchmark web servers. Flod will flood the webserver with a optionally specified number of concurrent requests and measure the latencies of each request until the specific total number of requests has been made.

Benchmarking JavaScript web servers is where flod really shines. With the use of the `flod.Probe`, flod is able to track useful metrics like memory usage and cpu load during the course of the benchmark. 


### Local Testing

To run a local JavaScript server benchmark, flod has the following basic syntax:

    flod [options] <filename>

where `filename` is a JavaScript file that starts a web server.


### Remote Testing

To perform a benchmark on a remote host, flod has the following basic syntax:

    flod [options] <URL>

where `URL` is a fully formed URL (with protocol http/https, hostname, path (and perhaps a port if not 80)).

If the remote host is running `flod.Probe`, additional statistics will be printed.


### Probe

To provide additional metrics during a JavaScript server benchmark, use the flod Probe.

From within the JS server file, include the following snippet:

```javascript
var Flod = require('flod');
var probe = new Flod.Probe(server, {server: SERVER, version: VERSION});
```

where `SERVER` could be `hapi` and `VERSION` could be `1.0.0` - change these to fit your needs.

**Note**: As mentioned earlier, only Hapi servers are supported at the moment.

### Daemon

To perform a benchmark of a JavaScript server on a different, remote computer, flod can daemonize a server file with the flag `--daemon`. This allows flod to perform a remote test as shown in [Remote Testing](#remote-testing).

    flod --daemon some_file.js


## TODO

* Merge in generalized web server support (to support express, restify, etc)
* Multi-threaded request support
* Tests & 100% Coverage
* Document graph/chart generation

