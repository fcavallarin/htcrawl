const htcrawl = require('..');
const fs = require('fs');
const URL = "http:127.0.0.1:9091";
const options = {
    headlessChrome: false,
}
const out = (r) => {
    fs.appendFileSync(`${__dirname}/test-results.log`, `${r}\n`);
};

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
        console.log(`Running: ${test}`)
        try{
            await definedTests[test](test);
        }catch(e){
            out(`Exceptiom ${test}: ${e}`)
        }
    }
    process.exit(0);
};

const definedTests = {
    sequence: async name => {
        const crawler = await htcrawl.launch(`${URL}/${name}.html`, {
            ...options,
        });
        crawler.on("pageinitialized", async () => {
            crawler.on("pageinitialized", async () => {
                const url = await crawler.page().url();
                if(!url.endsWith("auth.html")){
                    out(`${name}: expected url to end with auth.html`)
                }
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
};

run(process.argv[2]);