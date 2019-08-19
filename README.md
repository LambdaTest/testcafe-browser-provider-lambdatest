# testcafe-browser-provider-lambdatest
[![Build Status](https://travis-ci.org/LambdaTest/testcafe-browser-provider-lambdatest.svg)](https://travis-ci.org/LambdaTest/testcafe-browser-provider-lambdatest)

This plugin integrates [TestCafe](http://devexpress.github.io/testcafe) with the [LambdaTest Testing Cloud](https://www.lambdatest.com/).

## Install

```
npm install testcafe-browser-provider-lambdatest
```

## Usage
Before using this plugin, save the LambdaTest username and access key to environment variables `LT_USERNAME` and `LT_ACCESS_KEY`, as described in [LambdaTest Documentation](https://www.lambdatest.com/support/docs/using-environment-variables-for-authentication-credentials).

You can determine the available browser aliases by running
```
testcafe -b lambdatest
```

If you run tests from the command line, use the browser alias when specifying browsers:
For Single Configuration
```
testcafe "lambdatest:Chrome@74.0:Windows 8" "path/to/test/file.js"
```
For Parallel/Multiple Configuration
```
testcafe "lambdatest:Chrome@74.0:Windows 8","lambdatest:Chrome@75.0:Windows 10" "path/to/test/file.js"
```

When you use API, pass the alias to the `browsers()` method:

```js
testCafe
    .createRunner()
    .src('path/to/test/file.js')
    .browsers('lambdatest:Chrome@74.0:Windows 8')
    .run();
```

##Build Plugin Locally

    1. clone this repo
    2. RUN: npm i
    3. RUN: ./node_modules/.bin/gulp build
    4. RUN: sudo npm link

## Configuration

Use the following environment variables to set additional configuration options:

 - `LT_TEST_NAME` - Test name on LambdaTest.
 - `LT_BUILD` - Build name on LambdaTest.
 - `LT_CAPABILITY_PATH` - Path to a file which contains additional capability options as JSON.
    
    ```js
        "Chrome@63.0:Windows 8.1" : {
            "network" : true,
            "visual" : true,
            "timezone" : "UTC+11:00"
        }
    ```
    - `Chrome@63.0:Windows 8.1` is browser alias.
 - `LT_RESOLUTION` - allows setting the screen resolution for desktop browsers in the `${width}x${height}` format.
 - `LT_LOGFILE` - Logfile You can provide a specific path to this file. If you won't provide a path then the logs would be saved in your present working directory by the filename: tunnel.log.
 - `LT_VERBOSE` - true or false.
 - `LT_PROXY_HOST` - Hostname/IP of proxy, this is a mandatory value.
 - `LT_PROXY_PORT` - Port for the proxy, by default it would consider 3128 if proxyhost is used For Basic Authentication, we use the below proxy options.
 - `LT_PROXY_USER` - Username for connecting to proxy, mandatory value for using 'proxypass'.
 - `LT_PROXY_PASS` - Password for the USERNAME option.
 - `LT_TUNNEL_NAME` - Human readable tunnel identifier (Name of the tunnel).
 - `LT_DIR` - Path of the local folder you want to test.
 - `LT_SELENIUM_VERSION` - Browser specific capability
 - `LT_CONSOLE` - true or false.
 - `LT_NETWORK` - true or false.
 - `LT_VIDEO` - true or false.
 - `LT_SCREENSHOT` - true or false.
 - `LT_TIMEZONE` - Configure tests to run on a custom time zone
 
Example:
```sh
export LT_RESOLUTION="1920x1080"
export LT_TEST_NAME="Test TestCafe"
export LT_BUILD="Build x"
testcafe "lambdatest:Chrome","lambdatest:Chrome@74.0:Windows 8" tests/
```
