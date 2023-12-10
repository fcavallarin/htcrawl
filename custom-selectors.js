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
puppeteer.Puppeteer.registerCustomQueryHandler('inframe', {
    queryOne: async (element, selector) => {
  
    // Should be safe to use ' ; ' as separator. Ofc data-x='a ; b' can brake it
    const tokens = selector.split(" ; ");  
    let frames = element.querySelectorAll(tokens[0]);
    for(let i = 1; i < tokens.length; i++){
        // TODO discend all frames 
        try{ 
            frames = frames[0].contentWindow.document.querySelectorAll(tokens[i]);
        }catch(e){
            throw `Element '${tokens[i]}' not found, not a Frame or not on the same origin`;
        }
    }
    return frames[0] || null;
    },

    queryAll: async (element, selector) => {

        // Should be safe to use ' ; ' as separator. Ofc data-x='a ; b' can brake it
        const tokens = selector.split(" ; ");
        let frames = element.querySelectorAll(tokens[0]);
        for(let i = 1; i < tokens.length; i++){
            // TODO discend all frames 
            try{ 
                frames = frames[0].contentWindow.document.querySelectorAll(tokens[i]);
            }catch(e){
                throw `Element '${tokens[i]}' not found, not a Frame or not on the same origin`;
            }
        }
        return frames;
    }
  });
