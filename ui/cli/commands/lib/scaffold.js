const fs = require('fs');
const path = require('path');

exports.command = 'scaffold dir';
exports.desc = "Scaffold browser's extension";
exports.builder = (yargs) => {
    return yargs
        .positional('dir', {
            describe: 'Target dir',
            type: 'string',
        })
}

const srcDir = `${__dirname}/../../../chrome-extension`;

function copyDir(source, target) {
    let files = [];
    if (fs.lstatSync(source).isDirectory()) {
        files = fs.readdirSync(source);
        files.forEach(function (file) {
            fs.writeFileSync(`${target}/${file}`, fs.readFileSync(`${source}/${file}`));
        });
    }
};

const prog = `\
const htcrawl = require('htcrawl');
const URL = "url";
const customUI = {
    extensionPath: __dirname + '/chrome-extension',
    UIMethods: UI => {  // Evaluated in the context of the page
        UI.crawlElement = () => {
            UI.utils.selectElement().then( e => UI.dispatch('crawlElement', {element: e}))
        };
        UI.start = () => {
            UI.dispatch("start")
        }
        UI.stop = () => {
            UI.dispatch("stop")
        }
        UI.login = () => {
            UI.dispatch("login");
        }
        UI.clickToNavigate = () =>{
            UI.utils.selectElement().then( e => UI.dispatch('clickToNavigate', {element: e}))
        }
    },
    events: {  // Events triggered by 'UI.dispatch()' for the page context
        crawlElement: async e => {
            const el = await crawler.page().$(e.params.element);
            await crawler.start(el)
            crawler.sendToUI("DONE")
        },
        start: async e => {
            await crawler.start();
            crawler.sendToUI("DONE")
        },
        stop: e => {
            crawler.stop();
        },
        login: async e => {
            const p = await crawler.newDetachedPage();
            p.on("close", async () =>{
                await crawler.reload();
            })
        },
        clickToNavigate: e => {
            crawler.clickToNavigate(e.params.element)
        }
    }
};
(async () =>{
    const crawler = await htcrawl.launch(URL, {
        headlessChrome: false,
        skipDuplicateContent:true,
        openChromeDevtoos:true,
        customUI: customUI
    });
    await crawler.load();
    await crawler.browser().close();
    process.exit(0);
})();    
`


exports.handler = function (argv) {
    if(fs.existsSync(argv.dir)){
        console.log(`Error: ${argv.dir} already exists`);
        process.exit(1);
    }
    fs.mkdirSync(argv.dir);
    const extdir = `${argv.dir}/chrome-extension`;
    fs.mkdirSync(extdir);
    copyDir(srcDir, extdir);
    fs.writeFileSync(`${argv.dir}/prog.js`, prog);
};