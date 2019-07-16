# testcafe-browser-provider-lambdatest
[![Build Status](https://travis-ci.org/DevExpress/testcafe-browser-provider-lambdatest.svg)](https://travis-ci.org/DevExpress/testcafe-browser-provider-lambdatest)
[![Build Status](https://ci.appveyor.com/api/projects/status/47hkm5kr9c6ftb9u/branch/master?svg=true)](https://ci.appveyor.com/project/DevExpress/testcafe-browser-provider-lambdatest/branch/master)

This plugin integrates [TestCafe](http://devexpress.github.io/testcafe) with the [LambdaTest Testing Cloud](https://www.lambdatest.com/).

## Install

```
npm install testcafe-browser-provider-lambdatest
```

## Usage
Before using this plugin, save the LambdaTest username and access key to environment variables `LT_USERNAME` and `LT_ACCESS_KEY`

You can determine the available browser aliases by running
```
testcafe -b lambdatest
```

If you run tests from the command line, use the browser alias when specifying browsers:

```
testcafe "lambdatest:Chrome@74.0:Windows 8" 'path/to/test/file.js'
```


When you use API, pass the alias to the `browsers()` method:

```js
testCafe
    .createRunner()
    .src('path/to/test/file.js')
    .browsers('lambdatest:Chrome@74.0:Windows 8')
    .run();
```

## Configuration

Use the following environment variables to set additional configuration options:

 - `LT_NAME` - the text that will be displayed as Test Name on LambdaTest,

 - `LT_BUILD` - the text that will be displayed as Build Name on LambdaTest.

 - `LT_CAPABILITY_PATH` - Path to a file which contains additional test options as JSON.
 
 - `LT_RESOLUTION` - allows setting the screen resolution for desktop browsers in the `${width}x${height}` format. 
 
Example:
```sh
export LT_RESOLUTION="1920x1080"
export LT_NAME="Test TestCafe"
export LT_BUILD="Build x"
testcafe lambdatest:safari,lambdatest:chrome tests/
```
 
## Author
Developer Express Inc. (https://devexpress.com)
