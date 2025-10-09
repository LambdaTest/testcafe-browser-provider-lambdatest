'use strict';
import _request from 'request';
import Promise from 'pinkie';
import pify from 'pify';
import parseCapabilities from 'desired-capabilities';
import LambdaTestTunnel from '@lambdatest/node-tunnel';
import fs from 'fs';
import axios from 'axios';
import {
    PROCESS_ENVIRONMENT,
    BASE_URL,
    MOBILE_BASE_URL,
    AUTOMATION_BASE_URL,
    AUTOMATION_DASHBOARD_URL,
    AUTOMATION_HUB_URL,
    MOBILE_AUTOMATION_HUB_URL,
    LT_AUTH_ERROR,
    LT_TUNNEL_NUMBER,
    INITIAL_RETRY_COUNTER,
    IS_TRACE_ENABLE,
    PLATFORM_ANDROID,
    PLATFORM_IOS,
    PLATFORM_ANY,
    BROWSER_CHROME,
    BROWSER_SAFARI,
    BROWSER_FIREFOX,
    DEVICE_TYPE_REAL,
    DEVICE_TYPE_IS_REAL,
    VERSION_ANY,
    FIREFOX_CUSTOM_TRANSLATION_MIN_VERSION,
    SAFARI_CUSTOM_TRANSLATION_MIN_VERSION,
    HTTP_METHOD_PATCH,
    CONTENT_TYPE_JSON,
    ENCODING_BASE64,
    ENCODING_UTF8,
    JOB_STATUS_PASSED,
    JOB_STATUS_FAILED,
    SESSION_ABORTED_MESSAGE,
    TESTS_FAILED_MESSAGE_SUFFIX,
    DEFAULT_TUNNEL_LOG_FILE,
    TUNNEL_CONTROLLER,
    TUNNEL_NAME_PREFIX,
    TUNNEL_WAIT_INTERVAL,
    CLIENT_TESTCAFE,
    W3C_PREFIX_APPIUM,
    CAPABILITY_KEY_LT_OPTIONS,
    CAPABILITY_KEY_LT_OPTIONS_LOWERCASE,
    CAPABILITY_KEY_SAFARI_COOKIES,
    CAPABILITY_KEY_SAFARI_POPUPS,
    CAPABILITY_KEY_SELENIUM_VERSION,
    CAPABILITY_KEY_BROWSER_VERSION,
} from './consts.js';

const promisify = (fn) => pify(fn, Promise);
const request = promisify(_request, Promise);

var connectorInstances = [];

for (let tunnel = 0; tunnel < LT_TUNNEL_NUMBER; tunnel++) {
    connectorInstances.push({
        connectorInstance: null,
        tunnelArguments:   {},
        isRunning:         false,
    });
}

const capabilities = {};

let retryCounter = INITIAL_RETRY_COUNTER;

var isTraceEnable = IS_TRACE_ENABLE;

/**
 * Asynchronously makes an API request and checks if the response body is valid JSON.
 * 
 * @async
 * @function requestApi
 * 
 * @param {Object} options - Options for API request, including method, headers, and URL.
 * 
 * @returns {Promise<Object|null>} Returns promise resolving to the parsed JSON object if the response is valid JSON, 
 *                                  or null if an error occurs or the response is not valid JSON.
 * 
 * @throws {Error} Throws an error if the request fails.
*/
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

/**
 * Checks if a given string is valid JSON by attempting to parse it.
 * 
 * @function IsJsonString
 * 
 * @param {string} str - The string to be checked for valid JSON format.
 * 
 * @returns {Object|boolean} Returns the parsed JSON object if the input string is valid JSON; 
 *                          otherwise, it returns `false`.
*/
function IsJsonString (str) {
    try {
        return JSON.parse(str);
    }
    // eslint-disable-next-line no-unused-vars
    catch (e) {
        return false;
    }
}

/**
 * Asynchronously retrieves a comprehensive list of available browsers and real devices.
 * 
 * @async
 * @function _getBrowserList
 * 
 * @returns {Promise<string[]>} A promise that resolves to an array of strings, where each string represents
 *                               a browser or device formatted as "<name>@<version>:<os>" or 
 *                               "<deviceName>@<version>:<os>:isReal" for real devices.
 * 
 * @throws {Error} Throws an error if any API requests fail or if data retrieval is unsuccessful.
 */
async function _getBrowserList () {
    let browserList = [];
    const osList = await requestApi(`${BASE_URL}/capability?format=array`);

    for (const os of osList.os) {
        const _browserList = await requestApi(
            `${BASE_URL}/capability?os=${os.id}&format=array`,
        );

        for (const browser of _browserList) {
            for (const version of browser.versions) {
                browserList.push(
                    `${browser.name}@${version.version}:${os.name}`,
                );
            }
        }
    }
    const deviceList = await requestApi(`${BASE_URL}/device`);

    for (const key in deviceList) {
        if (Reflect.has(deviceList, key)) {
            const element = deviceList[key];

            for (const device of element) {
                for (const osVersion of device.osVersion) {
                    browserList.push(
                        `${device.deviceName}@${osVersion.version}:${key}`,
                    );
                }
            }
        }
    }

    //real devices
    await axios.get(`${MOBILE_BASE_URL}/real/list`).then((res) => {
        var iosBrands = res?.data?.ios;
        var androidBrands = res?.data?.android;
        var iosDeviceList = [];
        var androidDeviceList = [];

        iosBrands.map((brand) => {
            const iosDevices = brand?.devices;

            iosDevices.map((device) => {
                if (device?.deviceType === DEVICE_TYPE_REAL) {
                    const osVersion = device?.osVersion;

                    osVersion.map((version) => {
                        if (device?.isRealDevice === 1) {
                            iosDeviceList.push(
                                `${device?.deviceName}@${version?.version}:${PLATFORM_IOS}:${DEVICE_TYPE_IS_REAL}`,
                            );
                        }
                    });
                }
            });
        });

        androidBrands.map((item) => {
            const androidDevices = item?.devices;

            androidDevices.map((device) => {
                if (device?.deviceType === DEVICE_TYPE_REAL) {
                    const osVersion = device?.osVersion;

                    osVersion.map((version) => {
                        if (device?.isRealDevice === 1) {
                            androidDeviceList.push(
                                `${device?.deviceName}@${version?.version}:${PLATFORM_ANDROID}:${DEVICE_TYPE_IS_REAL}`,
                            );
                        }
                    });
                }
            });
        });

        browserList = [...browserList, ...iosDeviceList, ...androidDeviceList];
    });

    return browserList;
}

/**
 * Asynchronously establishes a connection for the specified tunnel using the LambdaTest tunnel instance.
 * 
 * @async
 * @function _connect
 * 
 * @param {number} tunnel - The index of the tunnel to be connected.
 * 
 * @returns {Promise<void>} Returns a promise that resolves when the tunnel connection has been successfully established.
 * 
 * @throws {Error} Throws an error if the connection process fails, including issues with instantiation or starting the tunnel.
 * 
*/
async function _connect (tunnel) {
    try {
        if (!PROCESS_ENVIRONMENT.LT_TUNNEL_NAME) {
            if (!connectorInstances[tunnel].connectorInstance) {
                connectorInstances[tunnel].connectorInstance =
                    new LambdaTestTunnel();
                const logFile =
                    PROCESS_ENVIRONMENT.LT_LOGFILE || DEFAULT_TUNNEL_LOG_FILE;
                const v = PROCESS_ENVIRONMENT.LT_VERBOSE;

                connectorInstances[tunnel].tunnelArguments = {
                    user: PROCESS_ENVIRONMENT.LT_USERNAME,

                    key: PROCESS_ENVIRONMENT.LT_ACCESS_KEY,

                    logFile: logFile,

                    controller: TUNNEL_CONTROLLER,
                };

                if (v === 'true' || v === true)
                    connectorInstances[tunnel].tunnelArguments.v = true;
                if (PROCESS_ENVIRONMENT.LT_MITM) {
                    connectorInstances[tunnel].tunnelArguments.mitm =
                        PROCESS_ENVIRONMENT.LT_MITM;
                }
                if (PROCESS_ENVIRONMENT.LT_PROXY_HOST) {
                    connectorInstances[tunnel].tunnelArguments.proxyHost =
                        PROCESS_ENVIRONMENT.LT_PROXY_HOST;
                }
                if (PROCESS_ENVIRONMENT.LT_PROXY_PORT) {
                    connectorInstances[tunnel].tunnelArguments.proxyPort =
                        PROCESS_ENVIRONMENT.LT_PROXY_PORT;
                }
                if (PROCESS_ENVIRONMENT.LT_PROXY_USER) {
                    connectorInstances[tunnel].tunnelArguments.proxyUser =
                        PROCESS_ENVIRONMENT.LT_PROXY_USER;
                }
                if (PROCESS_ENVIRONMENT.LT_PROXY_PASS) {
                    connectorInstances[tunnel].tunnelArguments.proxyPass =
                        PROCESS_ENVIRONMENT.LT_PROXY_PASS;
                }
                if (process.env.LT_TUNNEL_NAME) {
                    connectorInstances[tunnel].tunnelArguments.tunnelName =
                        process.env.LT_TUNNEL_NAME +
                        tunnel +
                        `-${new Date().getTime()}`;
                }
                else {
                    connectorInstances[tunnel].tunnelArguments.tunnelName =
                        TUNNEL_NAME_PREFIX +
                        tunnel +
                        `_${PROCESS_ENVIRONMENT.LT_USERNAME}-${new Date().getTime()}`;
                }

                if (PROCESS_ENVIRONMENT.LT_DIR) {
                    connectorInstances[tunnel].tunnelArguments.dir =
                        PROCESS_ENVIRONMENT.LT_DIR;
                }

                if (PROCESS_ENVIRONMENT.LOAD_BALANCED_MODE) {
                    connectorInstances[tunnel].tunnelArguments.loadbalanced =
                        true;
                }

                await connectorInstances[tunnel].connectorInstance.start(
                    connectorInstances[tunnel].tunnelArguments,
                );
            }
            await _waitForTunnelRunning(tunnel);
        }
    }
    catch (err) {
        showTrace('_connect error :', err);
    }
}

/**
 * Asynchronously stops and destroys the specified tunnel connection.
 * 
 * @async
 * @function _destroy
 * 
 * @param {number} tunnel - The index of the tunnel to be destroyed.
 * 
 * @returns {Promise<void>} Returns a promise that resolves when the tunnel has been successfully stopped and destroyed.
 * 
 * @throws {Error} Throws an error if any issues occur while stopping the tunnel or retrieving the tunnel name.
 * 
 */
async function _destroy (tunnel) {
    try {
        if (connectorInstances[tunnel].connectorInstance) {
            const tunnelName =
                await connectorInstances[
                    tunnel
                ].connectorInstance.getTunnelName();

            showTrace('Stopping Tunnel :', tunnelName);

            await connectorInstances[tunnel].connectorInstance.stop();
            connectorInstances[tunnel].connectorInstance = null;
        }
    }
    catch (err) {
        showTrace('util._destroy error :', err);
    }
}

/**
 * Generates a random integer between 0 (inclusive) and the specified maximum value (exclusive).
 * 
 * @function getRandomInt
 * 
 * @param {number} max - The upper limit (exclusive) for the random integer generation.
 * 
 * @returns {number} A random integer between 0 (inclusive) and max (exclusive).
 * 
 * @example
 * // Generate a random integer between 0 and 10
 * const randomInt = getRandomInt(10);
 */
function getRandomInt (max) {
    return Math.floor(Math.random() * max);
}

/**
 * Parses the capabilities for a specific browser session based on the provided ID and capability string.
 * 
 * @async
 * @function _parseCapabilities
 * 
 * @param {string} id - The unique identifier for the browser session.
 * @param {string} capability - A string representing the capabilities to be parsed.
 * 
 * @returns {Promise<Object|Error>} A promise that resolves to an object containing the parsed capabilities
 *                                   for the specified session, or an Error object if an error occurs.
 * 
 * @throws {Error} Throws an error if there is an issue with parsing the capabilities or managing tunnels.
 * 
 */
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
            tunnel: true,

            plugin: `${testcafeDetail.name}:${testcafeDetail.version}`,
        };

        if (capability.indexOf(DEVICE_TYPE_IS_REAL) > 0) {
            browserName = capability.split('@')[0];
            lPlatform = platform.split(':')[0];
            capabilities[id].isRealMobile = true;
            if (process.env.LT_VISUAL) capabilities[id].visual = true;
        }

        if (lPlatform === PLATFORM_ANDROID) capabilities[id].browserName = BROWSER_CHROME;
        else if (lPlatform === PLATFORM_IOS) capabilities[id].browserName = BROWSER_SAFARI;

        if ([PLATFORM_IOS, PLATFORM_ANDROID].includes(lPlatform)) {
            capabilities[id].platformName = lPlatform;
            capabilities[id].deviceName = browserName;
            capabilities[id].platformVersion = browserVersion;
        }
        else {
            capabilities[id].browserName = browserName;
            capabilities[id].version = browserVersion.toLowerCase();
            capabilities[id].platform = lPlatform;
        }
        let additionalCapabilities = {};

        if (PROCESS_ENVIRONMENT.LT_CAPABILITY_PATH) {
            try {
                additionalCapabilities = await _getAdditionalCapabilities(
                    PROCESS_ENVIRONMENT.LT_CAPABILITY_PATH,
                );
            }
            catch (err) {
                showTrace(
                    'Error while adding additionalCapabilities from file : ' +
                        PROCESS_ENVIRONMENT.LT_CAPABILITY_PATH +
                        '  ErrorTrace :',
                    err,
                );
                additionalCapabilities = {};
            }
            capabilities[id] = {
                ...capabilities[id],
                ...additionalCapabilities[capability],
            };
        }

        if (
            capabilities[id].appiumVersion ||
            capabilities[id][CAPABILITY_KEY_LT_OPTIONS]?.appiumVersion ||
            capabilities[id][CAPABILITY_KEY_LT_OPTIONS_LOWERCASE]?.appiumVersion
        ) {
            capabilities[id].allowW3C = true;
            capabilities[id].w3cPrefix = W3C_PREFIX_APPIUM;
        }

        if (PROCESS_ENVIRONMENT.LT_BUILD)
            capabilities[id].build = PROCESS_ENVIRONMENT.LT_BUILD;
        capabilities[id].name =
            PROCESS_ENVIRONMENT.LT_TEST_NAME ||
            capabilities[id].name ||
            `TestCafe test run ${id}`;

        if (PROCESS_ENVIRONMENT.LT_TUNNEL_NAME)
            capabilities[id].tunnelName = PROCESS_ENVIRONMENT.LT_TUNNEL_NAME;
        else {
            try {
                // showTrace('ConncetorInstance Data: ', secondConnectorInstance);

                for (let tunnel = 0; tunnel < LT_TUNNEL_NUMBER; tunnel++) {
                    const _isRunning =
                        connectorInstances[tunnel].connectorInstance &&
                        await connectorInstances[
                            tunnel
                        ].connectorInstance.isRunning();

                    if (!_isRunning) {
                        await _destroy(tunnel);
                        retryCounter = INITIAL_RETRY_COUNTER;
                        connectorInstances[tunnel].isRunning = false;
                        await _connect(tunnel);
                    }
                }

                var rand = getRandomInt(LT_TUNNEL_NUMBER);

                capabilities[id].tunnelName =
                    await connectorInstances[
                        rand
                    ].connectorInstance.getTunnelName();
            }
            catch (err) {
                showTrace(
                    '_parseCapabilities Error on isRunning check error :',
                    err,
                );
                return new Error(err);
            }
        }

        if (PROCESS_ENVIRONMENT.LT_RESOLUTION)
            capabilities[id].resolution = PROCESS_ENVIRONMENT.LT_RESOLUTION;
        if (PROCESS_ENVIRONMENT.LT_SELENIUM_VERSION) {
            capabilities[id][CAPABILITY_KEY_SELENIUM_VERSION] =
                PROCESS_ENVIRONMENT.LT_SELENIUM_VERSION;
        }
        if (PROCESS_ENVIRONMENT.LT_CONSOLE) capabilities[id].console = true;
        if (PROCESS_ENVIRONMENT.LT_NETWORK) capabilities[id].network = true;
        if (PROCESS_ENVIRONMENT.LT_VIDEO) capabilities[id].video = true;
        if (PROCESS_ENVIRONMENT.LT_SCREENSHOT) capabilities[id].visual = true;
        if (PROCESS_ENVIRONMENT.LT_TIMEZONE)
            capabilities[id].timezone = PROCESS_ENVIRONMENT.LT_TIMEZONE;
        if (
            PROCESS_ENVIRONMENT.LT_W3C === true ||
            PROCESS_ENVIRONMENT.LT_W3C === 'true'
        )
            capabilities[id].w3c = true;

        if (capabilities[id].version === VERSION_ANY) delete capabilities[id].version;
        if (capabilities[id].platform === PLATFORM_ANY)
            delete capabilities[id].platform;
        if (
            PROCESS_ENVIRONMENT.LT_SAFARI_COOKIES === true ||
            PROCESS_ENVIRONMENT.LT_SAFARI_COOKIES === 'true'
        )
            capabilities[id][CAPABILITY_KEY_SAFARI_COOKIES] = true;
        if (
            PROCESS_ENVIRONMENT.LT_SAFARI_POPUPS === true ||
            PROCESS_ENVIRONMENT.LT_SAFARI_POPUPS === 'true'
        )
            capabilities[id][CAPABILITY_KEY_SAFARI_POPUPS] = true;

        if (
            browserName &&
            browserName.trim().toLowerCase() === BROWSER_FIREFOX &&
            browserVersion &&
            browserVersion.split('.')[0] > FIREFOX_CUSTOM_TRANSLATION_MIN_VERSION &&
            !('enableCustomTranslation' in capabilities[id])
        )
            capabilities[id].enableCustomTranslation = true;

        if (
            browserName &&
            browserName.trim().toLowerCase() === BROWSER_SAFARI &&
            browserVersion &&
            browserVersion.split('.')[0] > SAFARI_CUSTOM_TRANSLATION_MIN_VERSION &&
            !('enableCustomTranslation' in capabilities[id])
        )
            capabilities[id].enableCustomTranslation = true;
        if (
            !browserVersion ||
            browserVersion === VERSION_ANY &&
                typeof additionalCapabilities[capability] !== 'undefined'
        ) {
            const browserVersionKey =
                additionalCapabilities[capability][CAPABILITY_KEY_BROWSER_VERSION];

            if (
                browserName &&
                browserName.trim().toLowerCase() === BROWSER_FIREFOX &&
                browserVersionKey &&
                browserVersionKey.split('.')[0] > FIREFOX_CUSTOM_TRANSLATION_MIN_VERSION &&
                !('enableCustomTranslation' in capabilities[id])
            )
                capabilities[id].enableCustomTranslation = true;
            if (
                browserName &&
                browserName.trim().toLowerCase() === BROWSER_SAFARI &&
                browserVersionKey &&
                browserVersionKey.split('.')[0] > SAFARI_CUSTOM_TRANSLATION_MIN_VERSION &&
                !('enableCustomTranslation' in capabilities[id])
            )
                capabilities[id].enableCustomTranslation = true;
        }
        // showTrace('Parsed Capabilities ', capabilities[id]);

        return capabilities[id];
    }
    catch (err) {
        showTrace('util._parseCapabilities error :', err);

        return new Error(err);
    }
}

/**
 * Updates the job status of a session based on the results of a test run.
 * 
 * @async
 * @function _updateJobStatus
 * 
 * @param {string} sessionID - The unique identifier of the session whose job status is to be updated.
 * @param {string} jobResult - The result of the job (e.g., 'done', 'errored', 'aborted').
 * @param {Object} jobData - An object containing information about the job, including total and passed tests.
 * @param {Object} possibleResults - An object that defines possible job result values for comparison.
 * 
 * @returns {Promise<Object>} A promise that resolves to the response from the request to update the job status.
 * 
 * @throws {Error} Throws an error if the request to update the job status fails.
 * 
 */
async function _updateJobStatus (
    sessionID,
    jobResult,
    jobData,
    possibleResults,
) {
    showTrace('Update Test Status called for ', sessionID);

    const testsFailed =
        jobResult === possibleResults.done ? jobData.total - jobData.passed : 0;
    const jobPassed = jobResult === possibleResults.done && testsFailed === 0;

    let errorReason = '';

    if (testsFailed > 0) errorReason = testsFailed + TESTS_FAILED_MESSAGE_SUFFIX;
    else if (jobResult === possibleResults.errored)
        errorReason = jobData.message;
    else if (jobResult === possibleResults.aborted)
        errorReason = SESSION_ABORTED_MESSAGE;

    const options = {
        method: HTTP_METHOD_PATCH,

        uri: `${AUTOMATION_BASE_URL}/sessions/${sessionID}`,

        headers: {
            Authorization: `Basic ${Buffer.from(PROCESS_ENVIRONMENT.LT_USERNAME + ':' + PROCESS_ENVIRONMENT.LT_ACCESS_KEY).toString('base64')}`,

            'Content-Type': CONTENT_TYPE_JSON,

            Accept: CONTENT_TYPE_JSON,

            client: CLIENT_TESTCAFE,
        },

        body: {
            // eslint-disable-next-line camelcase
            status_ind: jobPassed ? JOB_STATUS_PASSED : JOB_STATUS_FAILED,

            reason: errorReason,
        },

        json: true,
    };

    return await requestApi(options);
}

/**
 * Waits for a specified tunnel to be in a running state.
 * 
 * @async
 * @function _waitForTunnelRunning
 * 
 * @param {number} tunnel - The index of the tunnel to check for its running status.
 * 
 * @returns {Promise<void>} A promise that resolves when the tunnel is confirmed to be running.
 * 
 * @throws {Error} Throws an error if the tunnel instance is not properly initialized or if there is an issue
 * checking the running status of the tunnel.
 * 
 */
async function _waitForTunnelRunning (tunnel) {
    while (!connectorInstances[tunnel].isRunning) {
        await sleep(TUNNEL_WAIT_INTERVAL);
        retryCounter--;
        connectorInstances[tunnel].isRunning =
            await connectorInstances[tunnel].connectorInstance.isRunning();
        if (retryCounter <= 0) connectorInstances[tunnel].isRunning = true;
    }
}

/**
 * Saves a file with the provided base64 data to the specified path.
 * 
 * @function _saveFile
 * 
 * @param {string} screenshotPath - The path where the file should be saved, including the file name.
 * @param {string} base64Data - The base64 encoded data to be written to the file.
 * 
 * @returns {Promise<void>} A promise that resolves when the file is successfully saved.
 * 
 * @throws {Error} Throws an error if there is an issue writing the file.
 * 
 */
function _saveFile (screenshotPath, base64Data) {
    return new Promise((resolve, reject) => {
        fs.writeFile(screenshotPath, base64Data, ENCODING_BASE64, (err) =>
            err ? reject(err) : resolve(),
        );
    });
}

/**
 * Retrieves additional capabilities from a JSON file.
 * 
 * @function _getAdditionalCapabilities
 * 
 * @param {string} filename - The path to the JSON file containing additional capabilities.
 * 
 * @returns {Promise<Object>} A promise that resolves with the parsed JSON data.
 * 
 * @throws {Error} Throws an error if there is an issue reading or parsing the file.
 * 
 */
function _getAdditionalCapabilities (filename) {
    return new Promise((resolve, reject) => {
        fs.readFile(filename, ENCODING_UTF8, (err, data) =>
            err ? reject(err) : resolve(JSON.parse(data)),
        );
    });
}

/**
 * Creates a promise that resolves after a specified amount of time.
 * 
 * @function sleep
 * 
 * @param {number} ms - The number of milliseconds to sleep.
 * 
 * @returns {Promise<void>} A promise that resolves after the specified duration.
 * 
 */
function sleep (ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

/**
 * Logs a message and optional data to the console if tracing is enabled.
 * 
 * @function showTrace
 * 
 * @param {string} message - The message to log to the console.
 * @param {*} [data] - Optional data to log along with the message. This can be of any type.
 * 
 * @returns {void}
 * 
 */
function showTrace (message, data) {
    /*eslint no-console: ["error", { allow: ["warn", "log", "error"] }] */
    if (isTraceEnable) {
        console.log(message);
        if (data) console.log(data);
    }
}

export default {
    LT_AUTH_ERROR,
    PROCESS_ENVIRONMENT,
    AUTOMATION_DASHBOARD_URL,
    AUTOMATION_HUB_URL,
    LT_TUNNEL_NUMBER,
    MOBILE_AUTOMATION_HUB_URL,
    _connect,
    _destroy,
    _getBrowserList,
    _parseCapabilities,
    _saveFile,
    _updateJobStatus,
    showTrace,
};
