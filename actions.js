/* jshint -W064, -W104, -W119, -W097, -W067 */
/* jshint node: true */


// space spearates clicker streams
// lowercase letter: press down key or button
// uppercase release key ot button
// - wait one uint of time (default to 250ms)
//

// keys button
// shift: s
// alt: a
// ctrl: c
// left mouse: l
// middle mouse: m
// right mouse: r

// left click: lL
// right click: rR
// shift left click: slLS
// left double click: lL.lL
// ...
// drag: l~L
// context menu select: rR~lL


"use strict";
const xTest = require('node-xtest-bindings')();
const pull = require('pull-stream');
const pcontinue = require('pull-continue');
const createClickerStream = require('./clickerStream');
const conf = require('./conf');

let depressions = {};

function createButtonPress(buttonIndex, down) {
    return (cb) => {
        xTest.fakeButtonEvent(buttonIndex, down, 0);
        depressions['button' + buttonIndex] = down ? ()=> {
            xTest.fakeButtonEvent(buttonIndex, false, 0);
        } : null;
        cb(null);
    };
}

function createKeyPress(keySymbol, down) {
    let code = xTest.keySyms["XK_"+keySymbol];
    return (cb) => {
        xTest.fakeKeyEvent(code, down, 0);
        depressions[code] = down ? () => {
            xTest.fakeKeyEvent(code, false, 0);
        } : null;
        cb(null);
    };
}

function createPause(delay) {
    return (cb) => {
        setTimeout(
            ()=> {
                console.log("Pause");
                cb(null);
            },
            delay
        );
    };
}

var dict = {
    l: createButtonPress(1, true),
    L: createButtonPress(1, false),
    m: createButtonPress(2, true),
    M: createButtonPress(2, false),
    r: createButtonPress(3, true),
    R: createButtonPress(3, false),
    a: createKeyPress("Alt_L", true),
    A: createKeyPress("Alt_L", false),
    g: createKeyPress("Alt_R", true),
    G: createKeyPress("Alt_R", false),
    c: createKeyPress("Control_L", true),
    C: createKeyPress("Control_L", false),
    s: createKeyPress('Shift_L', true),
    S: createKeyPress('Shift_L', false),
    '.': createPause(100)
};

function createAction(symbols) {
    let subactions = symbols.split('').map( (symbol) => dict[symbol]);
    return (cb) => {
        pull(
            pull.values(subactions),
            pull.asyncMap( (f, cb) => {
                // output simple timestamp
                process.stdout.write((Date.now()/1000) + " ");
                f(cb);
            }),
            pull.collect(cb)
        );
    };
}

// returns an array of async functions
function createActions(sentence) {
    return sentence.split('~').map( createAction );
}

module.exports = (sentence) => {
    let actions = createActions(sentence);
    return  pull(
        pcontinue( (i,n) => {
            if (i>=actions.length) return;
            let stream = createClickerStream(actions[i]);
            return stream;
        }),
        pull.asyncMap( (f, cb) => { f(cb); } )
    );
};

module.exports.endDepressions = ()=> {
    for(let key in depressions) {
        let f = depressions[key];
        if (f !== null) f();
        depressions[key] = null;
    }
};
