/* jshint -W064, -W104, -W119, -W097, -W067 */
/* jshint node: true */

"use strict";

let pull = require('pull-stream');

let clicker = (action) => {
    return pull.asyncMap( ( () => { 
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

pull(
    //pull.values([null,null,null,null]),
    pull.values([1,1,1,1,1,1,1,1,1,1]),
    
        clicker('action1'),
        clicker('actione')
    
    pull.filter( x => x ),
    pull.log()
);

