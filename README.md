hipcheck [![Build Status](https://travis-ci.org/runnable/hipcheck.png)](https://travis-ci.org/runnable/hipcheck)
======================

configurable hip ache active health checker written in node

## Installation

`npm install -g hipcheck`

OR

`docker pull tjmehta/hipcheck`

## Usage

```bash
  Usage: hipcheck [options] <virtual-host-url ...>

  Options:

    -h, --help               output usage information
    -d, --dryrun             Enable dryrun (health check simulation). Flag.
    -V, --version            output the version number
    -m, --method <s>         URL Method to health check eg. GET. Default: GET
    -s, --expect_status <n>  Expected response status code. Default: 200
    -t, --timeout <n>        Max timeout in seconds for a healthy response. Default: 3
    -i, --interval <n>       Interval in seconds of how often to ping the domain. Default: 3
    -c, --hosts_interval <n> Interval in seconds of how often to check for host changes. Default: 3
    -r, --redis <s>          Hipache's redis host (hostname:port). Default: localhost:6379
    -p, --redis_password <s> Hipache's redis database password. Default: undefined
    -c, --cache <s>          Disk location where to cache (unhealthy backends that hipcheck has removed - see examples section)
    -d, --delete-cache       Delete cache (reset cached unhealthy hosts - see examples section)
    -e, --rollbar <s>        Rollbar token for error tracking. Default: undefined
```

run after npm install

`hipcheck --interval 60 http://sub.domain.com`

run after docker pull

`sudo docker run -d tjmehta/hipcheck hipcheck --interval 60 http://sub.domain.com`

## Examples and Info

Hipcheck will check the redis backends for the specified virtual-host-url's host,
by creating hearbeats. It will create a heartbeat for each backend.

The hearbeats ping the path specified in the virtual-host-url (and use the same protocol).

```bash
hipcheck --method POST https://sub.domain.com/health # has backends 10.0.0.1 and 10.0.0.2
```
Heartbeats will ping by posting to https://10.0.0.1/health and https://10.0.0.2/health

Hipcheck will remove unhealthy backends from redis that respond with unexpected status codes or timeout.
It will continue to ping the unhealthy backends at the same interval and will readd them to redis when
they recover.

Hipcheck will keep track of unhealthy backends that it has removed from redis in a cache on disk.
So that backends are not lost when stopping/restarting Hipcheck.

## License

MIT