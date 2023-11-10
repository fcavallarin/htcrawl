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


module.exports = {
	DOMDeduplicator: DOMDeduplicator
};


function DOMDeduplicator(){
	this._domNodes = [];
	this._textEncoder = new TextEncoder();
	this._crc32_table = new Int32Array([0,1996959894,3993919788,2567524794,124634137,1886057615,3915621685,2657392035,249268274,2044508324,3772115230,2547177864,162941995,2125561021,3887607047,2428444049,498536548,1789927666,4089016648,2227061214,450548861,1843258603,4107580753,2211677639,325883990,1684777152,4251122042,2321926636,335633487,1661365465,4195302755,2366115317,997073096,1281953886,3579855332,2724688242,1006888145,1258607687,3524101629,2768942443,901097722,1119000684,3686517206,2898065728,853044451,1172266101,3705015759,2882616665,651767980,1373503546,3369554304,3218104598,565507253,1454621731,3485111705,3099436303,671266974,1594198024,3322730930,2970347812,795835527,1483230225,3244367275,3060149565,1994146192,31158534,2563907772,4023717930,1907459465,112637215,2680153253,3904427059,2013776290,251722036,2517215374,3775830040,2137656763,141376813,2439277719,3865271297,1802195444,476864866,2238001368,4066508878,1812370925,453092731,2181625025,4111451223,1706088902,314042704,2344532202,4240017532,1658658271,366619977,2362670323,4224994405,1303535960,984961486,2747007092,3569037538,1256170817,1037604311,2765210733,3554079995,1131014506,879679996,2909243462,3663771856,1141124467,855842277,2852801631,3708648649,1342533948,654459306,3188396048,3373015174,1466479909,544179635,3110523913,3462522015,1591671054,702138776,2966460450,3352799412,1504918807,783551873,3082640443,3233442989,3988292384,2596254646,62317068,1957810842,3939845945,2647816111,81470997,1943803523,3814918930,2489596804,225274430,2053790376,3826175755,2466906013,167816743,2097651377,4027552580,2265490386,503444072,1762050814,4150417245,2154129355,426522225,1852507879,4275313526,2312317920,282753626,1742555852,4189708143,2394877945,397917763,1622183637,3604390888,2714866558,953729732,1340076626,3518719985,2797360999,1068828381,1219638859,3624741850,2936675148,906185462,1090812512,3747672003,2825379669,829329135,1181335161,3412177804,3160834842,628085408,1382605366,3423369109,3138078467,570562233,1426400815,3317316542,2998733608,733239954,1555261956,3268935591,3050360625,752459403,1541320221,2607071920,3965973030,1969922972,40735498,2617837225,3943577151,1913087877,83908371,2512341634,3803740692,2075208622,213261112,2463272603,3855990285,2094854071,198958881,2262029012,4057260610,1759359992,534414190,2176718541,4139329115,1873836001,414664567,2282248934,4279200368,1711684554,285281116,2405801727,4167216745,1634467795,376229701,2685067896,3608007406,1308918612,956543938,2808555105,3495958263,1231636301,1047427035,2932959818,3654703836,1088359270,936918000,2847714899,3736837829,1202900863,817233897,3183342108,3401237130,1404277552,615818150,3134207493,3453421203,1423857449,601450431,3009837614,3294710456,1567103746,711928724,3020668471,3272380065,1510334235,755167117]);
	this._elementsDiffThreshold = 15;  // 15% elements diff
	this._simhashDiffThreshold = 0.75;
}

DOMDeduplicator.prototype._newNode = function(domArray, totDomMutations){
	 const domText = domArray.map(e => {
		if(!e.nodeName)return "";
		var n = e.nodeName.toLowerCase();
		if(e.className){
			n += ("-" + e.className).replaceAll(" ", "");
		}
		return n;
	});

	return {
		nelements: domArray.length,
		simhash: this._simhash(domText),
		lastSeenAt: (new Date()).getTime(),
		seenCount: 1,
		totDomMutations: totDomMutations
	};
};

DOMDeduplicator.prototype._compare = function(node1, node2){
	const elementsDiff = (Math.abs(node1.nelements - node2.nelements) * 100 ) /  Math.max(node1.nelements, node2.nelements);
	if(elementsDiff > this._elementsDiffThreshold){
		return false;
	}
	const simhashDiff = this._similarity(node1.simhash, node2.simhash);
	// console.log("____>_"+simhashDiff)
	if(simhashDiff < this._simhashDiffThreshold){
		return false;
	}
	return true;
};

DOMDeduplicator.prototype._getNode = function(node){
	for(let n of this._domNodes){
		if(this._compare(n, node)){
			return n;
		}
	}
	return null;
};

DOMDeduplicator.prototype._shinglew = function(arr){
		var w = 2;
		if (arr.length < w) return arr;

		var ret = [];
		for(let i = 0; i < arr.length - (w-1); i++){
			ret.push(arr.slice(i, i+w).join(" "))
		}
		return ret
};

DOMDeduplicator.prototype._crc32 = function(str){	
	var crc = 0xffffffff;
	for(let c of this._textEncoder.encode(str)){
		crc = ( crc >>> 8 ) ^ this._crc32_table[( crc ^ c ) & 0xFF];
	}
	return (crc ^ (-1)) >>> 0;
};

DOMDeduplicator.prototype._hash_tokens = function(tokens){
	const ret = [];
	for(let t of tokens){
		let h = this._crc32(t);
		ret.push(h);
	}
	return ret;
};

DOMDeduplicator.prototype._simhash = function(arr){
	var i;
	const features = this._hash_tokens(this._shinglew(arr));
	const hashVector = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
	const m = 0x00000001;
	for(let hash of features){
		for(i=0; i < 32; i++){
			hashVector[i] += (hash & (m << i)) == 0 ? -1 : 1;
			// out[i] = (a >> i) % 2 == 0 ? 0 : 1
		}
	}
	let sh = 0;
	for(i=0; i < 32; i++){
		if(hashVector[i] > 0){
			sh |= m << i;
		}
	}
	// console.log("---> " + sh + " " + features.length)
	return sh;
};

DOMDeduplicator.prototype._similarity = function(x, y){
	return this._hammingWeight(x & y) / this._hammingWeight(x | y);
};

DOMDeduplicator.prototype._hammingWeight = function(l){
	var c = 0;
	while(l){
		l &= l - 1;
		c += 1;
	}
	return c;
};

DOMDeduplicator.prototype.reset = function(){
	this._domNodes = [];
};

DOMDeduplicator.prototype.addNode = function(domArray, totDomMutations){
	const newNode = this._newNode(domArray, totDomMutations);
	const existingNode = this._getNode(newNode);
	if(existingNode === null){
		this._domNodes.push(newNode);
		return {added: true};
	}
	const ret = {
		added: false,
		lastSeenAt: existingNode.lastSeenAt,
		seenCount: existingNode.seenCount,
		totDomMutations: existingNode.totDomMutations
	};
	existingNode.lastSeenAt = (new Date()).getTime();
	existingNode.seenCount++;
	return ret;
};
