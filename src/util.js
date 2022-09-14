'use strict';
import _request from 'request';
import Promise from 'pinkie';
import pify from 'pify';
import parseCapabilities from 'desired-capabilities';
import fs from 'fs';
import axios from 'axios';

const promisify = fn => pify(fn, Promise);
const request   = promisify(_request, Promise);

const PROCESS_ENVIRONMENT = process.env;
const BASE_URL = 'https://api.lambdatest.com/api/v1';
const MOBILE_BASE_URL = 'https://beta-api.lambdatest.com/api/v1';
const AUTOMATION_BASE_URL = 'https://api.lambdatest.com/automation/api/v1';
const AUTOMATION_DASHBOARD_URL = 'https://automation.lambdatest.com';
const AUTOMATION_HUB_URL = process.env.LT_GRID_URL || 'hub.lambdatest.com';
const MOBILE_AUTOMATION_HUB_URL = process.env.LT_MOBILE_GRID_URL || 'beta-hub.lambdatest.com';
const LT_AUTH_ERROR = 'Authentication failed. Please assign the correct username and access key to the LT_USERNAME and LT_ACCESS_KEY environment variables.';

const capabilities = { };

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
    let browserList = [];
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


    //real devices
    await axios.get(`${MOBILE_BASE_URL}/device?sort=brand&real=true`).then((res) => {
        const iosDevices = res.data.ios;

        const androidBrands = res.data.android;

        const iosDeviceList = [];

        const androidDeviceList = [];

        iosDevices.map((item) => {
            const osVersion = item.osVersion;

            if (item.deviceType === 'real') {
                osVersion.map((version) => {
                    if (version.isRealDevice === 1) iosDeviceList.push(`${item.deviceName}@${version.version}:ios:isReal`);
                });
            }
        });

        androidBrands.map((item) => {
            const androidDevices = item.devices;

            androidDevices.map((device) => {
                if (device.deviceType === 'real') {
                    const osVersion = device.osVersion;

                    osVersion.map((version) => {
                        if (version.isRealDevice === 1) androidDeviceList.push(`${device.deviceName}@${version.version}:android:isReal`);
                    });
                }
            });
        });

        browserList = [...browserList, ...iosDeviceList, ...androidDeviceList];
    });

    return browserList;
}

async function _parseCapabilities (id, capability) {
    try {
        const testcafeDetail = require('../package.json');

        // showTrace('capability', capability);
        const parseCapabilitiesData = parseCapabilities(capability)[0];

        let browserName = parseCapabilitiesData.browserName;

        const browserVersion = parseCapabilitiesData.browserVersion;
        const platform = parseCapabilitiesData.platform;        

        let lPlatform = platform.toLowerCase();
        
        capabilities[id] = {
            plugin: `${testcafeDetail.name}:${testcafeDetail.version}`
        };

        if (capability.indexOf('isReal') > 0) {
            browserName = capability.split('@')[0];
            lPlatform = platform.split(':')[0];
            capabilities[id].isRealMobile = true;
            if (process.env.LT_VISUAL) capabilities[id].visual = true;
        }

        if (lPlatform === 'android') capabilities[id].browserName = 'chrome';
        else if (lPlatform === 'ios') capabilities[id].browserName = 'safari';

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
        capabilities[id].name = PROCESS_ENVIRONMENT.LT_TEST_NAME || capabilities[id].name || `TestCafe test run ${id}`;

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
    MOBILE_AUTOMATION_HUB_URL,
    _getBrowserList,
    _parseCapabilities,
    _saveFile,
    _updateJobStatus,
    showTrace
};
