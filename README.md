# HTCRAWL

Htcrawl is nodejs module for the recursive crawling of single page applications (SPA) using javascript.  
It uses headless chrome to load and analyze web applications and it's build on top of Puppetteer from wich it inherits all the functionalities.

With htcrawl you can roll your own DOM-XSS scanner with less than 60 lines of javascript (see [below](#dom-xss-scanner))!!

Some examples of what (else) you can do with htcrawl:

1. Advanced scraping of single page applications (SPA)
2. Intercept and log all requests made by a webpage
3. Build tools to detect security vulnerabilities
4. Automate testing of UI, javascript ecc


# BASIC USAGE

```javascript
const htcrawl = require('htcrawl');

(async () => {
  const crawler = await htcrawl.launch("https://htcrawl.org");

  // Print the url of ajax calls
  crawler.on("xhr", e => {
    console.log(`XHR to ${e.params.request.url}`);
  });

  // Print the selector of newly created DOM elements
  crawler.on("newdom", async (event, crawler) => {
    console.log(`New DOM element created: ${event.params.element}`);
  });

  // Print all events triggered by the crawler
  crawler.on("triggerevent", async (event, crawler) => {
    console.log(`Triggered ${event.params.event} on '${event.params.element}'`);
  });

  // Start crawling!
  await crawler.start();
})();
```

## KEY FEATURES

- Recursive crawling:
    - Trigger all events attached to elements
    - Wait for all requests
    - Detect DOM changes
    - Repeat the process for every new DOM node
- Heuristic content deduplicator
- Intercept all requests including websockets, jsonp, forms
- Intercept postMessage
- Transparent handling of iframes (all ifremas are crawled as thaey are part of the same DOM)
- Can select elements inside iframes using a custom CSS selector
- API to create custom UIs as chrome extensions

## DOCUMENTATION

API documentation can be found at [docs/API.md](docs/API.md).


# CRAWL ENGINE
The diagram shows the recursive crawling proccess.  

![SPA Crawling Diagram](https://htcrawl.org/img/htcap-flowchart.png). 

The video below shows the engine crawling gmail.  
The crawl lasted for many hours and about 3000 XHR request have been captured.

[![crawling gmail](https://fcvl.net/htcap/img/htcap-gmail-video.png)](https://www.youtube.com/watch?v=5FLmWjKE2JI "HTCAP Crawling Gmail")


# EXAMPLES
## Advanced Content Scraper

```js
const targetUrl = "https://fcvl.net/htcap/scanme/ng/";
const options = {headlessChrome: true};

function printEmails(string){
    const emails = string.match(/([a-z0-9._-]+@[a-z0-9._-]+\.[a-z]+)/gi);
    if(!emails) return;
    for(let e of emails)
        console.log(e);
}

(async () => {
  const crawler = await htcrawl.launch(targetUrl, options);

  crawler.on("domcontentloaded", async function(e, crawler){
      const selector = "body";
      const html = await crawler.page().$eval(selector, body => body.innerText);
      printEmails(html);
  });

  crawler.on("newdom", async function(e, crawler){
      const selector = e.params.rootNode;
      const html = await crawler.page().$eval(selector, node => node.innerText);
      printEmails(html);
  });

  await crawler.start();
  await crawler.browser().close();
})();
```

## DOM XSS Scanner
The example below shows a very basic DOM-XSS scanner implementation. For an advanced one refere to [domdig](https://github.com/fcavallarin/domdig).

```js
const targetUrl="https://fcvl.net/htcap/scanme/domxss.php";
const options = {headlessChrome: true};
var pmap = {};

const payloads = [
    ";window.___xssSink({0});",
    "<img src='a' onerror=window.___xssSink({0})>"
];

function getNewPayload(payload, element){
    const k = "" + Math.floor(Math.random()*4000000000);
    const p = payload.replace("{0}", k);
    pmap[k] = {payload:payload, element:element};
    return p;
}

async function crawlAndFuzz(payload){
    var hashSet = false;

    // instantiate htcrawl
    const crawler = await htcrawl.launch(targetUrl, options);

    // set a sink on page scope
    crawler.page().exposeFunction("___xssSink", key => {
        const msg = `DOM XSS found:\n  payload: ${pmap[key].payload}\n  element: ${pmap[key].element}`
        console.log(msg);
    });

    // fill all inputs with a payload
    crawler.on("fillinput", async function(e, crawler){
        const p = getNewPayload(payload, e.params.element);
        try{
            await crawler.page().$eval(e.params.element, (i, p) => i.value = p, p);
        }catch(e){}
        // return false to prevent element to be automatically filled with a random value
        return false;
    });


    // change page hash before the triggering of the first event
    crawler.on("triggerevent", async function(e, crawler){
        if(!hashSet){
            const p = getNewPayload(payload, "hash");
            await crawler.page().evaluate(p => document.location.hash = p, p);
            hashSet = true;
        }
    });

    try{
        await crawler.start();
    } catch(e){
        console.log(`Error ${e}`);
    }

    crawler.browser().close();
}

(async () => {
    for(let payload of payloads){
        /* Remove 'await' for parallel scan of all payloads */
        await crawlAndFuzz(payload);
    }
})();
```


# LICENSE

This program is free software; you can redistribute it and/or modify it under the terms of the [GNU General Public License](https://www.gnu.org/licenses/gpl-2.0.html) as published by the Free Software Foundation; either version 2 of the License, or(at your option) any later version.


# ABOUT

Written by Filippo Cavallarin. This project is son of Htcap (https://github.com/fcavallarin/htcap).