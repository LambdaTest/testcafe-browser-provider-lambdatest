const expect            = require('chai').expect;
const lambdatestProvider = require('../../');


describe('Browser names', function () {
    before(function () {
        this.timeout(20000);

        return lambdatestProvider
            .init();
    });

    it('Should return list of common browsers and devices', function () {
        return lambdatestProvider
            .getBrowserList()
            .then(function (list) {
                const commonBrowsers = [
                    'Internet Explorer@11.0:Windows 7',
                    'Internet Explorer@10.0:Windows 7',
                    'Chrome@76.0:OS X El Capitan',
                    'Chrome@75.0:OS X El Capitan',
                    'Firefox@67.0:OS X El Capitan',
                    'Firefox@66.0:OS X El Capitan',
                    'Chrome@74.0:OS X Yosemite',
                    'Chrome@73.0:OS X Yosemite',
                    'Firefox@66.0:OS X Yosemite',
                    'Firefox@65.0:OS X Yosemite',
                    'Chrome@67.0:OS X Mavericks',
                    'Chrome@66.0:OS X Mavericks'
                ];

                const areBrowsersInList = commonBrowsers
                    .map(function (browser) {
                        return list.indexOf(browser) > -1;
                    });

                expect(areBrowsersInList).eql(Array(commonBrowsers.length).fill(true));
            });
    });
});
