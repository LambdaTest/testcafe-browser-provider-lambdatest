'use strict';
import wd from 'wd';
import { LT_AUTH_ERROR, PROCESS_ENVIRONMENT, _connect, _destroy, _getBrowserList, _parseCapabilities, _saveFile, _updateJobStatus } from './util';
const AUTOMATION_DASHBOARD_URL = 'https://automation.lambdatest.com';

wd.configureHttp({
    timeout: 15 * 60000
});

export default {
    // Multiple browsers support
    isMultiBrowser: true,
    
    browserNames: [],
    
    openedBrowsers: { },
    async _startBrowser (id, url, capabilities) {
        const webDriver = wd.promiseChainRemote('hub.lambdatest.com', 80, PROCESS_ENVIRONMENT.LT_USERNAME, PROCESS_ENVIRONMENT.LT_ACCESS_KEY);
        
        this.openedBrowsers[id] = webDriver;
    
        try {
            await webDriver
            .init(capabilities)
            .get(url);
        }
        catch (err) {
            await this.dispose();
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
        await _connect();
        const capabilities = await _parseCapabilities(browserName);

        await this._startBrowser(id, pageUrl, capabilities);
        const sessionUrl = ` ${AUTOMATION_DASHBOARD_URL}/logs/?sessionID=${this.openedBrowsers[id].sessionID} `;
        
        this.setUserAgentMetaInfo(id, sessionUrl);
    },

    async closeBrowser (id) {
        await this.openedBrowsers[id].quit();
        delete this.openedBrowsers[id];
    },


    // Optional - implement methods you need, remove other methods
    // Initialization
    async init () {
        this.browserNames = await _getBrowserList();
    },

    async dispose () {
        await _destroy();
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
        await this.openedBrowsers[id].setWindowSize(width, height);
    },

    async maximizeWindow (id) {
        await this.openedBrowsers[id].maximize();
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
