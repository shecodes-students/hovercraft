/* jshint -W064, -W104, -W119, -W097, -W067 */
/* jshint node: true */

function createButtonPress(buttonIndex, down) {
    return (cb) => {
        xTest.fakeButtonEvent(buttonIndex, down, 0);
        cb(null);
    };
}

function createKeyPress(keySymbol, down) {
    let code = xTest.keySyms["XK_"+sym];
    return (cb) => {
        xTest.fakeKeyEvent(code, down, 0);
        cb(null);
    };
}

function createPause(delay) {
    return (cb) => {
        setTimeout(
            ()=> {
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
    S: createKeyPress('_Shift_L', false),
    '.': createPause(100)
};

function createAction(symbols) {
    let subactions = symbols.split('').map( (symbol) => dict[symbol]);
    return (cb) => {
        pull(
            pull.values(subactions),
            pull.asyncMap( (f, cb) => {
                f(cb);
            }),
            pull.collect(cb)
        );
    };
}

function createActions(sentence) {
    return sentence.split('~').map((section) => {
        createAction(section);
    });
}

module.exports = (sentence) => {
    let actions = createActions(sentence);
    return  pull(
        pcontinue( (i,n) => {
            if (i>=actions.length) return;
            let stream = createClickerStream(actions[i]);
            return stream;
        }),
        pull.asyncMap( (f, cb) => { f(cb); } ),
        abortable
    );
};
