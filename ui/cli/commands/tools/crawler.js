const htcrawl = require('../../../..');

exports.command = 'crawler [options] url';
exports.desc = 'Simple SPA crawler';
exports.builder = (yargs) => {
    return yargs
        .positional('url', {
            describe: 'Target URL',
            type: 'string',
        })
        .option('i', {
            alias: 'interactive',
            describe: 'Allow user interaction with the browser before crawling',
            type: 'boolean',
        }).option('l', {
            alias: 'headless',
            describe: 'Start the browser in headless mode',
            type: 'boolean',
        }).option('m', {
            alias: 'mode',
            describe: "Crawl mode (default 'linear')",
            choices: ['linear', 'random'],
            type: 'string',
        }).option('v', {
            alias: 'verbose',
            describe: "Print verbose information, not only requests",
            type: 'boolean',
        })
};
exports.handler = async function (argv) {
    await main(argv);
};

const stringifyRequest = req => {
	var m = "[R] ";
	if(req.trigger && req.trigger.element){
		m += '$(' + req.trigger.element + ').' + (`${req.trigger.event}()`) + " → ";
	}
	m += req.method + " " + req.url;
	if(req.data){
		m += `${req.data}\n`;
		m += "\n" + "-".repeat(96);
	}
	return m;
}

const main = async argv => {
    const crawler = await htcrawl.launch(argv.url, {
        headlessChrome: !!argv.headless,
        showUI: argv.interactive,
        crawlmode: argv.mode || "linear"
    });

    const out = s => {
        if(argv.interactive){
            crawler.sendToUI(s);
        } else {
            console.log(s);
        }
    }

    const handleRequest = e => {
        out(stringifyRequest(e.params.request));
    };

    crawler.on("xhr", handleRequest);
    crawler.on("fetch", handleRequest);
    crawler.on("navigation", handleRequest);
    crawler.on("jsonp", handleRequest);
    crawler.on("websocket", handleRequest);

    if(argv.verbose){
        crawler.on("fillinput", async event => {
            out("Fill input of " + event.params.element)
        })

        crawler.on("triggerevent", async event => {
            out(`Trigger of ${event.params.event} on '${event.params.element}'`);
        })

        crawler.on("crawlelement", async event => {
            out("Crawling " + event.params.element)
        });
    }
    if(argv.interactive){
        await crawler.load();
    } else {
        await crawler.start();
        process.exit(0);
    }
};
