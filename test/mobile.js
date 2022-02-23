fixture`Getting Started`
    .page`https://devexpress.github.io/testcafe/example`;

test('Test1', async t => {
    await t
        .typeText('#developer-name', 'John Smith')
        .click('#submit-button');
});