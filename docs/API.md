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

## crawler.on(event, function)
- `event` &lt;string&gt; Event name
- `function` &lt;function(Object, Crawler)] A function that will be called with two arguments:
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

- `node` &lt;string&gt; Css selector of the detached element

### triggerevent
Emitted before triggering an event. This event is available only after start()  
Cancellable: True  
Parameters:

- `node` &lt;string&gt; Css selector of the element
- `event` &lt;string&gt; Event name

### eventtriggered
Emitted after en event has been triggered.  This event is available only after start()  
Cancellable: False  
Parameters:

- `node` &lt;string&gt; Css selector of the element
- `event` &lt;string&gt; Event name


# Object: Request
Object used to hold informations about a request.

- `type` &lt;string&gt; Type of request. It can be: link, xhr, fetch, websocket, jsonp, form, redirect
- `method` &lt;string&gt; Http Method
- `url` &lt;string&gt; URL
- `data` &lt;string&gt; Request body (usually POST data)
- `trigger` &lt;string&gt; Css selector of the HTML element that triggered the request
- `extra_headers` &lt;Object&gt; Extra HTTP headers






