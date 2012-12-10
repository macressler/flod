<a href="/walmartlabs/blammo"><img src="https://raw.github.com/walmartlabs/blammo/master/images/from.png" align="right" /></a>
# flod

A systematic toolchain for benchmarking and comparing Node.js web server frameworks. **flod** enables developers to compare the performance of different versions of their frameworks and to other frameworks. 

# Table of Contents

- [**Installation**](#installation)
- [**Usage**](#usage)
    - [**Basic Usage**](#basic-usage)
    - [**Typical Usage**](#typical-usage)
- [**Overview**](#overview)
- [**Configuration**](#configuration)
    - [**Daemon (./flodd) Configuration](#daemon-configuration)
    - [**Client (./flod) Configuration](#client-configuration)
    - [**Webserver Configuration**](#webserver-configuration)

# Installation

Install using npm:

    npm install -g flod

OR by cloning this repository:

    git clone https://github.com/walmartlabs/flod.git



# Usage

To use flod, you must give it some webserver(s) to bench.  The easiest way to get started is to fork the starter template `flod-webservers`:

    git clone https://github.com/thegoleffect/flod-webservers

Inside the `lib` folder are server files for four different Node webservers organized by version.

For each file you want to bench, you must go into the folder and run `npm install` to install the requisite modules for that server file.

## Basic Usage

In the `flod-webservers` folder:

    flodd run lib/hapi/0.9.0/helloworld.js

In another terminal:

    flod --host=http://localhost:3000 --admin=http://localhost:8080 --output=./log -n 10000 -c 100
    flod --file=lib/hapi/0.8.4/helloworld.js --host=http://localhost:3000 --admin=http://localhost:8080 --output=./log -n 10000 -c 100
    flod compare logs/bench-hapi-0.9.0-... logs/bench-hapi-0.8.0-...

Adjust the settings to your heart's content:

* `-n` is the total number of requests to make.
* `-c` is the number of concurrent requests allowed at a time (flod will attempt to hit this but may not necessarily do so depending on system performance)



## Typical Usage

A more typical usage scenario would be to run the `./flodd` daemon on an isolated, beefy remote server. Then, run the client `./flod` either locally or from yet another server (which does not have to be very powerful).


# Overview

The *flod* toolchain has three parts:

* `./flodd`
* `./flod`
* webservers

## Flodd

`./flodd` is the daemon - it runs the admin webserver responsible for responding to benchmark requests. It spawns the webserver to be tested/benched in a separate process and monitors operational metrics like memory usage, cpu load, etc. 

For the most accurate data collection, only one benchmark can run at a time.

For safety, it will backup copies of the data in the `logs` folder.

## Flod

`./flod` is the client - it notifies flodd to initialize the server and benchmark data. Then, it repeatedly makes HTTP requests to flodd until the specified number of requests has been met. Along the way, it collects timing and latency data. On completion, it will download the operational metrics from the server and compile into a dataset for the given benchmark.  The datasets gets backed up as json in the output folder by server module, version, and timestamp.

It also has the ability compare datasets. This allows developers to compare different webservers, different versions of a webserver, different times the benches were run, etc.



# Configuration

## Daemon Configuration

## Client Configuration