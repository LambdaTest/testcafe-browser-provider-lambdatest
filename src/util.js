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

var connectorInstances = [];

for (let tunnel = 0; tunnel < LT_TUNNEL_NUMBER; tunnel++) connectorInstances.push({ connectorInstance: null, tunnelArguments: {}, isRunning: false });

const capabilities = { };

let retryCounter = 60;

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
            if (!connectorInstances[tunnel].connectorInstance) {
                connectorInstances[tunnel].connectorInstance = new LambdaTestTunnel();
                const logFile = PROCESS_ENVIRONMENT.LT_LOGFILE || 'lambdaTunnelLog.log';
                const v = PROCESS_ENVIRONMENT.LT_VERBOSE;
    
                connectorInstances[tunnel].tunnelArguments = {
                    user: PROCESS_ENVIRONMENT.LT_USERNAME,
    
                    key: PROCESS_ENVIRONMENT.LT_ACCESS_KEY,
    
                    logFile: logFile,
    
                    controller: 'testcafe'
                };
    
                if (v === 'true' || v === true) connectorInstances[tunnel].tunnelArguments.v = true;
                if (PROCESS_ENVIRONMENT.LT_PROXY_HOST) connectorInstances[tunnel].tunnelArguments.proxyHost = PROCESS_ENVIRONMENT.LT_PROXY_HOST;
                if (PROCESS_ENVIRONMENT.LT_PROXY_PORT) connectorInstances[tunnel].tunnelArguments.proxyPort = PROCESS_ENVIRONMENT.LT_PROXY_PORT;
                if (PROCESS_ENVIRONMENT.LT_PROXY_USER) connectorInstances[tunnel].tunnelArguments.proxyUser = PROCESS_ENVIRONMENT.LT_PROXY_USER;
                if (PROCESS_ENVIRONMENT.LT_PROXY_PASS) connectorInstances[tunnel].tunnelArguments.proxyPass = PROCESS_ENVIRONMENT.LT_PROXY_PASS;
                if (process.env.LT_TUNNEL_NAME) connectorInstances[tunnel].tunnelArguments.tunnelName = process.env.LT_TUNNEL_NAME + tunnel + `-${new Date().getTime()}`;   
                else connectorInstances[tunnel].tunnelArguments.tunnelName = 'TestCafe' + tunnel + `_${PROCESS_ENVIRONMENT.LT_USERNAME}-${new Date().getTime()}`;
    
                if (PROCESS_ENVIRONMENT.LT_DIR) connectorInstances[tunnel].tunnelArguments.dir = PROCESS_ENVIRONMENT.LT_DIR;
    
                if (PROCESS_ENVIRONMENT.LOAD_BALANCED_MODE) connectorInstances[tunnel].tunnelArguments.loadbalanced = true;
    
                await connectorInstances[tunnel].connectorInstance.start(connectorInstances[tunnel].tunnelArguments);
    
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
        if (connectorInstances[tunnel].connectorInstance) {
            const tunnelName = await connectorInstances[tunnel].connectorInstance.getTunnelName();

            showTrace('Stopping Tunnel :', tunnelName);

            await connectorInstances[tunnel].connectorInstance.stop();
            connectorInstances[tunnel].connectorInstance = null;
        }
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

        if (PROCESS_ENVIRONMENT.LT_TUNNEL_NAME) capabilities[id].tunnelName = PROCESS_ENVIRONMENT.LT_TUNNEL_NAME;
        else {
            try {
                // showTrace('ConncetorInstance Data: ', secondConnectorInstance);

                for (let tunnel = 0; tunnel < LT_TUNNEL_NUMBER; tunnel++) {
                    const _isRunning = connectorInstances[tunnel].connectorInstance && await connectorInstances[tunnel].connectorInstance.isRunning();

                    if (!_isRunning) {
                        await _destroy(tunnel);
                        retryCounter = 60;
                        connectorInstances[tunnel].isRunning = false;
                        await _connect(tunnel);
                    }
                }

                var rand = getRandomInt(LT_TUNNEL_NUMBER);

                capabilities[id].tunnelName = await connectorInstances[rand].connectorInstance.getTunnelName();
            } 
            catch (err) {
                showTrace('_parseCapabilities Error on isRunning check error :', err);
                return new Error(err);
            }
        }

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

    while (!connectorInstances[tunnel].isRunning) {
        await sleep(5000);
        retryCounter--;
        connectorInstances[tunnel].isRunning = await connectorInstances[tunnel].connectorInstance.isRunning();
        if (retryCounter <= 0) connectorInstances[tunnel].isRunning = true;
    }

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
