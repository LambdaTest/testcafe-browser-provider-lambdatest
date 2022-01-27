'use strict';
import _request from 'request';
import Promise from 'pinkie';
import pify from 'pify';
import parseCapabilities from 'desired-capabilities';
import LambdaTestTunnel from '@lambdatest/node-tunnel';
import fs from 'fs';

const promisify = fn => pify(fn, Promise);
const request   = promisify(_request, Promise);

const PROCESS_ENVIRONMENT = process.env;
const BASE_URL = 'https://api.lambdatest.com/api/v1';
const AUTOMATION_BASE_URL = 'https://api.lambdatest.com/automation/api/v1';
const AUTOMATION_DASHBOARD_URL = 'https://automation.lambdatest.com';
const AUTOMATION_HUB_URL = process.env.LT_GRID_URL || 'hub.lambdatest.com';
const LT_AUTH_ERROR = 'Authentication failed. Please assign the correct username and access key to the LT_USERNAME and LT_ACCESS_KEY environment variables.';
const LT_TUNNEL_NUMBER = process.env.LT_TUNNEL_NUMBER || 1;

var instances = [];

var instancesArgs = [];

var instanceRunning = [];

for (let tunnel = 0; tunnel < LT_TUNNEL_NUMBER; tunnel++) {
    instances.push(null);
    instancesArgs.push({});
    instanceRunning.push(false);
}

// let connectorInstance = null;

// let secondConnectorInstance = null;

// let tunnelArguments = { };

// let tunnel2Arguments = { };

const capabilities = { };

let retryCounter = 60;

// let isRunning = false;

// let secondIsRunning = false;

var isTraceEnable = false;

if (PROCESS_ENVIRONMENT.LT_ENABLE_TRACE)
    isTraceEnable = true;

async function requestApi (options) {
    const response = await request(options);

    try {
        return IsJsonString(response.body);
    }
    catch (err) {
        showTrace('API Response', response.body);
        showTrace('Error while API call ', err);
        return null;
    }
}

function IsJsonString (str) {
    try {
        return JSON.parse(str);
    } 
    catch (e) {
        return false;
    }
}

async function _getBrowserList () {
    const browserList = [];
    const osList = await requestApi(`${BASE_URL}/capability?format=array`);

    for (const os of osList.os) {
        const _browserList = await requestApi(`${BASE_URL}/capability?os=${os.id}&format=array`);

        for (const browser of _browserList) for (const version of browser.versions) browserList.push(`${browser.name}@${version.version}:${os.name}`);
    }
    const deviceList = await requestApi(`${BASE_URL}/device`);

    for (const key in deviceList) {
        if (Reflect.has(deviceList, key)) {
            const element = deviceList[key];

            for (const device of element) for (const osVersion of device.osVersion) browserList.push(`${device.deviceName}@${osVersion.version}:${key}`);
        }
    }
    return browserList;
}
async function _connect (tunnel) {
    try {
        if (!PROCESS_ENVIRONMENT.LT_TUNNEL_NAME) {
            if (!instances[tunnel]) {
                instances[tunnel] = new LambdaTestTunnel();
                // connectorInstance = new LambdaTestTunnel();
                // secondConnectorInstance = new LambdaTestTunnel();
                const logFile = PROCESS_ENVIRONMENT.LT_LOGFILE || 'lambdaTunnelLog.log';
                const v = PROCESS_ENVIRONMENT.LT_VERBOSE;
    
                instancesArgs[tunnel] = {
                    user: PROCESS_ENVIRONMENT.LT_USERNAME,
    
                    key: PROCESS_ENVIRONMENT.LT_ACCESS_KEY,
    
                    logFile: logFile,
    
                    controller: 'testcafe'
                };
    
                // tunnelArguments = {
                //     user: PROCESS_ENVIRONMENT.LT_USERNAME,
    
                //     key: PROCESS_ENVIRONMENT.LT_ACCESS_KEY,
    
                //     logFile: logFile,
    
                //     controller: 'testcafe'
                // };
                // tunnel2Arguments = {
                //     user: PROCESS_ENVIRONMENT.LT_USERNAME,
    
                //     key: PROCESS_ENVIRONMENT.LT_ACCESS_KEY,
    
                //     logFile: logFile,
    
                //     controller: 'testcafe'
                // };
    
                // if (v === 'true' || v === true) tunnelArguments.v = true;
                if (v === 'true' || v === true) instancesArgs[tunnel].v = true;
                if (PROCESS_ENVIRONMENT.LT_PROXY_HOST) instancesArgs[tunnel].proxyHost = PROCESS_ENVIRONMENT.LT_PROXY_HOST;
                if (PROCESS_ENVIRONMENT.LT_PROXY_PORT) instancesArgs[tunnel].proxyPort = PROCESS_ENVIRONMENT.LT_PROXY_PORT;
                if (PROCESS_ENVIRONMENT.LT_PROXY_USER) instancesArgs[tunnel].proxyUser = PROCESS_ENVIRONMENT.LT_PROXY_USER;
                if (PROCESS_ENVIRONMENT.LT_PROXY_PASS) instancesArgs[tunnel].proxyPass = PROCESS_ENVIRONMENT.LT_PROXY_PASS;
                // tunnelArguments.tunnelName = PROCESS_ENVIRONMENT.LT_TUNNEL_NAME || `TestCafe-${new Date().getTime()}`;
                // tunnel2Arguments.tunnelName = PROCESS_ENVIRONMENT.LT_TUNNEL_NAME || `TestCafe1-${new Date().getTime()}`;
    
                if (process.env.LT_TUNNEL_NAME) instancesArgs[tunnel].tunnelName = process.env.LT_TUNNEL_NAME + tunnel + `-${new Date().getTime()}`;   
                else instancesArgs[tunnel].tunnelName = 'TestCafe' + tunnel + `_${PROCESS_ENVIRONMENT.LT_USERNAME}-${new Date().getTime()}`;
    
                if (PROCESS_ENVIRONMENT.LT_DIR) instancesArgs[tunnel].dir = PROCESS_ENVIRONMENT.LT_DIR;
    
                if (PROCESS_ENVIRONMENT.LOAD_BALANCED_MODE) instancesArgs[tunnel].loadbalanced = true;
    
                await instances[tunnel].start(instancesArgs[tunnel]);
    
                // console.log(instancesArgs[tunnel]);
                // console.log(instances[tunnel]);
                // console.log(instanceRunning[tunnel]);
    
                // await connectorInstance.start(tunnelArguments);
                // await secondConnectorInstance.start(tunnel2Arguments);
            }
            await _waitForTunnelRunning(tunnel);
        }
    }
    catch (err) {
        showTrace('_connect error :', err);
    }
}
async function _destroy (tunnel) {
    try {
        if (instances[tunnel]) {
            const tunnelName = await instances[tunnel].options.tunnelName;

            showTrace('Stopping Tunnel :', tunnelName);

            await instances[tunnel].stop();
            instances[tunnel] = null;
        }
        // if (connectorInstance) {
        //     const tunnelName = await connectorInstance.getTunnelName();
            
        //     showTrace('Stopping Tunnel :', tunnelName);
            
        //     await connectorInstance.stop();
        //     connectorInstance = null;
        // } 

        // if (secondConnectorInstance) {
        //     const nextTunnelName = await secondConnectorInstance.getTunnelName();

        //     showTrace('Stopping Second Tunnel:', nextTunnelName);

        //     await secondConnectorInstance.stop();
        //     secondConnectorInstance = null;
        // }
    } 
    catch (err) {
        showTrace('util._destroy error :', err);
    }
    
}

function getRandomInt (max) {
    return Math.floor(Math.random() * max);
}  

async function _parseCapabilities (id, capability) {
    try {
        const testcafeDetail = require('../package.json');

        // showTrace('capability', capability);
        const parseCapabilitiesData = parseCapabilities(capability)[0];
        const browserName = parseCapabilitiesData.browserName;
        const browserVersion = parseCapabilitiesData.browserVersion;
        const platform = parseCapabilitiesData.platform;
        const lPlatform = platform.toLowerCase();
        
        capabilities[id] = {
            tunnel: true,

            plugin: `${testcafeDetail.name}:${testcafeDetail.version}`
        };
        if (['ios', 'android'].includes(lPlatform)) {
            capabilities[id].platformName = lPlatform;
            capabilities[id].deviceName = browserName;
            capabilities[id].platformVersion = browserVersion;
        }
        else {
            capabilities[id].browserName = browserName;
            capabilities[id].version = browserVersion.toLowerCase();
            capabilities[id].platform = lPlatform;
        }
        if (PROCESS_ENVIRONMENT.LT_CAPABILITY_PATH) {
            let additionalCapabilities = { };

            try {
                additionalCapabilities = await _getAdditionalCapabilities(PROCESS_ENVIRONMENT.LT_CAPABILITY_PATH);

            }
            catch (err) {
                showTrace('Error while adding additionalCapabilities from file : ' + PROCESS_ENVIRONMENT.LT_CAPABILITY_PATH + '  ErrorTrace :', err);
                additionalCapabilities = { };
            }
            capabilities[id] = {
                ...capabilities[id],
                ...additionalCapabilities[capability]
            };
        }

        if (PROCESS_ENVIRONMENT.LT_BUILD) capabilities[id].build = PROCESS_ENVIRONMENT.LT_BUILD;
        capabilities[id].name = PROCESS_ENVIRONMENT.LT_TEST_NAME || `TestCafe test run ${id}`;

        // if (PROCESS_ENVIRONMENT.LT_TUNNEL_NAME) capabilities[id].tunnelName = PROCESS_ENVIRONMENT.LT_TUNNEL_NAME;
        // else {
        try {
            // showTrace('ConncetorInstance Data: ', secondConnectorInstance);

            try {

                for (let tunnel = 0; tunnel < LT_TUNNEL_NUMBER; tunnel++) {
                    const _isRunning = instances[tunnel] && await instances[tunnel].isRunning();

                    if (!_isRunning) {
                        await _destroy(tunnel);
                        retryCounter = 60;
                        instanceRunning[tunnel] = false;
                        await _connect(tunnel);
                    }
                }

                // const _isRunning = connectorInstance && await connectorInstance.isRunning();
                // const _secondIsRunning = secondConnectorInstance && await secondConnectorInstance.isRunning();

                // console.log('_isRunning', _isRunning);
                // console.log('connectorInstance', connectorInstance);

                // if (!_isRunning) {
                //     await _destroy();
                //     retryCounter = 60;
                //     isRunning = false;
                //     await _connect();
                // }
                // if (!_secondIsRunning) {
                //     await _destroy();
                //     retryCounter = 60;
                //     secondIsRunning = false;
                //     await _connect();
                // }
                var rand = getRandomInt(LT_TUNNEL_NUMBER);

                capabilities[id].tunnelName = instances[rand] && instances[rand].options.tunnelName;
            }
            catch (err) {
                showTrace('connectorInstance isRunning method error :', err);
                return new Error(err);
            }
            // if (rand === 0) capabilities[id].tunnelName = secondConnectorInstance && await secondConnectorInstance.getTunnelName();
            // else capabilities[id].tunnelName = connectorInstance && await connectorInstance.getTunnelName();
            
            // console.log('capabilities', capabilities[id]);
        }
        catch (err) {
            showTrace('_parseCapabilities Error on isRunning check error :', err);
            return new Error(err);
        }
        // }

        if (PROCESS_ENVIRONMENT.LT_RESOLUTION) capabilities[id].resolution = PROCESS_ENVIRONMENT.LT_RESOLUTION;
        if (PROCESS_ENVIRONMENT.LT_SELENIUM_VERSION) capabilities[id]['selenium_version'] = PROCESS_ENVIRONMENT.LT_SELENIUM_VERSION;
        if (PROCESS_ENVIRONMENT.LT_CONSOLE) capabilities[id].console = true;
        if (PROCESS_ENVIRONMENT.LT_NETWORK) capabilities[id].network = true;
        if (PROCESS_ENVIRONMENT.LT_VIDEO) capabilities[id].video = true;
        if (PROCESS_ENVIRONMENT.LT_SCREENSHOT) capabilities[id].visual = true;
        if (PROCESS_ENVIRONMENT.LT_TIMEZONE) capabilities[id].timezone = PROCESS_ENVIRONMENT.LT_TIMEZONE;
        if (PROCESS_ENVIRONMENT.LT_W3C === true || PROCESS_ENVIRONMENT.LT_W3C === 'true') capabilities[id].w3c = true;

        if (capabilities[id].version === 'any') delete capabilities[id].version;
        if (capabilities[id].platform === 'any') delete capabilities[id].platform;
        if (PROCESS_ENVIRONMENT.LT_SAFARI_COOKIES === true || PROCESS_ENVIRONMENT.LT_SAFARI_COOKIES === 'true') capabilities[id]['safari.cookies'] = true;
        if (PROCESS_ENVIRONMENT.LT_SAFARI_POPUPS === true || PROCESS_ENVIRONMENT.LT_SAFARI_POPUPS === 'true') capabilities[id]['safari.popups'] = true;
        
        if (browserName && browserName.toLowerCase() === 'firefox' && browserVersion && browserVersion.split('.')[0] > 47 && !('enableCustomTranslation' in capabilities[id]))
            capabilities[id].enableCustomTranslation = true;

        // showTrace('Parsed Capabilities ', capabilities[id]);

        return capabilities[id];
    }
    catch (err) {
        showTrace('util._parseCapabilities error :', err);

        return new Error(err);
    }
}
async function _updateJobStatus (sessionID, jobResult, jobData, possibleResults) {
    showTrace('Update Test Status called for ', sessionID);
        
    const testsFailed = jobResult === possibleResults.done ? jobData.total - jobData.passed : 0;
    const jobPassed = jobResult === possibleResults.done && testsFailed === 0;

    let errorReason = '';

    if (testsFailed > 0) errorReason = testsFailed + ' tests failed';
    else if (jobResult === possibleResults.errored) errorReason = jobData.message;
    else if (jobResult === possibleResults.aborted) errorReason = 'Session aborted';

    const options = {
        method: 'PATCH',

        uri: `${AUTOMATION_BASE_URL}/sessions/${sessionID}`,

        headers: {
            'Authorization': `Basic ${Buffer.from(PROCESS_ENVIRONMENT.LT_USERNAME + ':' + PROCESS_ENVIRONMENT.LT_ACCESS_KEY).toString('base64')}`,

            'Content-Type': 'application/json',

            'Accept': 'application/json',

            'client': 'testcafe'
        },

        body: {
            'status_ind': jobPassed ? 'passed' : 'failed',

            'reason': errorReason
        },

        json: true

    };

    return await requestApi(options);
}
async function _waitForTunnelRunning (tunnel) {

    while (!instanceRunning[tunnel]) {
        await sleep(5000);
        retryCounter--;
        instanceRunning[tunnel] = await instances[tunnel].isRunning();
        if (retryCounter <= 0) instanceRunning[tunnel] = true;
    }
    
    // while (!isRunning) {
    //     await sleep(1000);
    //     retryCounter--;
    //     isRunning = await connectorInstance.isRunning();
    //     if (retryCounter <= 0) isRunning = true;
    // }
    // while (!secondIsRunning) {
    //     await sleep(1000);
    //     retryCounter--;
    //     secondIsRunning = await secondConnectorInstance.isRunning();
    //     if (retryCounter <= 0) secondIsRunning = true;
    // }
}
function _saveFile (screenshotPath, base64Data) {
    return new Promise((resolve, reject) => {
        fs.writeFile(screenshotPath, base64Data, 'base64', (err) =>
            err ? reject(err) : resolve()
        );
    });
}
function _getAdditionalCapabilities (filename) {
    return new Promise((resolve, reject) => {
        fs.readFile(filename, 'utf8', (err, data) =>
            err ? reject(err) : resolve(JSON.parse(data))
        );
    });
}
function sleep (ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

function showTrace (message, data) {
    /*eslint no-console: ["error", { allow: ["warn", "log", "error"] }] */
    if (isTraceEnable) {
        console.log(message);
        if (data)
            console.log(data);
    }
}

export default {
    LT_AUTH_ERROR,
    PROCESS_ENVIRONMENT,
    AUTOMATION_DASHBOARD_URL,
    AUTOMATION_HUB_URL,
    LT_TUNNEL_NUMBER,
    _connect,
    _destroy,
    _getBrowserList,
    _parseCapabilities,
    _saveFile,
    _updateJobStatus,
    showTrace
};
