# Introduction

Htcrawl is nodejs module for ricursivley crawl a single page application (SPA) using javascript.

# Class: Crawler

The following is a typical example of using Htcrawl to crawl a page:


```js
// Get instance of Crawler class
htcap.launch(targetUrl, options).then(crawler => {

  // Print out the url of ajax calls
  crawler.on("xhr", e => {
    console.log("XHR to " + e.params.request.url);
  });

  // Start crawling!
  crawler.start().then( () => crawler.browser.close());
});
```


## htcap.launch(targetUrl, [options])
- `targetUrl` &lt;string&gt;
- `options` &lt;Object&gt;
  - `referer` &lt;string&gt; Sets the referer.
  - `userAgent` &lt;string&gt; Sets the referer user-agent.
  - `setCookies` &lt;Array&lt;Object&gt;&gt;
      - `name` &lt;string&gt; (required)
      - `value` &lt;string&gt; (required)
      - `url` &lt;string&gt;
      - `domain` &lt;string&gt;
      - `path` &lt;string&gt;
      - `expires` &lt;number&gt; Unix time in seconds.
      - `httpOnly` &lt;boolean&gt;
      - `secure` &lt;boolean&gt;
  - `proxy` &lt;string&gt; Sets proxy server. (protocol://host:port)
  - `httpAuth` &lt;string&gt; Sets http authentication credentials. (username:password)
  - `loadWithPost` &lt;boolean&gt; Whether to load page with POST method.
  - `postData` &lt;string&gt; Setd the data to be sent wia post.
  - `headlessChrome` &lt;boolean&gt; Whether to run chrome in headless mode.
  - `openChromeDevtoos` &lt;boolean&gt; Whether to open chrome devtools.
  - `extraHeaders` &lt;Object&gt; Sets additional http headers.
  - `maximumRecursion` &lt;number&gt; Sets the limit of DOM recursion. Defaults to 15.
  - `maximumAjaxChain` &lt;number&gt; Sets the maximum number of chained ajax requests. Defaults to 30.
  - `triggerEvents` &lt;boolean&gt; Whether to trigger events. Defaults to true.
  - `fillValues` &lt;boolean&gt; Whether to fill input values. Defaults to true.
  - `maxExecTime` &lt;number&gt; Maximum execution time in milliseconds. Defaults to 300000.
  - `overrideTimeoutFunctions` &lt;boolean&gt; Whether to override timeout functions. Defaults to true.
  - `randomSeed` &lt;string&gt; Seed to generate random values to fill input values.
  - `exceptionOnRedirect` &lt;boolean&gt; Whether to throw an exception on redirect. Defaults to false.
  - `navigationTimeout` &lt;number&gt; Sets the navigation timeout. Defaults to 10000.
  - `bypassCSP` &lt;boolean&gt; Whether to bypass CSP settings. Defaults to true.
  - `skipDuplicateContent`  &lt;boolean&gt; Use heuristic content deduplication. Defaults to true.
  - `windowSize` &lt;int[]&gt; width and height of the browser's window.
  - `showUI`  &lt;boolean&gt; Show the UI as devtools panel. It implies 'openChromeDevtoos=true'
  - `customUI`  &lt;Object&gt; Configure the custom UI. It implies 'showUI=true'. See [Custom UI](#object-custom-ui) section.


## crawler.load()
Loads targetUrl. Resolves when the crawling is finished.  
Returns: &lt;Promise&lt;Crawler&gt;&gt;

## crawler.start()
Loads targetUrl and starts crawling. Resolves when the crawling is finished.  
Returns: &lt;Promise&lt;Crawler&gt;&gt;

## crawler.stop()
Requests the crawling to stop. It makes `start()` to resolve "immediately".


## crawler.navigate(url)
Navigates to `url`. Resolves when the page is loaded.  
Returns: &lt;Promise&gt;

## crawler.reload()
Reload the current page. Resolves when the page is loaded.  
Returns: &lt;Promise&gt;

## crawler.clickToNavigate(selector, timeout)
Clicks on selector and waits for timeout milliseconds for the navigation to be started. Resolves when the page is loaded.  
Returns: &lt;Promise&gt;

## crawler.waitForRequestsCompletion()
Waits for XHR, JSONP, fetch requests to be completed. Resolves when all requests are performed.  
Returns: &lt;Promise&gt;

## crawler.browser()
Returns Puppeteer's Browser instance.

## crawler.page()
Returns Puppeteer's Page instance.

## crawler.newPage(url)
Creates a new browser's page (a new tab). If `url` is provided, the new page will navigate to that URL when `load()` or `start()` are called.

## crawler.sendToUI(message)
Send a `message`` to the UI (the browser's extension).

## crawler.on(event, function)
- `event` &lt;string&gt; Event name
- `function` &lt;function(Object, Crawler)&gt; A function that will be called with two arguments:
    - `eventObject` &lt;Object&gt; Object containing event name parameters
        - `name` &lt;string&gt; Event name
        - `params` &lt;Object&gt; Event parameters
    - `crawler` &lt;Object&gt; Crawler instance.


## Events
The following events are emitted during crawling. Some events can be cancelled by returning false.

### start
Emitted when Htcrawl starts.  
Cancellable: False  
Parameters: None


### pageInitialized
Emitted when the page is initialized and all requests are compelted.  
Cancellable: False  
Parameters: None

### xhr
Emitted before sending an ajax request.  
Cancellable: True  
Parameters:

- `request` &lt;Object&gt; Instance of Request class

### xhrcompleted
Emitted when an ajax request is completed.  
Cancellable: False  
Parameters:

- `request` &lt;Object&gt; Instance of Request class
- `response` &lt;string&gt; Response text
- `timedout` &lt;boolean&gt; Whether the request is timed out

### fetch
Emitted before sending a fetch request.  
Cancellable: True  
Parameters:

- `request` &lt;Object&gt; Instance of Request class


### fetchcompleted
Emitted when a fetch request is completed.  
Cancellable: False  
Parameters:

- `request` &lt;Object&gt; Instance of Request class
- `timedout` &lt;boolean&gt; Whether the request is timed out

### jsonp
Emitted before sending a jsonp request.  
Cancellable: True  
Parameters:

- `request` &lt;Object&gt; Instance of Request class

### jsonpcompleted
Emitted when a jsonp request is completed.  
Cancellable: False  
Parameters:

- `request` &lt;Object&gt; Instance of Request class
- `scriptElement` &lt;string&gt; Css selector of the added script element
- `timedout` &lt;boolean&gt; Whether the request is timed out

### websocket
Emitted before opening a websocket connection.  
Cancellable: False  
Parameters:

- `request` &lt;Object&gt; Instance of Request class

### websocketmessage
Emitted before sending a websocket request.  
Cancellable: False  
Parameters:

- `request` &lt;Object&gt; Instance of Request class
- `message` &lt;string&gt; Websocket message

### websocketsend
Emitted before sending a message to a websocket.  
Cancellable: True  
Parameters:

- `request` &lt;Object&gt; Instance of Request class
- `message` &lt;string&gt; Websocket message

### formsubmit
Emitted before submitting a form.  
Cancellable: False  
Parameters:

- `request` &lt;Object&gt; Instance of Request class
- `form` &lt;string&gt; Css selector of the form element.

### fillinput
Emitted before filling an input element.  
Cancellable: True  
Parameters:

- `element` &lt;string&gt; Css selector of the input element

Example:

```js
// Set a custom value to input field and prevent auto-filling
crawler.on("fillinput" (e, crawler) => {
  await crawler.page().$eval(e.params.element, input => input.value = "My Custom Value");
  return false;
});
```


### newdom
Emitted when new DOM content is added to the page.  
Cancellable: False  
Parameters:

- `rootNode` &lt;string&gt; Css selector of the root element
- `trigger` &lt;string&gt; Css selector of the element that triggered the DOM modification

Example:

```js
// Find links within the newly added content
crawler.on("newdom", (e, crawler) => {
  const selector = e.params.rootNode + " a";
  crawler.page().$$eval(selector, links => {
    for(let link of links)
      console.log(link);
  });
});
```

### navigation
Emitted when the browser tries to navigate outside the current page.  
Cancellable: False  
Parameters:

- `request` &lt;Object&gt; Instance of Request class


### domcontentloaded
Emitted when the DOM is loaded for the first time (on page load).  This event must be registered before load()
Cancellable: False  
Parameters: None

### redirect
Emitted when a redirect is requested.  
Cancellable: True  
Parameters:

- `url` &lt;string&gt; Redirect URL

### earlydetach
Emitted when an element is detached before it has been analyzed.  
Cancellable: False  
Parameters:

- `element` &lt;string&gt; Css selector of the detached element

### triggerevent
Emitted before triggering an event. This event is available only after start()  
Cancellable: True  
Parameters:

- `element` &lt;string&gt; Css selector of the element
- `event` &lt;string&gt; Event name

### eventtriggered
Emitted after en event has been triggered.  This event is available only after start()  
Cancellable: False  
Parameters:

- `element` &lt;string&gt; Css selector of the element
- `event` &lt;string&gt; Event name

### crawlelement
Emitted when starting crawling a new element.
Cancellable: False
Parameters:

- `element` &lt;string&gt; Css selector of the element
- `event` &lt;string&gt; Event name


# Object: Request
Object used to hold informations about a request.

- `type` &lt;string&gt; Type of request. It can be: link, xhr, fetch, websocket, jsonp, form, redirect
- `method` &lt;string&gt; Http Method
- `url` &lt;string&gt; URL
- `data` &lt;string&gt; Request body (usually POST data)
- `trigger` &lt;string&gt; Css selector of the HTML element that triggered the request
- `extra_headers` &lt;Object&gt; Extra HTTP headers


# Object: Custom UI
Object used to configure the custom UI (the interface with the browser's extension). The browser's extension can be generated with `npx htcrawl lib scaffold <dir>`.

- `extensionPath` &lt;sting&gt; The path to the extension's folder
- `UIMethods` &lt;Function&gt; A function that is evaluated in the page's context that is used to set up the methods that are invoked from the browser's extension. It takes the `UI` object as parameter.
- `events` &lt;object&gt; Object containing the events that are triggered from the methods defined in 'UIMethods'

## Object UI
Object that can be extended with custom methods. It resides in the context of the page.  
By default, it contains two properties:
- `dispatch` &lt;Function&gt; Dispatch a message to the crawler (node-side)
- `utils` &lt;object&gt; Some utilities to interact with the page:

  - `getElementSelector` &lt;Function&gt; Returns the CSS selector of the given element
  - `createElement` &lt;Function&gt; Creates a new element in the page that is excluded from crawlng. It takes the following arguments:
    - `name`: &lt;sting&gt; The type of element to create (e.g., 'div', 'span')
    - `style`: &lt;object&gt; CSS styles to apply
    - `parent`: &lt;HTMLElement&gt; Parent element to append to. If omitted, the element is appended to 'body'. If `null` the element is not attached to the DOM.
  - `selectElement` &lt;Function&gt; Enables the user to select an element on the webpage by moving the cursor over it. It visually highlights the currently hovered element with an overlay and returns a promise that resolves to the selector of the clicked element.


## Example

```js
const customUI = {
    extensionPath: __dirname + '/chrome-extension',
    UIMethods: UI => {  // Evaluated in the context of the page
        UI.start = () => {
            UI.dispatch("start")
        }
    },
    events: {  // Events triggered by 'UI.dispatch()' from the page context
        start: async e => {
            await crawler.start();
            // Sent a message to the browser extension
            crawler.sendToUI("DONE")
        },
    }
```
In the extension's `ui-panel.js` file:

```js
document.getElementById('start').onclick = () => {
  pageEval("UI.start()");
};

onCrawlerMessage( message => {
  document.getElementById("console").innerText += message + "\n";
});
```




