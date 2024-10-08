// eslint-disable-next-line no-undef,no-unused-expressions
fixture`Getting Started`.page`https://devexpress.github.io/testcafe/example`;

// eslint-disable-next-line no-undef
test('Test1', async (t) => {
    await t.typeText('#developer-name', 'John Smith').click('#submit-button');
});
