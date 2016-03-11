/* jshint -W064, -W104, -W119, -W097, -W067 */
/* jshint node: true */

"use strict";
var pcontinue = require('pull-continue');

let pull = require('pull-stream');

let makeClicker = (action) => {
    return pull.asyncMap( ( () => { 
        console.log('i am a new stream', action);
        let count = 5; 
        return (data, cb) => {
            if (data) count--;
            let doAction = count === 0;
            if (doAction) {
                console.log('doAction');
                setTimeout( () => {
                    console.log('great success');
                    cb(null, action);
                }, 300);
            } else {
                if (count<0) {
                    console.log('below 0');
                    setTimeout( () => {
                        console.log('abort');
                        cb(true);
                    }, 300);
                } else {
                    setTimeout( () => {
                        console.log('no action');
                        cb(null, null);
                    }, 300);
                }
            }
        };
    })() );
};

var actions = ['action1', 'azione'];

pull(
    pcontinue( (i, n) => {
        if (i<actions.length) {
            console.log("stream number "+ i);
            return pull(
                //pull.values([null,null,null,null]),
                pull.values([1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]),
                makeClicker(actions[i])
            );
        }
        return;
    }),
    
    pull.filter( x => x ),
    pull.log()
);

