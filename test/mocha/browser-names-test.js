'use strict';
const expect = require('chai').expect;
const lambdatestProvider = require('../../');

describe('Browser names', function () {

    before(function () {
        this.timeout(20000);

        return lambdatestProvider.init();
    });


    it('Should return list of common browsers and devices', function () {
        return lambdatestProvider.getBrowserList().then(function (list) {
            const commonBrowsers = [
                'Chrome@143.0:Windows 11',
                'Chrome@142.0:Windows 11',
                'Chrome@141.0:Windows 11',
                'Chrome@140.0:Windows 11',
                'Chrome@139.0:Windows 11',
                'Chrome@138.0:Windows 11',
                'Chrome@137.0:Windows 11',
                'Chrome@136.0:Windows 11',
                'Chrome@135.0:Windows 11',
                'Chrome@134.0:Windows 11',
                'Chrome@133.0:Windows 11',
                'Chrome@132.0:Windows 11',
            ];

            const areBrowsersInList = commonBrowsers.map(function (browser) {
                return list.indexOf(browser) > -1;
            });

            expect(list).to.be.an('array');
            expect(list.length).to.be.greaterThan(0);
            // Check that at least some Chrome browsers are present
            const hasChrome = list.some(browser => browser.includes('Chrome'));

            expect(areBrowsersInList).eql(
                Array(commonBrowsers.length).fill(true),
            );

            expect(hasChrome).to.be.true;
        });
    });
});
