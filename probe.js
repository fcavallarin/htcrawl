/*
HTCRAWL - 1.0
http://htcrawl.org
Author: filippo@fcvl.net

This program is free software; you can redistribute it and/or modify it under
the terms of the GNU General Public License as published by the Free Software
Foundation; either version 2 of the License, or (at your option) any later
version.
*/

"use strict";

module.exports = {
	initProbe: initProbe
};



/*
	this function is passed to page.evaluate. doing so it is possible to avoid that the Probe object
	is inserted into page window scope (only its instance is referred by window.__PROBE__)
*/
function initProbe(options, inputValues){

	function Probe(options, inputValues){
		var _this = this;

		this.options = options;

		this.requestsPrintQueue = [];
		this.sentAjax = [];

		this.curElement = {};
		this.winOpen = [];
		this.resources = [];
		this.eventsMap = [];

		this.triggeredEvents = [];
		this.websockets = [];
		this.html = "";
		this.printedRequests = [];
		this.DOMSnapshot = [];
		//this._pendingAjax = [];
		this._pendingJsonp = [];
		//this._pendingFetch = [];
		this._pendingWebsocket = [];
		this.inputValues = inputValues;
		this.currentUserScriptParameters = [];
		this.domModifications = [];

		this._lastRequestId = 0;
		this.started_at = null;

		this.textComparator = null;

		this.setTimeout = window.setTimeout.bind(window);
		this.setInterval = window.setInterval.bind(window);



		this.DOMMutations = [];
		this.DOMMutationsToPop = [];

	};



	Probe.prototype.getRootNodes = function(elements){
		const rootElements = [];
		for(var a = 0; a < elements.length; a++){
			var p = elements[a];
			var root = null;
			// find the farest parent between added elements
			while(p){
				if(elements.indexOf(p) != -1){
					root = p;
				}
				//console.log(p)
				p = p.parentNode;
			}
			if(root && rootElements.indexOf(root) == -1){
				rootElements.push(root);
			}
		}

		return rootElements;
	}



	Probe.prototype.popMutation = function(){
		const roots = this.getRootNodes(this.DOMMutations)
		//console.log(roots)
		this.DOMMutations = [];
		this.DOMMutationsToPop = this.DOMMutationsToPop.concat(roots);
		const first = this.DOMMutationsToPop.splice(0,1);
		return first.length == 1 ? first[0] : null;
	}



	Probe.prototype.objectInArray  = function(arr, el, ignoreProperties){
		ignoreProperties = ignoreProperties || [];
		if(arr.length == 0) return false;
		if(typeof arr[0] != 'object')
			return arr.indexOf(el) > -1;
		for(var a = 0 ;a < arr.length; a++){
			var found = true;
			for(var k in arr[a]){
				if(arr[a][k] != el[k] && ignoreProperties.indexOf(k) == -1){
					found = false;
				}
			}
			if(found) return true;
		}
		return false;
	};



	Probe.prototype.arrayUnique = function(arr, ignoreProperties){
		var ret = [];

		for(var a = 0; a < arr.length ; a++){
			if(!this.objectInArray(ret, arr[a], ignoreProperties))
				ret.push(arr[a]);
		}
		return ret;
	};

	Probe.prototype.compareObjects = function(obj1, obj2){
		var p;
		for(p in obj1)
			if(obj1[p] != obj2[p]) return false;

		for(p in obj2)
			if(obj2[p] != obj1[p]) return false;

		return true;
	}


	/*
		anchor.protocol; // => "http:"
		anchor.host;     // => "example.com:3000"
		anchor.hostname; // => "example.com"
		anchor.port;     // => "3000"
		anchor.pathname; // => "/pathname/"
		anchor.hash;     // => "#hash"
		anchor.search;   // => "?search=test"
	*/

	Probe.prototype.replaceUrlQuery = function(url, qs){
		var anchor = document.createElement("a");
		anchor.href = url;
		return anchor.protocol + "//" + anchor.host + anchor.pathname + (qs ? "?" + qs : "") + anchor.hash;
	};

	Probe.prototype.removeUrlParameter = function(url , par){
		var anchor = document.createElement("a");
		anchor.href = url;

		var pars = anchor.search.substr(1).split(/(?:&amp;|&)+/);

		for(var a = pars.length - 1; a >= 0; a--){
			if(pars[a].split("=")[0] == par)
				pars.splice(a,1);
		}


		return anchor.protocol + "//" + anchor.host + anchor.pathname + (pars.length > 0 ? "?" + pars.join("&") : "") + anchor.hash;
	};


	Probe.prototype.getAbsoluteUrl = function(url){
		var anchor = document.createElement('a');
		anchor.href = url;
		return anchor.href;
	};


	Probe.prototype.randomizeArray = function(arr) {
		var a, ri;
		for (a = arr.length - 1; a > 0; a--) {
			ri = Math.floor(Math.random() * (a + 1));
			[arr[a], arr[ri]] = [arr[ri], arr[a]];
		}
	};



	// class Request

	Probe.prototype.Request = function(type, method, url, data, trigger, extra_headers){
		this.type = type;
		this.method = method;
		this.url = url;
		this.data = data || null;
		this.trigger = trigger || null;
		this.extra_headers = extra_headers || {};

		//this.username = null; // todo
		//this.password = null;
	}

	// returns a unique string represntation of the request. used for comparision
	// should I also use extra_headers for comparisionn??
	Probe.prototype.Request.prototype.key = function(){
		var key = "" + this.type + this.method + this.url + (this.data ? this.data : "") + (this.trigger ? this.trigger : "")
		return key;
	};


	Probe.prototype.requestToJson = function(req){

		return JSON.stringify(this.requestToObject(req));
	}

	Probe.prototype.requestToObject = function(req){
		var obj ={
			type: req.type,
			method: req.method,
			url: req.url,
			data: req.data || null,
			extra_headers: req.extra_headers
		};

		if(req.trigger) obj.trigger = {element: this.describeElement(req.trigger.element), event:req.trigger.event};

		return obj;
	}

	// END OF class Request..





	// returns true if the value has been set
	Probe.prototype.setVal = async function(el){
		var options = this.options;
		var _this = this;

		var ueRet = await this.dispatchProbeEvent("fillinput", {element: this.getElementSelector(el)});
		if(ueRet === false) return;

		var getv = function(type){
			if(!(type in _this.inputValues))
				type = "string";

			return _this.inputValues[type];
		}

		var setv = function(name){
			var ret = getv('string');
			for(var a = 0; a < options.inputNameMatchValue.length; a++){
				var regexp = new RegExp(options.inputNameMatchValue[a].name, "gi");
				if(name.match(regexp)){
					ret = getv(options.inputNameMatchValue[a].value);
				}
			}
			return ret;
		}

		// needed for example by angularjs
		var triggerChange =  function(){
			// update angular model
			_this.trigger(el, 'input');
		}

		if(el.nodeName.toLowerCase() == 'textarea'){
			el.value = setv(el.name);
			triggerChange();
			return true;
		}

		if(el.nodeName.toLowerCase() == 'select'){
			var opts = el.getElementsByTagName('option');
			if(opts.length > 1){ // avoid to set the first (already selected) options
				el.value = opts[opts.length-1].value;
			} else {
				el.value = setv(el.name);
			}
			triggerChange();
			return true;
		}

		var type = el.type.toLowerCase();

		switch(type){
			case 'button':
			case 'hidden':
			case 'submit':
			case 'file':
				return false;
			case '':
			case 'text':
			case 'search':
				el.value = setv(el.name);
				break;

			case 'radio':
			case 'checkbox':
				el.setAttribute('checked',!(el.getAttribute('checked')));
				break;
			case 'range':
			case 'number':

				if('min' in el && el.min){

					el.value = (parseInt(el.min) + parseInt(('step' in el) ? el.step : 1));
				} else{
					el.value = parseInt(getv('number'));
				}
				break;
			case 'password':
			case 'color':
			case 'date':
			case 'email':
			case 'month':
			case 'time':
			case 'url':
			case 'week':
			case 'tel':
				el.value = getv(type);
				break;
			case 'datetime-local':
				el.value = getv('datetimeLocal');
				break;


			default:
				return false;
		}

		triggerChange();
		return true;
	};



	Probe.prototype.getStaticInputValue = function(input){
		if(!this.options.staticInputValues.length )
			return null;

		for(let val of this.options.staticInputValues){
			if(input.matches(val[0])){
				return val[1];
			}
		}

		return null;

	};

	Probe.prototype.fillInputValues = async function(element){
		const inputs = ["input", "select", "textarea"]
		element = element || document;
		var els;
		// var ret = false;
		try{
			els = element.querySelectorAll(inputs.join(","));
		}catch(e){
			return false;
		}
		if(inputs.indexOf(element.nodeName.toLowerCase()) > -1){
			await this.setVal(element);
			// update angularjs model
			this.trigger(element, 'input');
		}
		for(var a = 0; a < els.length; a++){
			await this.setVal(els[a]);
			// update angularjs model
			this.trigger(els[a], 'input');
		}
		// return ret;
	};


	Probe.prototype.trigger = function(el, evname){
		/* 	workaround for a phantomjs bug on linux (so maybe not a phantom bug but some linux libs??).
			if you trigger click on input type=color evertything freezes... maybe due to some
			color picker that pops up ...
		*/
		if(el.tagName == "INPUT" && el.type.toLowerCase()=='color' && evname=='click'){
			return;
		}

		if(typeof evname != "string")return;

		var pdh = function(e){
			/*
			var el = e.target;
			var urlproto = null;

			if(el.matches("a")){
				urlproto = el.protocol;
				if(el.target == "_blank") el.target = "_self"; // @workaround prevent new tabs
			} else if(el.form){ // button or submit
				let url = document.createElement("a");
				url.href = el.form.action;
				urlproto = url.protocol;
				if(el.form.target == "_blank") el.form.target = "_self" // @workaround prevent new tabs
			}

			if(urlproto && urlproto.match(/^https?\:/i) == null){ // @workaround prevent malfomed urls and about:blank to lead to about:blank
				e.preventDefault();
			}
			*/

			// Allow navigation only if it points to the current page and the hash has changed
			if(el.matches("a")){
				var newUrl;
				try{
					newUrl = new URL(el.href);
				}catch(e){
					newUrl = null; // malformed URL, block navigation
				}
				if(newUrl){
					const curUrl = new URL(document.location.href);
					if(newUrl.hash && newUrl.hash != curUrl.hash){
						newUrl.hash = "";
						curUrl.hash = "";
						if(newUrl.toString() == curUrl.toString()){
							return;
						}
					}
				}
			}
			e.preventDefault();
			e.stopPropagation();
			e.stopImmediatePropagation();
		}

		if ('createEvent' in document) {
			// @TODO solve the "mouse event" problem
			var evt = null;
			if(this.options.simulateRealEvents){
				if(this.options.mouseEvents.indexOf(evname) != -1){
					evt = new MouseEvent(evname, {view: window, bubbles: true, cancelable: true});
					if(evname.toLowerCase() == "click" && el.matches('a, button, input[type="submit"], input[type="file"]')){
						el.addEventListener(evname, pdh);
					}
				/*} else if(this.options.keyboardEvents.indexOf(evname) != -1){*/
				}
			}

			if(evt == null) {
				evt = document.createEvent('HTMLEvents');
				evt.initEvent(evname, true, false);
			}

			el.dispatchEvent(evt);
		} else {
			evname = 'on' + evname;
			if( evname in el && typeof el[evname] == "function"){
				el[evname]();
			}
		}
		try{
			el.removeEventListener(evname, pdh);
		} catch(e){}
		//this.triggerUserEvent("onEventTriggered", [el, evname])
	};


	Probe.prototype.isEventTriggerable = function(event){

		return ['load','unload','beforeunload'].indexOf(event) == -1;

	};

	Probe.prototype.getEventsForElement = function(element){
		var events = [];
		var map;

		map = this.options.eventsMap;
		try{
			for(var selector in map){
				if(element.webkitMatchesSelector(selector)){
					events = events.concat(map[selector]);
				}
			}
		}catch(e){
			return events;
		}
		//if(events.length >0 ) return ['click']
		return events;
	};





	Probe.prototype.triggerElementEvent = function(element, event){
		var teObj = {el: element, ev: event};
		//this.curElement = {};
		this.setTrigger({});
		if(!event)return
		if(!this.isEventTriggerable(event) || this.objectInArray(this.triggeredEvents, teObj))
			return
		//this.curElement.element = element;
		//this.curElement.event = event;
		this.setTrigger({element: element, event:event});
		this.triggeredEvents.push(teObj);
		this.trigger(element, event);
	}

	Probe.prototype.getTrigger = function(){
		if(!this.curElement || !this.curElement.element)
			return null;

		return {
			element: this.describeElement(this.curElement.element),
			event: this.curElement.event
		};
	};


	Probe.prototype.describeElements = function(els){
		var ret = [];
		for(el of els){
			ret.push(this.describeElement(el));
		}
		return ret;
	}

	Probe.prototype.describeElement = function(el){
		//return this.stringifyElement(el);
		return this.getElementSelector(el);
	};


	Probe.prototype.stringifyElement = function(el){
		if(!el)
			return "[]";
		var tagName = (el == document ? "DOCUMENT" : (el == window ? "WINDOW" :el.tagName));
		var text = null;
		if(el.textContent){
			text =  el.textContent.trim().replace(/\s/," ").substring(0,10)
			if(text.indexOf(" ") > -1) text = "'" + text + "'";
		}


		var className = (el.className && typeof el.className == 'string') ? (el.className.indexOf(" ") != -1 ? "'" + el.className + "'" : el.className) : "";
		var descr = "[" +
				(tagName ? tagName +  " " : "") +
				(el.name && typeof el.name == 'string' ? el.name + " " : "") +
				(className ? "." + className + " " : "")+
				(el.id ? "#" + el.id + " " : "") +
				(el.src ? "src=" + el.src + " " : "") +
				(el.action ? "action=" + el.action + " " : "") +
				(el.method ? "method=" + el.method + " " : "") +
				(el.value ? "v=" + el.value + " ": "") +
				(text ? "txt=" + text : "") +
				"]";

		return descr;

	};

	Probe.prototype.getElementSelector = function(element){
		if(!element || !(element instanceof HTMLElement)){
			if(element instanceof SVGPathElement){
				return "SVG";
			}
			return "";
		}
		var name = element.nodeName.toLowerCase();
		var ret = [];
		var selector = ""
		var id = element.getAttribute("id");

		if(id && id.match(/^[a-z][a-z0-9\-_:\.]*$/i)){
			selector = "#" + id;
		} else {
			let p = element;
			let cnt = 1;
			while(p = p.previousSibling){
				if(p instanceof HTMLElement && p.nodeName.toLowerCase() == name){
					cnt++;
				}
			}
			selector = name + (cnt > 1 ? `:nth-of-type(${cnt})` : "");
			if(element != document.documentElement && name != "body" && element.parentNode){
				ret.push(this.getElementSelector(element.parentNode));
			}
		}
		ret.push(selector);
		return ret.join(" > ");
	}



	Probe.prototype.getFormAsRequest = function(form){

		var formObj = {};
		var inputs = null;
		var par;

		formObj.method = form.getAttribute("method");
		if(!formObj.method){
			formObj.method = "GET";
		} else {
			formObj.method = formObj.method.toUpperCase();
		}

		formObj.url = form.getAttribute("action");
		if(!formObj.url) formObj.url = document.location.href;
		formObj.data = [];
		inputs = form.querySelectorAll("input, select, textarea");
		for(var a = 0; a < inputs.length; a++){
			if(!inputs[a].name) continue;
			par = encodeURIComponent(inputs[a].name) + "=" + encodeURIComponent(inputs[a].value);
			if(inputs[a].tagName == "INPUT" && inputs[a].type != null){

				switch(inputs[a].type.toLowerCase()){
					case "button":
					case "submit":
						break;
					case "checkbox":
					case "radio":
						if(inputs[a].checked)
							formObj.data.push(par);
						break;
					default:
						formObj.data.push(par);
				}

			} else {
				formObj.data.push(par);
			}
		}

		formObj.data = formObj.data.join("&");

		if(formObj.method == "GET"){
			var url = this.replaceUrlQuery(formObj.url, formObj.data);
			req = new this.Request("form", "GET", url);
		} else {
			var req = new this.Request("form", "POST", formObj.url, formObj.data, this.getTrigger());
		}


		return req;

	};



	Probe.prototype.addEventToMap = function(element, event){

		for(var a = 0; a < this.eventsMap.length; a++){
			if(this.eventsMap[a].element == element){
				this.eventsMap[a].events.push(event);
				return;
			}
		}
		this.eventsMap.push({
			element: element,
			events: [event]
		});
	};




	Probe.prototype.dispatchProbeEvent = async function(name, params){
		return await window.__htcrawl_probe_event__(name, params);
	};



	Probe.prototype.simhashDistance = function(s1, s2){
		var x = (s1 ^ s2) & ((1 << 64) - 1);
		var ans = 0;
		while(x){
			ans += 1;
			x &= x - 1;
		}
		return ans;
	}



	Probe.prototype.jsonpHook = function(node){
		if(!(node instanceof HTMLElement) || !node.matches("script")) return;
		var src = node.getAttribute("src");
		if(!src) return;
		var _this = this;


		var a = document.createElement("a");
		a.href = src;

		// JSONP must have a querystring...
		if(!a.search) return;

		var req  = new this.Request("jsonp", "GET", src, null, this.getTrigger());
		node.__request = req;

		// __skipped requests.. todo

		this._pendingJsonp.push(node);

		var ev = function(){
			var i = _this._pendingJsonp.indexOf(node);
			if(i == -1){
				// ERROR !!
			} else {
				_this._pendingJsonp.splice(i, 1);
			}

			_this.dispatchProbeEvent("jsonpCompleted", {
				request: req,
				script: _this.describeElement(node)
			});
			node.removeEventListener("load", ev);
			node.removeEventListener("error", ev);
		}

		node.addEventListener("load", ev);
		node.addEventListener("error", ev);

		this.dispatchProbeEvent("jsonp", {
			request: req
		});
	};




	Probe.prototype.triggerWebsocketEvent = function(url){

		var req  = new this.Request("websocket", "GET", url, null, this.getTrigger());
		this.dispatchProbeEvent("websocket", { request: req});

	}

	Probe.prototype.triggerWebsocketMessageEvent = function(url, message){

		var req  = new this.Request("websocket", "GET", url, null, null);
		this.dispatchProbeEvent("websocketMessage", { request: req, message: message});

	}

	Probe.prototype.triggerWebsocketSendEvent = async function(url, message){
		var req  = new this.Request("websocket", "GET", url, null, null);
		return await this.dispatchProbeEvent("websocketSend", { request: req, message: message});

	}


	Probe.prototype.triggerFormSubmitEvent = function(form){

		var req = this.getFormAsRequest(form);
		this.dispatchProbeEvent("formSubmit", {
			request: req,
			form: this.describeElement(form)
		});

	}


	Probe.prototype.triggerNavigationEvent = function(url, method, data){
		var req = null;
		method = method || "GET";

		url = url.split("#")[0];

		req = new this.Request("navigation", method, url, data);

		this.dispatchProbeEvent("navigation", {
			request: req
		});

	};



	// returns true if at least one request is performed
	Probe.prototype.waitRequests = async function(requests){
		var _this = this;
		var reqPerformed = false;
		return new Promise( (resolve, reject) => {
			var timeout = _this.options.ajaxTimeout;

			var t = _this.setInterval(function(){
				if(timeout <= 0 || requests.length == 0){
					clearInterval(t);
					//console.log("waitajax reoslve()")
					resolve(reqPerformed);
					return;
				}
				timeout -= 1;
				reqPerformed = true;
			}, 0);
		});
	}



	Probe.prototype.waitJsonp = async function(){
		await this.waitRequests(this._pendingJsonp);
		if(this._pendingJsonp.length > 0) {
			for(let req of this._pendingJsonp){
				await this.dispatchProbeEvent("jsonpCompleted", {
					request: req.__request,
					response: null,
					timedout: true
				});
			}
		}
		this._pendingJsonp = [];
	}


	Probe.prototype.waitWebsocket = async function(){
		await this.waitRequests(this._pendingWebsocket);
		if(this._pendingWebsocket.length > 0) {
			// @TODO handle request timeout
		}
		this._pendingWebsocket = [];
	}


	Probe.prototype.websocketHook =  function(ws, url){
		var _this = this;
		this.triggerWebsocketEvent(url);

		var delFromPendings = function(){
			const i = _this._pendingWebsocket.indexOf(ws);
			if(i > -1){
				_this._pendingWebsocket.splice(i, 1);
			}
		}
		ws.__originalSend = ws.send;
		this._pendingWebsocket.push(ws);
		ws.send = async function(message){
			var uRet =  await _this.triggerWebsocketSendEvent(url, message);
			if(!uRet){
				delFromPendings();
				return false;
			}
			if(typeof uRet == "object"){
				message = uRet.message;
			}
			return ws.__originalSend(message);
		}
		ws.addEventListener("message", function(message){
			_this.triggerWebsocketMessageEvent(url, message.data);
			delFromPendings();
		});
	}


	Probe.prototype.isAttachedToDOM = function(node){
		var p = node;
		while(p) {
			if(p.nodeName.toLowerCase() == "html")
				return true;
			p = p.parentNode;
		}
		return false;
	};

	Probe.prototype.getDetachedRootNode = function(node){
		var p = node;
		while(p.parentNode) {
			if(p.parentNode.nodeName.toLowerCase() == "html")
				return null;
			p = p.parentNode;
		}
		return p;
	};


	Probe.prototype.setTrigger = function(value){
		this.curElement = value;
		window.__htcrawl_set_trigger__(this.getTrigger()); // should be awaited...
	}


	// Probe.prototype.sleep = function(n){
	// 	return new Promise(resolve => {
	// 		this.setTimeout(resolve, n);
	// 	});
	// };



	window.__PROBE__ = new Probe(options, inputValues);
};
