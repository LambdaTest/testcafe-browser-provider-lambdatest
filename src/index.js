'use strict';
import wd from 'selenium-webdriver';
import { LT_AUTH_ERROR, PROCESS_ENVIRONMENT, AUTOMATION_DASHBOARD_URL, AUTOMATION_HUB_URL, _connect, _destroy, _getBrowserList, _parseCapabilities, _saveFile, _updateJobStatus, showTrace } from './util';

export default {
    // Multiple browsers support

    isMultiBrowser: true,

    browserNames: [],
    
    openedBrowsers: { },
    async _startBrowser (id, pageUrl, capabilities) {
        showTrace('StartBrowser Initiated for ', id);
        try {
            const gridURL = `https://${PROCESS_ENVIRONMENT.LT_USERNAME}:${PROCESS_ENVIRONMENT.LT_ACCESS_KEY}${AUTOMATION_HUB_URL}`;
            const webDriver = new wd.Builder()
                .usingServer(gridURL)
                .withCapabilities(capabilities)
                .build();
            
            await webDriver.get(pageUrl);
            await webDriver.getSession().then((session) => {
                showTrace('StartBrowser webDriver.getSession() ', session);
                webDriver.sessionID = session.id_;
            });

            this.openedBrowsers[id] = webDriver;
        }
        catch (err) {
            await _destroy();
            showTrace('Error while starting browser for ', id);
            showTrace(err);
            throw err;
        }
    },
    // Required - must be implemented
    // Browser control
    async openBrowser (id, pageUrl, browserName) {
        if (!PROCESS_ENVIRONMENT.LT_USERNAME || !PROCESS_ENVIRONMENT.LT_ACCESS_KEY)
            throw new Error(LT_AUTH_ERROR);
        await _connect();
        const capabilities = await _parseCapabilities(id, browserName);

        await this._startBrowser(id, pageUrl, capabilities);
        const sessionUrl = ` ${AUTOMATION_DASHBOARD_URL}/logs/?sessionID=${this.openedBrowsers[id].sessionID} `;
        
        this.setUserAgentMetaInfo(id, sessionUrl);
    },

    async closeBrowser (id) {
        showTrace('closeBrowser Initiated for ', id);
        if (this.openedBrowsers[id]) {
            showTrace(this.openedBrowsers[id].sessionID);
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
        else showTrace('Browser not found in OPEN STATE for ', id);
    },

    // Optional - implement methods you need, remove other methods
    // Initialization
    async init () {
        this.browserNames = await _getBrowserList();
    },
    async dispose () {
        showTrace('Dispose Initiated ...');
        try { 
            await _destroy();
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
        await this.openedBrowsers[id].manage().window().setSize(width, height);
    },

    async maximizeWindow (id) {
        await this.openedBrowsers[id].manage().window().maximize();
    },

    async takeScreenshot (id, screenshotPath) {
        const base64Data = await this.openedBrowsers[id].takeScreenshot();
        
        await _saveFile(screenshotPath, base64Data);
    },
    
    async reportJobResult (id, jobResult, jobData) {
        if (this.openedBrowsers[id] && this.openedBrowsers[id].sessionID) {
            const sessionID = this.openedBrowsers[id].sessionID;

            return await _updateJobStatus(sessionID, jobResult, jobData, this.JOB_RESULT);
        }
        return null;
    }
};
