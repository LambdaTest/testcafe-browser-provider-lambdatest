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
let BASE_URL = 'https://api.lambdatest.com/api/v1';
let AUTOMATION_BASE_URL = 'https://api.lambdatest.com/automation/api/v1';
let AUTOMATION_DASHBOARD_URL = 'https://automation.lambdatest.com';
let AUTOMATION_HUB_URL = 'hub.lambdatest.com';
const LT_AUTH_ERROR = 'Authentication failed. Please assign the correct username and access key to the LT_USERNAME and LT_ACCESS_KEY environment variables.';
const connectorInstance = { };

if (PROCESS_ENVIRONMENT.BETA_ENABLE) {
    BASE_URL = 'https://beta-api.lambdatest.com/api/v1';
    AUTOMATION_BASE_URL = 'https://beta-api.lambdatest.com/automation/api/v1';
    AUTOMATION_DASHBOARD_URL = 'https://beta-automation.lambdatest.com';
    AUTOMATION_HUB_URL = 'beta-hub.lambdatest.com';
}

async function requestApi (options) {
    const response = await request(options);

    try {
        return JSON.parse(response.body);
    }
    catch (err) {
        return null;
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
        if (deviceList.hasOwnProperty(key)) {
            const element = deviceList[key];
            
            for (const device of element) for (const osVersion of device.osVersion) browserList.push(`${device.deviceName}@${osVersion.version}:${key}`);
        }
    }
    return browserList;
}
async function _connect (id) {
    if (!PROCESS_ENVIRONMENT.LT_USERNAME || !PROCESS_ENVIRONMENT.LT_ACCESS_KEY)
        throw new Error(LT_AUTH_ERROR);
    
    const isRunning = connectorInstance[id] && connectorInstance[id].isRunning() || false;
    
    if (!isRunning) {
        connectorInstance[id] = new LambdaTestTunnel();
        const logFile = PROCESS_ENVIRONMENT.LT_LOGFILE || 'lambdaTunnelLog.log';
        const v = PROCESS_ENVIRONMENT.LT_VERBOSE;
        const tunnelArguments = {
            user: PROCESS_ENVIRONMENT.LT_USERNAME,
            
            key: PROCESS_ENVIRONMENT.LT_ACCESS_KEY,

            logFile: logFile
        };
        
        if (v === 'true' || v === true) tunnelArguments.v = true;
        if (PROCESS_ENVIRONMENT.LT_PROXY_HOST) tunnelArguments.proxyHost = PROCESS_ENVIRONMENT.LT_PROXY_HOST;
        if (PROCESS_ENVIRONMENT.LT_PROXY_PORT) tunnelArguments.proxyPort = PROCESS_ENVIRONMENT.LT_PROXY_PORT;
        if (PROCESS_ENVIRONMENT.LT_PROXY_USER) tunnelArguments.proxyUser = PROCESS_ENVIRONMENT.LT_PROXY_USER;
        if (PROCESS_ENVIRONMENT.LT_PROXY_PASS) tunnelArguments.proxyPass = PROCESS_ENVIRONMENT.LT_PROXY_PASS;
        if (PROCESS_ENVIRONMENT.LT_TUNNEL_NAME) tunnelArguments.tunnelName = PROCESS_ENVIRONMENT.LT_TUNNEL_NAME;
        if (PROCESS_ENVIRONMENT.LT_DIR) tunnelArguments.dir = PROCESS_ENVIRONMENT.LT_DIR;
        await connectorInstance[id].start(tunnelArguments);
    }
}
async function _destroy (id) {
    if (connectorInstance[id]) {
        await connectorInstance[id].stop();
        delete connectorInstance[id];
    }
}
async function _parseCapabilities (id, capability) {
    const testcafeDetail = require('../package.json');
    
    const { browserName, browserVersion, platform } = parseCapabilities(capability)[0];
    
    const lPlatform = platform.toLowerCase();
    
    let capabilities = {
        tunnel: true,

        plugin: `${testcafeDetail.name}:${testcafeDetail.version}`
    };

    if (['ios', 'android'].includes(lPlatform)) {
        //capabilities.platformName = lPlatform;
        capabilities.deviceName = browserName;
        //capabilities.platformVersion = browserVersion;
    }
    else {
        capabilities.browserName = browserName;
        capabilities.version = browserVersion.toLowerCase();
        capabilities.platform = lPlatform;
    }
    if (PROCESS_ENVIRONMENT.LT_CAPABILITY_PATH) {
        let additionalCapabilities = { };
        
        try {
            additionalCapabilities = await _getAdditionalCapabilities(PROCESS_ENVIRONMENT.LT_CAPABILITY_PATH);

        }
        catch (err) {
            additionalCapabilities = { };
        }
        capabilities = {
            ...capabilities,
            ...additionalCapabilities[capability]
        };
    }

    if (PROCESS_ENVIRONMENT.LT_BUILD) capabilities.build = PROCESS_ENVIRONMENT.LT_BUILD;
    capabilities.name = PROCESS_ENVIRONMENT.LT_TEST_NAME || `TestCafe test run ${id}`;
    
    if (PROCESS_ENVIRONMENT.LT_TUNNEL_NAME) capabilities.tunnelName = PROCESS_ENVIRONMENT.LT_TUNNEL_NAME;
    else capabilities.tunnelName = await connectorInstance[id].getTunnelName();
    
    if (PROCESS_ENVIRONMENT.LT_RESOLUTION) capabilities.resolution = PROCESS_ENVIRONMENT.LT_RESOLUTION;
    if (PROCESS_ENVIRONMENT.LT_SELENIUM_VERSION) capabilities['selenium_version'] = PROCESS_ENVIRONMENT.LT_SELENIUM_VERSION;
    if (PROCESS_ENVIRONMENT.LT_CONSOLE) capabilities.console = true;
    if (PROCESS_ENVIRONMENT.LT_NETWORK) capabilities.network = true;
    if (PROCESS_ENVIRONMENT.LT_VIDEO) capabilities.video = true;
    if (PROCESS_ENVIRONMENT.LT_SCREENSHOT) capabilities.visual = true;
    if (PROCESS_ENVIRONMENT.LT_TIMEZONE) capabilities.timezone = PROCESS_ENVIRONMENT.LT_TIMEZONE;
    
    if (capabilities.version === 'any') delete capabilities.version;
    if (capabilities.platform === 'any') delete capabilities.platform;
    
    return capabilities;
}
async function _updateJobStatus (sessionID, jobResult, jobData, possibleResults) {
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
export default {
    LT_AUTH_ERROR,
    PROCESS_ENVIRONMENT,
    AUTOMATION_DASHBOARD_URL,
    AUTOMATION_HUB_URL,
    _connect,
    _destroy,
    _getBrowserList,
    _parseCapabilities,
    _saveFile,
    _updateJobStatus
};
