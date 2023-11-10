const htcrawl = require('../../../..');

exports.command = 'grep text url';
exports.desc = 'Search for text in a webpage';
exports.builder = (yargs) => {
    return yargs
        .positional('url', {
            describe: 'Target URL',
            type: 'string',
        })
        .positional('text', {
            describe: 'Text to search',
            type: 'string',
        })
}

const grep = async (crawler, text) => {
    const page = crawler.page();
    const matches = await page.$x("//*[contains(text(), '" + text + "')]");
    for(let txt of matches){
        console.log("Found: " + await page.evaluate( el => el.innerText, txt));
    }
}

exports.handler = async function (argv) {
    const crawler = await htcrawl.launch(argv.url, {
		headlessChrome: false,
		skipDuplicateContent:true,
	});
    crawler.on("newdom", async (event, crawler) => {
        await grep(crawler, argv.text)
	});
    await crawler.load();
    await grep(crawler, argv.text);
    await crawler.start();
    await crawler.browser().close();
    process.exit(0);
    
};
