/*
HTCRAWL
https://github.com/fcavallarin/htcrawl
Author: filippo@fcvl.net

This program is free software; you can redistribute it and/or modify it under
the terms of the GNU General Public License as published by the Free Software
Foundation; either version 2 of the License, or (at your option) any later
version.
*/


"use strict";

const puppeteer = require('puppeteer');
const defaults = require('./options').options;
const probe = require("./probe");
const DOMDeduplicator= require("./domdeduplicator").DOMDeduplicator;

const utils = require('./utils');
const process = require('process');

exports.launch = async function(url, options){
	options = options || {};
	for(const a in defaults){
		if(!(a in options)) options[a] = defaults[a];
	}
	if(options.customUI){
		options.showUI = true;
	}
	if(options.showUI){
		options.openChromeDevtoos = true;
	}
	const chromeArgs = [
		'--no-sandbox',
		'--disable-setuid-sandbox',
		'--disable-gpu',
		'--hide-scrollbars',
		'--mute-audio',
		'--ignore-certificate-errors',
		'--ignore-certificate-errors-spki-list',
		'--ssl-version-max=tls1.3',
		'--ssl-version-min=tls1',
		'--disable-web-security',
		'--allow-running-insecure-content',
		'--proxy-bypass-list=<-loopback>',
		`--window-size=${options.windowSize.join(",")}`
	];

	if(options.proxy){
		chromeArgs.push("--proxy-server=" + options.proxy);
	}

	if(options.showUI){
		const extpath = options.customUI ? options.customUI.extensionPath : `${__dirname}/ui/chrome-extension`;
		chromeArgs.push(
			`--disable-extensions-except=${extpath}`,
			`--load-extension=${extpath}`
		);
	}

	if(options.openChromeDevtoos){
		chromeArgs.push('--auto-open-devtools-for-tabs');
	}

	var browser = await puppeteer.launch({
		headless: options.headlessChrome ? 'new' : false,
		ignoreHTTPSErrors: true,
		args:chromeArgs
	});
	var crawler = new Crawler(url, options, browser);
	await crawler.bootstrapPage();

	setTimeout(async function reqloop(){
		for(let i = crawler._pendingRequests.length - 1; i >=0; i--){
			let r = crawler._pendingRequests[i];
			let events = {xhr: "xhrCompleted", fetch: "fetchCompleted"};
			if(r.p.response()){
				let rtxt = null;
				try{
					rtxt = await r.p.response().text();
				} catch(e){}
				await crawler.dispatchProbeEvent(events[r.h.type], {
					request: r.h,
					response: rtxt
				});
				crawler._pendingRequests.splice(i, 1);
			}
			if(r.p.failure()){
				//console.log("*** FAILUREResponse for " + r.p.url())
				crawler._pendingRequests.splice(i, 1);
			}
		}
		setTimeout(reqloop, 50);
	}, 50);

	browser.on("targetcreated", async (target)=>{
		if(crawler._allowNewWindows){
			return;
		}
		const p = await target.page();
		if(p) p.close();
	});

	return crawler;
};




function Crawler(targetUrl, options, browser){

	// targetUrl = targetUrl.trim();
	// if(targetUrl.length < 4 || targetUrl.substring(0,4).toLowerCase() != "http"){
	// 	targetUrl = "http://" + targetUrl;
	// }
	this._setTargetUrl(targetUrl);

	this.publicProbeMethods = [''];
	this._cookies = [];
	this._redirect = null;
	this._errors = [];
	this._loaded = false;
	this._allowNavigation = false;
	this._allowNewWindows = false;
	this._firstRun = true;
	this.error_codes = ["contentType","navigation","response"];

	this.probeEvents = {
		start: function(){},
		xhr: function(){},
		xhrcompleted: function(){},
		fetch: function(){},
		fetchcompleted: function(){},
		jsonp: function(){},
		jsonpcompleted: function(){},
		websocket: function(){},
		websocketmessage: function(){},
		websocketsend: function(){},
		formsubmit: function(){},
		fillinput: function(){},
		//requestscompleted: function(){},
		//dommodified: function(){},
		newdom: function(){},
		navigation: function(){},
		domcontentloaded: function(){},
		//blockedrequest: function(){},
		redirect: function(){},
		earlydetach: null,
		triggerevent: null,
		eventtriggered: null,
		pageinitialized: function(){},
		crawlelement: null,
		//end: function(){}
	}

	this.UIEvents = {};

	this.options = options;

	this._browser = browser;
	this._page = null;

	this._trigger = {};
	this._pendingRequests =[];
	this._sentRequests = [];
	this.documentElement = null;
	// this.domModifications = [];
	this._stop = false;
	this.domDeduplicator = new DOMDeduplicator();
	this._status = {
		layer: null,
		curElement: null
	}
}

Crawler.prototype._setTargetUrl = function(url){
	url = url.trim();
	if(url.length < 4 || url.substring(0,4).toLowerCase() != "http"){
		url = "http://" + url;
	}
	this.targetUrl = url;
}

Crawler.prototype.browser = function(){
	return this._browser;
}

Crawler.prototype.page = function(){
	return this._page;
}

Crawler.prototype.cookies = async function(){
	var pcookies = [];
	if(this._page){
		let cookies = await this._page.cookies();
		for(let c of cookies){
			pcookies.push({
				name: c.name,
				value: c.value,
				domain: c.domain,
				path: c.path,
				expires: c.expires,
				httponly: c.httpOnly,
				secure: c.secure
			});
			this._cookies = this._cookies.filter( (el) => {
				if(el.name != c.name){
					return el;
				}
			})
		}
	}
	return this._cookies.concat(pcookies);
}

Crawler.prototype.redirect = function(){
	return this._redirect;
}

Crawler.prototype.errors = function(){
	return this._errors;
}
// returns after all ajax&c have been completed
Crawler.prototype.load = async function(){
	const resp = await this._goto(this.targetUrl);
	return await this._afterNavigation(resp);
};

Crawler.prototype._goto = async function(url){
	if(this.options.verbose)console.log("LOAD")
	var ret = null;
	this._allowNavigation = true;
	try{
		ret = await this._page.goto(url, {waitUntil:'load'});
	}catch(e){
		this._errors.push(["navigation","navigation aborted"]);
		throw e;
	}finally{
		this._allowNavigation = false;
	}
	return ret;
}

Crawler.prototype._startMutationObserver = async function(){
	await this._page.evaluate(async function(){
		const exclided = [Node.TEXT_NODE, Node.DOCUMENT_FRAGMENT_NODE, Node.COMMENT_NODE];
		window.__PROBE__.DOMMutations = [];  // <--- @TODO .. why here??
		let observer = new MutationObserver(mutations => {
			for(let m of mutations){
				if(m.type != 'childList' || m.addedNodes.length == 0)continue;
				for(let e of m.addedNodes){
					// Skip text nodes since popMutation ensure it's an alement with asElement
					if(exclided.indexOf(e.nodeType) != -1 ||
						(e.getAttribute && e.getAttribute("data-htcrawl_crawl_excluded_element"))
					){
						continue;
					}
					window.__PROBE__.totalDOMMutations++;
					window.__PROBE__.DOMMutations.push(e);
				}
			}
		});
		observer.observe(document.documentElement, {childList: true, subtree: true});
	});
}

Crawler.prototype._resetMutationObserver = async function(){
	await this._page.evaluate(async function(){
		window.__PROBE__.DOMMutations = [];
		window.__PROBE__.DOMMutationsToPop = [];
		window.__PROBE__.totalDOMMutations = 0;
	});
}

Crawler.prototype._afterNavigation = async function(resp){
	var assertContentType = function(hdrs){
		let ctype = 'content-type' in hdrs ? hdrs['content-type'] : "";

		if(ctype.toLowerCase().split(";")[0] != "text/html"){
			this._errors.push(["content_type", `content type is ${ctype}`]);
			return false;
		}
		return true;
	}
	try{
		if(!resp.ok()){
			this._errors.push(["response", resp.request().url() + " status: " + resp.status()]);
			throw resp.status();
		}
		var hdrs = resp.headers();
		this._cookies = utils.parseCookiesFromHeaders(hdrs, resp.url())


		if(!assertContentType(hdrs)){
			throw "Content type is not text/html";
		}
		this.documentElement = await this._page.evaluateHandle( () => document.documentElement);
		this.domDeduplicator.reset();
		this._loaded = true;

		await this.dispatchProbeEvent("domcontentloaded", {});
		await this.waitForRequestsCompletion();
		await this.dispatchProbeEvent("pageinitialized", {});
		await this._startMutationObserver();
		if(this.options.showUI){
			if(this.options.customUI){
				this._setUI(this.options.customUI);
			} else {
				this._setDefaultUI();
			}
		}
		return this;
	}catch(e){
		//;
		throw e;
	};
};

Crawler.prototype.waitForRequestsCompletion = async function(){
	await this._waitForRequestsCompletion();
	await this._page.evaluate(async function(){ // use Promise.all ??
		await window.__PROBE__.waitJsonp();
		await window.__PROBE__.waitWebsocket();
	});
};

Crawler.prototype.start = async function(node){
	if(!this._loaded){
		await this.load();
	}
	node = node || this._page;

	try {
		this._stop = false;
		await this.fillInputValues(node);
		await this._crawlDOM(node);
		return this;
	}catch(e){
		this._errors.push(["navigation","navigation aborted"]);
		//_this.dispatchProbeEvent("end", {});
		throw e;
	}
}




Crawler.prototype.stop = function(){
	this._stop = true;
}


Crawler.prototype.on = function(eventName, handler){
	eventName = eventName.toLowerCase();
	if(!(eventName in this.probeEvents)){
		throw("unknown event name: " + eventName);
	}
	this.probeEvents[eventName] = handler;
};


Crawler.prototype.probe = function(method, args){
	var _this = this;

	return new Promise( (resolve, reject) => {
		_this._page.evaluate( async (method, args) => {
			var r = await window.__PROBE__[method](...args);
			return r;
		}, [method, args]).then( ret => resolve(ret));
	})
}


Crawler.prototype.dispatchProbeEvent = async function(name, params) {
	name = name.toLowerCase();
	var ret, evt = {
		name: name,
		params: params || {}
	};

	ret = await this.probeEvents[name](evt, this);
	if(ret === false){
		return false;
	}

	if(typeof ret == "object"){
		return ret;
	}

	return true;
}

Crawler.prototype.dispatchUIEvent = async function(name, params) {
	const evt = {
		name: name,
		params: params || {}
	};
	await this.UIEvents[name](evt, this);
}

Crawler.prototype.handleRequest = async function(req){
	let extrah = req.headers();
	let type = req.resourceType(); // xhr || fetch
	delete extrah['referer'];
	delete extrah['user-agent'];
	let r = new utils.Request(type, req.method(), req.url().split("#")[0], req.postData(), this._trigger, extrah);
	let rk = r.key();
	if(this._sentRequests.indexOf(rk) != -1){
		req.abort('aborted');
		return;
	}
	for(let ex of this.options.excludedUrls){
		if(r.url.match(ex)){
			req.abort('aborted');
			return;
		}
	}
	// add to pending ajax before dispatchProbeEvent.
	// Since dispatchProbeEvent can await for something (and take some time) we need to be sure that the current xhr is awaited from the main loop
	let ro = {p:req, h:r};
	this._pendingRequests.push(ro);
	let uRet = await this.dispatchProbeEvent(type, {request:r});
	if(uRet){
		req.continue();
	} else {
		this._pendingRequests.splice(this._pendingRequests.indexOf(ro), 1);
		req.abort('aborted');
	}
}

Crawler.prototype._waitForRequestsCompletion = function(){
	var requests = this._pendingRequests;
	// var reqPerformed = false;
	return new Promise( (resolve, reject) => {
		var timeout = 1000 ;//_this.options.ajaxTimeout;

		var t = setInterval(function(){
			if(timeout <= 0 || requests.length == 0){
				clearInterval(t);
				resolve();
				return;
			}
			timeout -= 1;
			// reqPerformed = true;
		}, 0);
	});
}

Crawler.prototype.bootstrapPage = async function(){
	var options = this.options,
		pageCookies = this.pageCookies;

	var crawler = this;
	// generate a static map of random values using a "static" seed for input fields
	// the same seed generates the same values
	var inputValues = utils.generateRandomValues(this.options.randomSeed);

	this._allowNewWindows = true;
	const page = await this._browser.newPage();
	this._allowNewWindows = false;

	crawler._page = page;
	await page.setRequestInterception(true);
	if(options.bypassCSP){
		await page.setBypassCSP(true);
	}

	page.on('request', async req => {
		const overrides = {};
		if(req.isNavigationRequest() && req.frame() == page.mainFrame()){
			if(req.redirectChain().length > 0 && !crawler._allowNavigation){
				crawler._redirect = req.url();
				var uRet = await crawler.dispatchProbeEvent("redirect", {url: crawler._redirect});
				if(!uRet){
					req.abort('aborted'); // die silently
					return;
				}
				if(options.exceptionOnRedirect){
					req.abort('failed'); // throws exception
					return;
				}
				req.continue();
				return;
			}

			if(!crawler._firstRun){
				let r = new utils.Request("navigation", req.method() || "GET", req.url().split("#")[0], req.postData());
				await crawler.dispatchProbeEvent("navigation", {request:r});

				if(crawler._allowNavigation){
					req.continue();
				} else {
					req.abort('aborted');
				}
				return;
			} else {
				if(options.loadWithPost){
					overrides.method = 'POST';
					if(options.postData){
						overrides.postData = options.postData;
					}
				}
			}

			crawler._firstRun = false;
		}

		if(req.resourceType() == 'xhr' || req.resourceType() == 'fetch'){
			return await this.handleRequest(req);
		}
		req.continue(overrides);
	});


	page.on("dialog", function(dialog){
		dialog.accept();
	});

	page.exposeFunction("__htcrawl_probe_event__",   (name, params) =>  {return this.dispatchProbeEvent(name, params)}); // <- automatically awaited.."If the puppeteerFunction returns a Promise, it will be awaited."
	page.exposeFunction("__htcrawl_set_trigger__", (val) => {crawler._trigger = val});
	page.exposeFunction("__htcrawl_wait_requests__", () => {return crawler._waitForRequestsCompletion()});
	page.exposeFunction("__htcrawl_ui_event__", (name, params) => {return this.dispatchUIEvent(name, params)});

	await page.setViewport({width:0, height:0});

	page.evaluateOnNewDocument(probe.initProbe, this.options, inputValues);
	page.evaluateOnNewDocument(utils.initJs, this.options);

	try{
		if(options.referer){
			await page.setExtraHTTPHeaders({
				'Referer': options.referer
			});
		}
		if(options.extraHeaders){
			await page.setExtraHTTPHeaders(options.extraHeaders);
		}
		for(let i=0; i < options.setCookies.length; i++){
			if(!options.setCookies[i].expires)
				options.setCookies[i].expires = parseInt((new Date()).getTime() / 1000) + (60*60*24*365);
			try{
				await page.setCookie(options.setCookies[i]);
			}catch (e){
				//console.log(e)
			}
		}

		if(options.httpAuth){
			await page.authenticate({username:options.httpAuth[0], password:options.httpAuth[1]});
		}

		if(options.userAgent){
			await page.setUserAgent(options.userAgent);
		}

		await this._page.setDefaultNavigationTimeout(this.options.navigationTimeout);

	}catch(e) {
		// do something  . . .
		console.log(e)
	}

};

Crawler.prototype.newPage = async function(url){
	if(url){
		this._setTargetUrl(url);
	}
	this._firstRun = true;
	await this.bootstrapPage();
}

Crawler.prototype.navigate = async function(url){  // @TODO test me ( see _firstRun)
	if(!this._loaded){
		throw("Crawler must be loaded before navigate");
	}
	var resp = null;
	try{
		resp = await this._goto(url);
	}catch(e){
		this._errors.push(["navigation","navigation aborted"]);
		throw("Navigation error 2");
	}

	await this._afterNavigation(resp);
};


Crawler.prototype.reload = async function(){
	if(!this._loaded){
		throw("Crawler must be loaded before navigate");
	}
	var resp = null;
	this._allowNavigation = true;
	try{
		resp = await this._page.reload({waitUntil:'load'});
	}catch(e){
		this._errors.push(["navigation","navigation aborted"]);
		throw("Navigation error 3");
	}finally{
		this._allowNavigation = false;
	}

	await this._afterNavigation(resp);

};


Crawler.prototype.clickToNavigate = async function(element, timeout){
	const _this = this;
	var pa;
	if(!this._loaded){
		throw("Crawler must be loaded before navigate");
	}
	if(typeof element == 'string'){
		try{
			element = await this._page.$(element);
		}catch(e){
			throw("Element not found")
		}
	}
	if(typeof timeout == 'undefined') timeout = 5000;

	this._allowNavigation = true;
	// await this._page.evaluate(() => window.__PROBE__.DOMMutations=[]);

	try{
		pa = await Promise.all([
			element.click(),
			this._page.waitForRequest(req => req.isNavigationRequest() && req.frame() == _this._page.mainFrame(), {timeout:timeout}),
			this._page.waitForNavigation({waitUntil:'load'})
		]);

	} catch(e){
		console.log(e)
		pa = null;
	}
	this._allowNavigation = false;

	if(pa != null){
		await this._afterNavigation(pa[2]);
		return true;
	}
	_this._errors.push(["navigation","navigation aborted"]);
	throw("Navigation error 1");
};

Crawler.prototype.popMutation = async function(){
	return await this._page.evaluateHandle(() => window.__PROBE__.popMutation())
}

Crawler.prototype.getEventsForElement = async function(el){
	const events = await this._page.evaluate( el => window.__PROBE__.getEventsForElement(el), el != this._page ? el : this.documentElement);
	const l = await this.getElementEventListeners(el);
	return events.concat(l.listeners.map(i => i.type));
}


/* DO NOT include node as first element.. this is a requirement */
Crawler.prototype.getDOMTreeAsArray = async function(node){
	var out = [];
	try{
		// Note: * returns only nodes of type Element but it returns also XMLElement and SVGElement
		var children = await node.$$(":scope > *:not([data-htcrawl_crawl_excluded_element])");
	}catch(e){
		return []
	}

	if(children.length == 0){
		return out;
	}

	for(var a = 0; a < children.length; a++){
		out.push(children[a]);
		out = out.concat(await this.getDOMTreeAsArray(children[a]));
	}

	return out;
}

Crawler.prototype.isAttachedToDOM = async function(node){
	if(node == this._page){
		return true;
	}
	var p = node;
	while(p.asElement()) {
		let n = await (await p.getProperty('nodeName')).jsonValue();
		if(n.toLowerCase() == "html")
			return true;
		p = await p.getProperty('parentNode')//p.parentNode;
	}
	return false;
};

Crawler.prototype.triggerElementEvent = async function(el, event){
	await this._page.evaluate((el, event) => {
		window.__PROBE__.triggerElementEvent(el, event)
	}, el != this._page ? el : this.documentElement, event)
}

Crawler.prototype.getElementText = async function(el){
	if(el == this._page){
		return null;
	}
	return await this._page.evaluate(el => {
		if(el.tagName == "STYLE" || el.tagName == "SCRIPT"){
			return null;
		}
		return el.innerText;
	}, el);
}


Crawler.prototype.fillInputValues = async function(el){
	await this._page.evaluate(el => {
		window.__PROBE__.fillInputValues(el);
	}, el != this._page ? el : this.documentElement);
}

Crawler.prototype.getElementSelector = async function(el){
	return await this._page.evaluate(el => {
		return window.__PROBE__.getElementSelector(el);
	}, el != this._page ? el : this.documentElement);
}

Crawler.prototype.getTotalDomMutations = async function(){
	return await this._page.evaluate(() => {
		return window.__PROBE__.totalDOMMutations;
	});
}

Crawler.prototype.isEventRegistered = function(event){
	return !!this.probeEvents[event];
}

Crawler.prototype._crawlDOM = async function(node, layer, domArr){
	if(this._stop) return;

	/// node = node || this._page;
	layer = typeof layer != 'undefined' ? layer : 0;
	if(layer == this.options.maximumRecursion){
		//console.log(">>>>RECURSON LIMIT REACHED :" + layer)
		return;
	}
	
	if(this.isEventRegistered("crawlelement")){
		// do not await
		this.dispatchProbeEvent("crawlelement", {
			element: await this.getElementSelector(node)
		});
	}

	// domArr is present when, during recursion, we had to call getDOMTreeAsArray()
	// before calling _crawlDOM(). In this case we pass the result of getDOMTreeAsArray
	// to _crawlDOM to avoit calling it twice
	domArr = domArr || await this.getDOMTreeAsArray(node);
	this._trigger = {};
	if(this.options.crawlmode == "random"){
		this.randomizeArray(domArr);
	}

	var dom = [node].concat(domArr);
	var	newEls;
	var newRoot;
	var newRoots;
	var uRet;

	if(layer == 0){
		await this._resetMutationObserver();
		await this.dispatchProbeEvent("start");
	}

	//let analyzed = 0;
	for(let el of dom){
		if(this._stop) return;
		// let elsel = await this.getElementSelector(el);  // AVOID calling getElementSelector since it's slow!
		let elsel = null;
		if(this.isEventRegistered("earlydetach") && ! await this.isAttachedToDOM(el)){ // avoid await as much as we can
			elsel = await this.getElementSelector(el);
			uRet = await this.dispatchProbeEvent("earlydetach", {
				node: elsel, // For backward compatibility
				element: elsel
			});
			if(!uRet) continue;
		}

		for(let event of await this.getEventsForElement(el)){
			if(this._stop) return;
			if(this.options.triggerEvents){
				if(this.isEventRegistered("triggerevent")){ // avoid await as much as we can
					elsel = elsel || await this.getElementSelector(el);
					uRet = await this.dispatchProbeEvent("triggerevent", {
						node: elsel, // For backward compatibility
						element: elsel,
						event: event
					});
					if(!uRet) continue;
				}
				await this.triggerElementEvent(el, event);
				if(this.isEventRegistered("eventtriggered")){ // avoid await as much as we can
					elsel = elsel || await this.getElementSelector(el);
					await this.dispatchProbeEvent("eventtriggered", {
						node: elsel, // For backward compatibility
						element: elsel,
						event: event
					});
				}
			}

			// console.log("waiting requests to compete " + this._pendingRequests)
			await this.waitForRequestsCompletion();

			newRoots = [];
			newRoot = await this.popMutation();
			while(newRoot.asElement()){
				newRoots.push(newRoot);
				newRoot = await this.popMutation();
			}
			newEls = [];
			const totDomMutations = await this.getTotalDomMutations();  // note: used only id options.skipDuplicateContent
			
			for(let root of newRoots){
				const domArr = this.options.skipDuplicateContent ? await this.getDOMTreeAsArray(root) : null;
				if(domArr){
					const dedup = this.domDeduplicator.addNode(domArr, totDomMutations);
					if(dedup.added === false){
						if(dedup.seenCount > 50){
							continue;
						}
						// if the difference, in percentage, of the totDomMutations now and the ones at time when the element was first seen
						// is less than 30% AND the element has been seen more than 12 times
						// then skip that element
						if(((totDomMutations - dedup.totDomMutations) * 100 ) / totDomMutations < 90 && dedup.seenCount > 12){
							continue;
						}
					}
				}
				newEls.push({
					node: root,
					domArr: domArr  // cache getDOMTreeAsArray() result for next recursion call
				});
			}

			if(newEls.length == 0){
				continue;
			}
			// randomize root nodes if requested
			if(this.options.crawlmode == "random"){
				this.randomizeArray(newEls);
			}
			for(let ne of newEls){
				if(this._stop) return;
				await this.fillInputValues(ne.node);
			}
			for(let ne of newEls){
				if(this._stop) return;
				if(this.isEventRegistered("newdom")){
					uRet = await this.dispatchProbeEvent("newdom", {
						rootNode: await this.getElementSelector(ne.node),
						trigger: this._trigger,
						layer: layer
					});
					if(uRet){
						await this._crawlDOM(ne.node, layer + 1, ne.domArr);
					}
				}
			}
		}
	}
}

Crawler.prototype.getElementRemoteId = async function(el){
	if(el == this._page){
		el = this.documentElement;
	}
	const node = await this._page._client().send("DOM.describeNode", {
		objectId: el.remoteObject().objectId
	});
	return node.node.backendNodeId;
}


Crawler.prototype.getElementEventListeners = async function(el){
	if(el == this._page){
		el = this.documentElement;
	}
	//try{
	const node = await this._page._client().send("DOMDebugger.getEventListeners", {
		objectId: el.remoteObject().objectId
	});
	//}catch(e){console.log(el)}

	return node;
}


Crawler.prototype.randomizeArray = function(arr) {
	var a, ri;
	for (a = arr.length - 1; a > 0; a--) {
		ri = Math.floor(Math.random() * (a + 1));
		[arr[a], arr[ri]] = [arr[ri], arr[a]];
	}
};


Crawler.prototype.sendToUI = async function(message) {
	if(!this.options.showUI){
		throw "UI is not enabled";
	}
	const serviceWorker = await this._browser.waitForTarget(
		target => target.type() === 'service_worker'
	);
	const w = await serviceWorker.worker();
	try{
		 w.evaluate(message => {
		 	try{
				chrome.runtime.sendMessage({body: message});
			} catch(e){}
		}, message);
	} catch(e){}
};

Crawler.prototype._setUI = async function(ui){
	for(const e in ui.events){
		this.UIEvents[e] = ui.events[e];
	}

	await this._page.evaluate(async function(){
		window.__PROBE__.buildUI();
	});

	const builder = `(() => 
		(${ui.UIMethods.toString()})(window.__PROBE__.UI)
	)()`;
	await this._page.evaluate(builder);
};

Crawler.prototype._setDefaultUI = async function(ui){
	this._setUI({
		UIMethods: UI => {
			UI.crawlElement = () => {
				UI.utils.selectElement().then( e => UI.dispatch(`crawlElement`, {element: e}))
			};
			UI.start = () => {
				UI.dispatch("start")
			}
			UI.stop = () => {
				UI.dispatch("stop")
			}
			UI.clickToNavigate = () =>{
				UI.utils.selectElement().then( e => UI.dispatch(`clickToNavigate`, {element: e}))
			}
		},
		events: {
			crawlElement: async e => {
				const el = await this.page().$(e.params.element);
				await this.start(el)
				this.sendToUI("DONE")
			},
			start: async e => {
				await this.start();
				this.sendToUI("DONE")
			},
			stop: e => {
				this.stop();
			},
			clickToNavigate: e => {
				this.clickToNavigate(e.params.element)
			}
		}
	});
};
