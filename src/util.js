'use strict';
import _request from 'request';
import Promise from 'pinkie';
import pify from 'pify';
import parseCapabilities from 'desired-capabilities';
import LambdaTestTunnel from '@lambdatest/node-tunnel';
import fs from 'fs';
import axios from 'axios';

const promisify = (fn) => pify(fn, Promise);
const request = promisify(_request, Promise);

const PROCESS_ENVIRONMENT = process.env;
const BASE_URL = 'https://api.lambdatest.com/api/v1';
const MOBILE_BASE_URL =
    'https://mobile-api.lambdatest.com/mobile-automation/api/v1';
const AUTOMATION_BASE_URL = 'https://api.lambdatest.com/automation/api/v1';
const AUTOMATION_DASHBOARD_URL = 'https://automation.lambdatest.com';
const AUTOMATION_HUB_URL = process.env.LT_GRID_URL || 'hub.lambdatest.com';
const MOBILE_AUTOMATION_HUB_URL =
    process.env.LT_MOBILE_GRID_URL || 'beta-hub.lambdatest.com';
const LT_AUTH_ERROR =
    'Authentication failed. Please assign the correct username and access key to the LT_USERNAME and LT_ACCESS_KEY environment variables.';
const LT_TUNNEL_NUMBER = process.env.LT_TUNNEL_NUMBER || 1;

var connectorInstances = [];

for (let tunnel = 0; tunnel < LT_TUNNEL_NUMBER; tunnel++) {
    connectorInstances.push({
        connectorInstance: null,
        tunnelArguments:   {},
        isRunning:         false,
    });
}

const capabilities = {};

let retryCounter = 60;

var isTraceEnable = false;

if (PROCESS_ENVIRONMENT.LT_ENABLE_TRACE) isTraceEnable = true;

/**
 * Asynchronously makes an API request and checks if the response body is valid JSON.
 * 
 * This function sends a request using the specified options and attempts to parse the response body
 * as JSON. If successful, it returns the parsed JSON; otherwise, it logs the response body and any
 * errors encountered during the parsing process.
 * 
 * @async
 * @function requestApi
 * 
 * @param {Object} options - The options for the API request, typically including method, headers, and URL.
 * 
 * @returns {Promise<Object|null>} Returns a promise that resolves to the parsed JSON object if the response is valid JSON, 
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
 * This function takes a string input and tries to parse it using `JSON.parse()`.
 * If the parsing is successful, it returns the parsed object. If parsing fails, 
 * it catches the error and returns `false`, indicating that the string is not valid JSON.
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
 * This function makes several API requests to gather information about supported browsers across different 
 * operating systems and real mobile devices. The resulting data is formatted and returned as an array of strings,
 * where each string represents a browser or device in the format "<name>@<version>:<os>".
 * 
 * The function performs the following steps:
 * - Fetches the list of operating systems.
 * - For each OS, retrieves the corresponding browsers and their versions.
 * - Fetches a list of devices and their OS versions.
 * - Retrieves information about real iOS and Android devices.
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
                if (device?.deviceType === 'real') {
                    const osVersion = device?.osVersion;

                    osVersion.map((version) => {
                        if (device?.isRealDevice === 1) {
                            iosDeviceList.push(
                                `${device?.deviceName}@${version?.version}:ios:isReal`,
                            );
                        }
                    });
                }
            });
        });

        androidBrands.map((item) => {
            const androidDevices = item?.devices;

            androidDevices.map((device) => {
                if (device?.deviceType === 'real') {
                    const osVersion = device?.osVersion;

                    osVersion.map((version) => {
                        if (device?.isRealDevice === 1) {
                            androidDeviceList.push(
                                `${device?.deviceName}@${version?.version}:android:isReal`,
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
 * This function checks if a tunnel name is defined in the environment variables and sets up a new 
 * LambdaTest tunnel connection if not already instantiated. It configures various connection parameters 
 * based on the provided environment variables, such as username, access key, proxy settings, and tunnel name.
 * 
 * After setting up the connection, it waits for the tunnel to be fully operational.
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
 * @example
 * // Connect to tunnel 0
 * await _connect(0);
*/
async function _connect (tunnel) {
    try {
        if (!PROCESS_ENVIRONMENT.LT_TUNNEL_NAME) {
            if (!connectorInstances[tunnel].connectorInstance) {
                connectorInstances[tunnel].connectorInstance =
                    new LambdaTestTunnel();
                const logFile =
                    PROCESS_ENVIRONMENT.LT_LOGFILE || 'lambdaTunnelLog.log';
                const v = PROCESS_ENVIRONMENT.LT_VERBOSE;

                connectorInstances[tunnel].tunnelArguments = {
                    user: PROCESS_ENVIRONMENT.LT_USERNAME,

                    key: PROCESS_ENVIRONMENT.LT_ACCESS_KEY,

                    logFile: logFile,

                    controller: 'testcafe',
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
                        'TestCafe' +
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
 * This function checks if a tunnel connection instance exists for the given tunnel index. 
 * If it does, it retrieves the tunnel's name, logs the stopping action, and then stops the 
 * tunnel connection. After stopping, it cleans up the instance by setting it to `null`.
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
 * @example
 * // Destroy tunnel 0
 * await _destroy(0);
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
 * This function uses the Math.random() method to generate a random floating-point number,
 * multiplies it by the maximum value, and then rounds it down to the nearest whole number using Math.floor().
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
 * This function reads the browser name, version, and platform from the capability string, and
 * constructs a capabilities object that includes additional options based on environment variables.
 * It also manages tunnel connections and retrieves additional capabilities if specified.
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
 * @example
 * // Example usage of _parseCapabilities
 * try {
 *     const capabilities = await _parseCapabilities('session123', 'chrome@latest:windows');
 *     console.log(capabilities);
 * } catch (error) {
 *     console.error('Error parsing capabilities:', error);
 * }
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
            capabilities[id]['LT:Options']?.appiumVersion ||
            capabilities[id]['lt:options']?.appiumVersion
        ) {
            capabilities[id].allowW3C = true;
            capabilities[id].w3cPrefix = 'appium';
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
                        retryCounter = 60;
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
            capabilities[id]['selenium_version'] =
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

        if (capabilities[id].version === 'any') delete capabilities[id].version;
        if (capabilities[id].platform === 'any')
            delete capabilities[id].platform;
        if (
            PROCESS_ENVIRONMENT.LT_SAFARI_COOKIES === true ||
            PROCESS_ENVIRONMENT.LT_SAFARI_COOKIES === 'true'
        )
            capabilities[id]['safari.cookies'] = true;
        if (
            PROCESS_ENVIRONMENT.LT_SAFARI_POPUPS === true ||
            PROCESS_ENVIRONMENT.LT_SAFARI_POPUPS === 'true'
        )
            capabilities[id]['safari.popups'] = true;

        if (
            browserName &&
            browserName.trim().toLowerCase() === 'firefox' &&
            browserVersion &&
            browserVersion.split('.')[0] > 47 &&
            !('enableCustomTranslation' in capabilities[id])
        )
            capabilities[id].enableCustomTranslation = true;

        if (
            browserName &&
            browserName.trim().toLowerCase() === 'safari' &&
            browserVersion &&
            browserVersion.split('.')[0] > 11 &&
            !('enableCustomTranslation' in capabilities[id])
        )
            capabilities[id].enableCustomTranslation = true;
        if (
            !browserVersion ||
            browserVersion === 'any' &&
                typeof additionalCapabilities[capability] !== 'undefined'
        ) {
            const browserVersionKey =
                additionalCapabilities[capability]['browserVersion'];

            if (
                browserName &&
                browserName.trim().toLowerCase() === 'firefox' &&
                browserVersionKey &&
                browserVersionKey.split('.')[0] > 47 &&
                !('enableCustomTranslation' in capabilities[id])
            )
                capabilities[id].enableCustomTranslation = true;
            if (
                browserName &&
                browserName.trim().toLowerCase() === 'safari' &&
                browserVersionKey &&
                browserVersionKey.split('.')[0] > 11 &&
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
 * This function sends a PATCH request to update the session status on the automation server.
 * It determines the outcome of the test based on the provided job result and generates an 
 * appropriate error reason if any tests have failed.
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
 * @example
 * // Example usage of _updateJobStatus
 * try {
 *     const response = await _updateJobStatus('session123', 'done', { total: 5, passed: 5 }, possibleResults);
 *     console.log('Job status updated:', response);
 * } catch (error) {
 *     console.error('Error updating job status:', error);
 * }
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

    if (testsFailed > 0) errorReason = testsFailed + ' tests failed';
    else if (jobResult === possibleResults.errored)
        errorReason = jobData.message;
    else if (jobResult === possibleResults.aborted)
        errorReason = 'Session aborted';

    const options = {
        method: 'PATCH',

        uri: `${AUTOMATION_BASE_URL}/sessions/${sessionID}`,

        headers: {
            Authorization: `Basic ${Buffer.from(PROCESS_ENVIRONMENT.LT_USERNAME + ':' + PROCESS_ENVIRONMENT.LT_ACCESS_KEY).toString('base64')}`,

            'Content-Type': 'application/json',

            Accept: 'application/json',

            client: 'testcafe',
        },

        body: {
            // eslint-disable-next-line camelcase
            status_ind: jobPassed ? 'passed' : 'failed',

            reason: errorReason,
        },

        json: true,
    };

    return await requestApi(options);
}

/**
 * Waits for a specified tunnel to be in a running state.
 * 
 * This function continuously checks if the specified tunnel is running by polling its status
 * every 5 seconds. If the tunnel is not running, it decrements a retry counter. If the retry 
 * counter reaches zero, the function assumes the tunnel is running to exit the loop.
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
 * @example
 * // Example usage of _waitForTunnelRunning
 * try {
 *     await _waitForTunnelRunning(0);
 *     console.log('Tunnel is now running.');
 * } catch (error) {
 *     console.error('Error waiting for tunnel:', error);
 * }
 */
async function _waitForTunnelRunning (tunnel) {
    while (!connectorInstances[tunnel].isRunning) {
        await sleep(5000);
        retryCounter--;
        connectorInstances[tunnel].isRunning =
            await connectorInstances[tunnel].connectorInstance.isRunning();
        if (retryCounter <= 0) connectorInstances[tunnel].isRunning = true;
    }
}

/**
 * Saves a file with the provided base64 data to the specified path.
 * 
 * This function creates a promise that resolves when the file has been successfully written
 * to the specified path, or rejects with an error if the operation fails.
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
 * @example
 * // Example usage of _saveFile
 * const screenshotPath = './screenshots/screenshot.png';
 * const base64Data = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...'; // Example base64 data
 * 
 * _saveFile(screenshotPath, base64Data)
 *     .then(() => {
 *         console.log('File saved successfully!');
 *     })
 *     .catch((error) => {
 *         console.error('Error saving file:', error);
 *     });
 */
function _saveFile (screenshotPath, base64Data) {
    return new Promise((resolve, reject) => {
        fs.writeFile(screenshotPath, base64Data, 'base64', (err) =>
            err ? reject(err) : resolve(),
        );
    });
}

/**
 * Retrieves additional capabilities from a JSON file.
 * 
 * This function reads a JSON file asynchronously and parses its content. 
 * It returns a promise that resolves with the parsed data if successful, 
 * or rejects with an error if reading or parsing the file fails.
 * 
 * @function _getAdditionalCapabilities
 * 
 * @param {string} filename - The path to the JSON file containing additional capabilities.
 * 
 * @returns {Promise<Object>} A promise that resolves with the parsed JSON data.
 * 
 * @throws {Error} Throws an error if there is an issue reading or parsing the file.
 * 
 * @example
 * // Example usage of _getAdditionalCapabilities
 * const capabilitiesFile = './path/to/capabilities.json';
 * 
 * _getAdditionalCapabilities(capabilitiesFile)
 *     .then((capabilities) => {
 *         console.log('Additional capabilities:', capabilities);
 *     })
 *     .catch((error) => {
 *         console.error('Error reading additional capabilities:', error);
 *     });
 */
function _getAdditionalCapabilities (filename) {
    return new Promise((resolve, reject) => {
        fs.readFile(filename, 'utf8', (err, data) =>
            err ? reject(err) : resolve(JSON.parse(data)),
        );
    });
}

/**
 * Creates a promise that resolves after a specified amount of time.
 * 
 * This function can be used to pause execution in asynchronous functions 
 * for a given duration specified in milliseconds. It utilizes the 
 * `setTimeout` function to delay resolution of the promise.
 * 
 * @function sleep
 * 
 * @param {number} ms - The number of milliseconds to sleep.
 * 
 * @returns {Promise<void>} A promise that resolves after the specified duration.
 * 
 * @example
 * // Example usage of sleep function
 * async function demo() {
 *     console.log('Sleeping for 2 seconds...');
 *     await sleep(2000);
 *     console.log('Awake now!');
 * }
 * 
 * demo();
 */
function sleep (ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

/**
 * Logs a message and optional data to the console if tracing is enabled.
 * 
 * This function is used for debugging purposes, allowing developers to trace
 * execution flow and inspect variables at runtime. Tracing can be enabled or
 * disabled using the `isTraceEnable` flag. When enabled, it logs the message
 * and, if provided, any additional data to the console.
 * 
 * @function showTrace
 * 
 * @param {string} message - The message to log to the console.
 * @param {*} [data] - Optional data to log along with the message. This can be of any type.
 * 
 * @returns {void}
 * 
 * @example
 * // Example usage of showTrace function
 * const isTraceEnable = true;
 * showTrace('This is a debug message', { key: 'value' });
 * 
 * // Output:
 * // This is a debug message
 * // { key: 'value' }
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
