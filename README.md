hipcheck [![Build Status](https://travis-ci.org/runnable/hipcheck.png)](https://travis-ci.org/runnable/hipcheck)
======================

configurable hip ache active health checker written in node

```bash
  Usage: hipcheck [options] <url ...>

  Options:

    -h, --help               output usage information
    -V, --version            output the version number
    -m, --method             URL Method to health check eg. GET. Default: GET
    -s, --expect_status      Expected response status code. Default: 200
    -t, --timeout <n>        Max timeout in seconds for a healthy response. Default: 3
    -i, --interval <n>       Interval in seconds of how often to ping the domain. Default: 3
    -c, --hosts_interval <n> Interval in seconds of how often to check for host changes. Default: 3
    -r, --redis              Hipache's redis host (hostname:port). Default: localhost:6379
    -p, --redis_password     Hipache's redis database password
    -c, --cache              Disk location where to cache
    -d, --delete-cache       Delete cache (reset cached hosts)
    -e, --rollbar_token      Rollbar token for error tracking
```