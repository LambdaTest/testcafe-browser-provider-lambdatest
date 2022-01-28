'use strict';
import wd from 'wd';

import { LT_AUTH_ERROR, PROCESS_ENVIRONMENT, AUTOMATION_DASHBOARD_URL, AUTOMATION_HUB_URL, _connect, _destroy, _getBrowserList, _parseCapabilities, _saveFile, _updateJobStatus, showTrace, LT_TUNNEL_NUMBER } from './util';

const WEB_DRIVER_PING_INTERVAL = 30 * 1000;

wd.configureHttp({
    timeout: 15 * 60 * 1000,
    
    retries: -1,
});

export default {
    // Multiple browsers support

    isMultiBrowser: true,

    browserNames: [],
    
    openedBrowsers: { },
    async _startBrowser (id, url, capabilities) {
        showTrace('StartBrowser Initiated for ', id);
        const webDriver = await wd.promiseChainRemote(AUTOMATION_HUB_URL, 80, PROCESS_ENVIRONMENT.LT_USERNAME, PROCESS_ENVIRONMENT.LT_ACCESS_KEY);
        const pingWebDriver = () => ping(webDriver);
        
        showTrace('webDriver ', webDriver);
        showTrace('pingWebDriver', pingWebDriver);

        webDriver.once('status', () => {
            webDriver.pingIntervalId = setInterval(pingWebDriver, WEB_DRIVER_PING_INTERVAL);
            showTrace('pingIntervalId', webDriver.pingIntervalId);
        });
        this.openedBrowsers[id] = webDriver;
        showTrace(capabilities);
        try {
            await webDriver
                .init(capabilities)
                .get(url);

        }
        catch (err) {
            // for (let tunnel = 0; tunnel < LT_TUNNEL_NUMBER; tunnel++) await _destroy(tunnel);
            this.dispose();

            showTrace('Error while starting browser for ', id);
            showTrace(err);
            throw err;
        }
    },
    async _takeScreenshot (id, screenshotPath) {
        const base64Data = await this.openedBrowsers[id].takeScreenshot();
        
        await _saveFile(screenshotPath, base64Data);
    },
    // Required - must be implemented
    // Browser control
    async openBrowser (id, pageUrl, browserName) {
        if (!PROCESS_ENVIRONMENT.LT_USERNAME || !PROCESS_ENVIRONMENT.LT_ACCESS_KEY)
            throw new Error(LT_AUTH_ERROR);

        for (let tunnel = 0; tunnel < LT_TUNNEL_NUMBER; tunnel++) await _connect(tunnel);

        const capabilities = await _parseCapabilities(id, browserName);
        
        if (capabilities instanceof Error) {
            showTrace('openBrowser error on  _parseCapabilities', capabilities);
            this.dispose();
            throw capabilities;
        }
        await this._startBrowser(id, pageUrl, capabilities);
        const sessionUrl = ` ${AUTOMATION_DASHBOARD_URL}/logs/?sessionID=${this.openedBrowsers[id].sessionID} `;
        
        showTrace('sessionURL', sessionUrl);

        this.setUserAgentMetaInfo(id, sessionUrl);
    },

    async closeBrowser (id) {
        showTrace('closeBrowser Initiated for ', id);
        if (this.openedBrowsers[id]) {
            showTrace(this.openedBrowsers[id].sessionID);
            clearInterval(this.openedBrowsers[id].pingIntervalId);
            if (this.openedBrowsers[id].sessionID) {
                try {
                    await this.openedBrowsers[id].quit();
                }
                catch (err) {
                    showTrace(err);
                }
            }
            else {
                showTrace('SessionID not found for ', id);
                showTrace(this.openedBrowsers[id]);
            }
        } 
        else 
            showTrace('Browser not found in OPEN STATE for ', id);
    },

    // Optional - implement methods you need, remove other methods
    // Initialization
    async init () {
        this.browserNames = await _getBrowserList();
    },
    async dispose () {
        showTrace('Dispose Initiated ...');
        try { 
            for (let tunnel = 0; tunnel < LT_TUNNEL_NUMBER; tunnel++) await _destroy(tunnel);

        }
        catch (err) {
            showTrace('Error while destroying ...');
            showTrace(err);
        }
        showTrace('Dispose Completed');
    },
    // Browser names handling
    async getBrowserList () {
        return this.browserNames;
    },

    async isValidBrowserName (/* browserName */) {
        return true;
    },
    

    // Extra methods
    async resizeWindow (id, width, height) {
        const _windowHandle = await this.openedBrowsers[id].windowHandle();
        
        await this.openedBrowsers[id].windowSize(_windowHandle, width, height);
    },

    async maximizeWindow (id) {
        const _windowHandle = await this.openedBrowsers[id].windowHandle();
        
        await this.openedBrowsers[id].maximize(_windowHandle);
    },

    async takeScreenshot (id, screenshotPath) {
        await this._takeScreenshot(id, screenshotPath);
    },
    
    async reportJobResult (id, jobResult, jobData) {
        if (this.openedBrowsers[id] && this.openedBrowsers[id].sessionID) {
            const sessionID = this.openedBrowsers[id].sessionID;

            return await _updateJobStatus(sessionID, jobResult, jobData, this.JOB_RESULT);
        }
        return null;
    }
};

function handlePingError (err, res) {
    if (err) {
        showTrace('ping error :');
        showTrace(err);
    } 
    else {
        showTrace('ignore ping response :');
        showTrace(res);
    }
}

function ping (webDriver) {
    webDriver.safeExecute(1, handlePingError);
}
