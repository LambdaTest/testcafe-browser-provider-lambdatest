'use strict';

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
const INITIAL_RETRY_COUNTER = 60;
const IS_TRACE_ENABLE = !!PROCESS_ENVIRONMENT.LT_ENABLE_TRACE;

// Platform constants
const PLATFORM_ANDROID = 'android';
const PLATFORM_IOS = 'ios';
const PLATFORM_ANY = 'any';

// Browser constants
const BROWSER_CHROME = 'chrome';
const BROWSER_SAFARI = 'safari';
const BROWSER_FIREFOX = 'firefox';

// Device type constants
const DEVICE_TYPE_REAL = 'real';
const DEVICE_TYPE_IS_REAL = 'isReal';

// Version constants
const VERSION_ANY = 'any';
const FIREFOX_CUSTOM_TRANSLATION_MIN_VERSION = 47;
const SAFARI_CUSTOM_TRANSLATION_MIN_VERSION = 11;

// HTTP constants
const HTTP_METHOD_PATCH = 'PATCH';
const CONTENT_TYPE_JSON = 'application/json';
const ENCODING_BASE64 = 'base64';
const ENCODING_UTF8 = 'utf8';

// Status constants
const JOB_STATUS_PASSED = 'passed';
const JOB_STATUS_FAILED = 'failed';
const SESSION_ABORTED_MESSAGE = 'Session aborted';
const TESTS_FAILED_MESSAGE_SUFFIX = ' tests failed';

// Tunnel constants
const DEFAULT_TUNNEL_LOG_FILE = 'lambdaTunnelLog.log';
const TUNNEL_CONTROLLER = 'testcafe';
const TUNNEL_NAME_PREFIX = 'TestCafe';
const TUNNEL_WAIT_INTERVAL = 5000;

// Client identifier
const CLIENT_TESTCAFE = 'testcafe';

// W3C constants
const W3C_PREFIX_APPIUM = 'appium';

// Capability keys
const CAPABILITY_KEY_LT_OPTIONS = 'LT:Options';
const CAPABILITY_KEY_LT_OPTIONS_LOWERCASE = 'lt:options';
const CAPABILITY_KEY_SAFARI_COOKIES = 'safari.cookies';
const CAPABILITY_KEY_SAFARI_POPUPS = 'safari.popups';
const CAPABILITY_KEY_SELENIUM_VERSION = 'selenium_version';
const CAPABILITY_KEY_BROWSER_VERSION = 'browserVersion';

export {
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
};
