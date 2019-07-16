# testcafe-browser-provider-lambdatest
[![Build Status](https://travis-ci.org/LambdaTest/testcafe-browser-provider-lambdatest.svg)](https://travis-ci.org/LambdaTest/testcafe-browser-provider-lambdatest)

This is the **lambdatest** browser provider plugin for [TestCafe](http://devexpress.github.io/testcafe).

## Install

```
npm install testcafe-browser-provider-lambdatest
```

## Usage


You can determine the available browser aliases by running
```
testcafe -b lambdatest
```

When you run tests from the command line, use the alias when specifying browsers:

```
testcafe lambdatest:browser1 'path/to/test/file.js'
```


When you use API, pass the alias to the `browsers()` method:

```js
testCafe
    .createRunner()
    .src('path/to/test/file.js')
    .browsers('lambdatest:browser1')
    .run();
```