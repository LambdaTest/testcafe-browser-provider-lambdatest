// TODO: add tests
fixture`Getting Started`.page`http://devexpress.github.io/testcafe/example`;

test('My first test 1', async t => {
    await t.typeText('#developer-name', 'John Smith')
    .click('#submit-button');
});

fixture`Getting Started 2`.page`http://devexpress.github.io/testcafe/example`;
test('My first test 2', async t => {
    await t.typeText('#developer-name', 'John Smith 2')
    .click('#submit-button');
});
