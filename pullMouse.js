/* jshint -W064, -W104, -W119, -W097, -W067 */
/* jshint node: true */
"use strict";
const generate = require('pull-generate');
module.exports = (screen)=> {
    let doAbort = false;
    let source = generate(0, (state, cb)=> {
        setTimeout( ()=> {
            if (doAbort) console.log('aborting');
            cb(doAbort ? new Error('pullMouse aborted.') : null, screen.getCursorScreenPoint());
        }, 50);
    });

    source.abort = () => {
        console.log('source abort on next read');
        doAbort = true; 
    };
    return source;
};
