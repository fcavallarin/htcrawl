const htcrawl = require('..');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const URL = "http:127.0.0.1:9091";
const options = {
    headlessChrome: false,
}
const out = (r) => {
    // fs.appendFileSync(`${__dirname}/test-results.log`, `${r}\n`);
    console.log(r)
};

const sleep = async ms => new Promise(r => setTimeout(r, ms));

const assertURL = async (name, crawler) => {
    try{
        if(await crawler.page().url().split('#')[1].split("=")[0] != "unguessableName"){
            out(`${name}: expected url to contain 'unguessableName'`)
        }
    }catch(e){
        out(`${name}: URL error`);
    }
}

const run = async tests => {
    const selectedTests = tests ? tests.split(",") : Object.keys(definedTests);
    for(const test of selectedTests){
        try{
            await definedTests[test](test);
        }catch(e){
            out(`Exceptiom ${test}: ${e}`)
        }
    }
    process.exit(0);
};

const definedTests = {
    login: async name => {
        const crawler = await htcrawl.launch(`${URL}/${name}.html`, {
            ...options,
        });
        crawler.on("pageinitialized", async () => {
            crawler.on("pageinitialized", async () => {
                const url = await crawler.page().url();
                if(!url.endsWith("auth.html")){
                    out(`${name}: expected url to end with auth.html`)
                }
                //await crawler.browser().close();
            });
            await crawler.page().type("#user", "user1");
            await crawler.page().type("#password", "pw3889");
            await crawler.clickToNavigate("#btn");
        });
        await crawler.load()
    },
    auth: async name => {
        // This also tests the crawler with no events registered
        const crawler = await htcrawl.launch(`${URL}/${name}.html`, {
            setCookies:[
                {name: "secretkey", value: "1"}
            ],
            ...options,
        });
        await crawler.start();
        await assertURL(name, crawler);
        await crawler.browser().close();
    },
    deep: async name => {
        const crawler = await htcrawl.launch(`${URL}/${name}.html`, {
            ...options,
        });
        const expectedNewElements = 13;
        let totNewElements = 0;
        crawler.on("newdom", async (event, crawler) => {
           totNewElements++;
        });
        await crawler.start();
        if(totNewElements != expectedNewElements){
            out(`${name}: expected ${expectedNewElements} found ${totNewElements}`);
        }
        await crawler.browser().close();
    },
    fetch: async name => {
        const crawler = await htcrawl.launch(`${URL}/${name}.html`, {
            ...options,
        });
        const expectedFetch = 20;
        let totFetch = 0;
        crawler.on("fetch", async (event, crawler) => {
            totFetch++;
        });
        crawler.on("fetchcompleted", async (event, crawler) => {
            totFetch++;
        });
        await crawler.start();
        if(totFetch != expectedFetch){
            out(`${name}: expected ${expectedFetch} found ${totFetch}`);
        }
        await assertURL(name, crawler);
        await crawler.browser().close();
    },
    xhr: async name => {
        const crawler = await htcrawl.launch(`${URL}/${name}.html`, {
            ...options,
        });
        const expectedFetch = 20;
        let totFetch = 0;
        crawler.on("xhr", async (event, crawler) => {
            totFetch++;
        });
        crawler.on("xhrCompleted", async (event, crawler) => {
            totFetch++;
        });
        await crawler.start();
        if(totFetch != expectedFetch){
            out(`${name}: expected ${expectedFetch} found ${totFetch}`);
        }
        await assertURL(name, crawler);
        await crawler.browser().close();
    },

    reload: async name => {
        const crawler = await htcrawl.launch(`${URL}/fetch.html`, {
            ...options,
        });
        crawler.on("pageinitialized", async (event, crawler) => {
		    crawler.removeEvent("pageinitialized");
		    await crawler.reload();
            await crawler.start();
            await assertURL(name, crawler);
        });
        await crawler.load();
        await crawler.browser().close();
    },
    iframe: async name => {
        const crawler = await htcrawl.launch(`${URL}/${name}.html`, {
            ...options,
        });
        await crawler.load();
        const expectedFetch = 20;
        let totFetch = 0;
        crawler.on("fetch", async (event, crawler) => {
            totFetch++;
        });
        crawler.on("fetchcompleted", async (event, crawler) => {
            totFetch++;
        });
        await crawler.start();
        if(totFetch != expectedFetch){
            out(`${name}: expected ${expectedFetch} found ${totFetch}`);
        }

        const ib = await crawler.getElementSelector(await crawler.page().$("inframe/iframe ; iframe ; button.b"))
        const innerButton = await crawler.page().$(ib)
        if(await crawler.page().evaluate(b => b?.id, innerButton) != "button1"){
            out(`${name}: failed to get button1`);
        }

        const innerButtons = await crawler.page().$$("inframe/iframe ; iframe ; button.b");
        if(await crawler.page().evaluate(b => b?.id, innerButtons[1]) != "button2"){
            out(`${name}: failed to get button2`);
        }

        await crawler.browser().close();
        // await sleep(100000)
    },
    iframeorigin: async name => {
        const crawler = await htcrawl.launch(`${URL}/${name}.html`, {
            ...options,
        });
        await crawler.load();

        await crawler.start();
        await crawler.browser().close();
        // await sleep(100000)
    },
    scaffold: async name => {
        const WD = __dirname;
        execSync(`rm -rf ${path.join(WD, 'chrome-extension-test')}`);
        execSync(`node ../ui/cli/main.js lib scaffold ${path.join(WD, 'chrome-extension-test')}`);

        const progPath = path.join(WD, 'chrome-extension-test', 'prog.js');
        let progContent = fs.readFileSync(progPath, 'utf8');
        progContent = progContent.replace(/require\('htcrawl'\)/g, "require('../../')");
        fs.writeFileSync(progPath, progContent);

        const additionalJS = `
            setTimeout(async () => {
                crawler.on('fetch', e => console.log('Test is OK'));
                await crawler.page().evaluate(() => window.__PROBE__.UI.start());
                setTimeout(async () => {
                    await crawler.page().evaluate(() => window.__PROBE__.UI.stop());
                    await crawler.browser().close();
                    process.exit(0);
                }, 2000);
            }, 2000);
        `;
        fs.appendFileSync(progPath, additionalJS);

        const output = execSync(`node ${progPath} http://127.0.0.1:9091/fetch.html`).toString();
        if (!output.includes('Test is OK')) {
            fs.appendFileSync(path.join(WD, 'test-results.log'), 'Extension test failed\n');
        }

        execSync(`rm -rf ${path.join(WD, 'chrome-extension-test')}`);
    }
};



run(process.argv[2]);