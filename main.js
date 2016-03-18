/* jshint -W064, -W104, -W119, -W097, -W067 */
/* jshint node: true */

// this is a change
//
'use strict';
const xTest = require('node-xtest-bindings')();
const electron = require('electron');
const app = electron.app;  // Module to control application life.
const BrowserWindow = electron.BrowserWindow;  // Module to create native browser window.
const pull = require('pull-stream');
const generate = require('pull-generate');
const xtend = require('xtend');
const path = require('path');
const fs = require('fs');
const equal = require('deep-equal');

const pcontinue = require('pull-continue');

const pullMouse = (screen, name)=> {
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

const pullChanged = (eatFirst)=> {
    // filter state transitions
    return pull.filter( (()=>{
        let oldState;
        return (newState)=>{
            let transition = !equal(oldState, newState);
            if (eatFirst && typeof(oldState) === 'undefined') {
                transition = false;
                console.log('filtering this one out because');
            }
            oldState = newState;
            return transition;
        };
    })());
};

let conf = require('rc')("hovercraft", {
    width: 160, 
    height: 470,
    x: 20,
    y: 20,
    precisionThresholdPx: {min:0, max:0.1, curr: 0.05},
    jitterWindow: {min: 1, max: 240, curr: 80},
    waitingTime: {min: 100, max: 5000, curr: 2000} 
});

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
let bounds;

// Quit when all windows are closed.
app.on('window-all-closed', function() {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform != 'darwin') {
        app.quit();
    }
});

app.on('ready', function() {
    // Create the browser window.
    let usedConfig = xtend({
        //type: "notification",
        minWidth: 80,
        minHeight: 200,
        resizable: true,
        movable: true,
        //alwaysOnTop: true,
        skipTaskbar: false,
        title: "Hovercraft",
        autoHideMenuBar: true,
        webPreferences: {
            webgl: false,
            webaudio: false
        }
    },
        conf
    );
    mainWindow = new BrowserWindow(
        usedConfig
    );
    bounds = mainWindow.getBounds();

    let abortable = null;
    let abort = () => {
        if (abortable) {
            abortable.abort();
            abortable = null;
        }
    };

    let currButtonSpec = null;
    electron.ipcMain.on('buttonPressed', (event, buttonSpec) => {
        console.log('button activate', buttonSpec);
        currButtonSpec = buttonSpec;
    });

    let createClickerStream = (buttonSpec) => {
        console.log('createClickerStream', buttonSpec);
        if (!buttonSpec) return;
        const jitterWindow = conf.jitterWindow.curr;
        return pull(
            pullMouse(electron.screen, 'clicker'),
            // sliding-window de-jitter
            pull.asyncMap( ( ()=> {
                let values = [];
                return (value, cb) => {
                    values.unshift(value);
                    if (values.length < jitterWindow) {
                        return cb(null, undefined);
                    }
                    pull(
                        pull.values(values),
                        pull.reduce((a,b)=>{return {x:a.x+b.x, y:a.y+b.y};}, {x:0, y:0}, (err, sum)=> {
                            values.pop();
                            cb(err, {x: sum.x / jitterWindow, y: sum.y / jitterWindow});
                        })
                    );
                };
            })()),


            // map position to distance
            pull.map( (() => {
                let previousPosition;
                return (currentPosition)=> {
                    if (previousPosition) {
                        let distanceX = currentPosition.x - previousPosition.x;
                        let distanceY = currentPosition.y - previousPosition.y;
                        previousPosition = currentPosition;
                        return Math.sqrt(Math.pow(distanceX,2) + Math.pow(distanceY,2));
                    }
                    previousPosition = currentPosition;
                    return undefined;
                };
            })()),

            // map distance to isResting
            pull.map( (distance)=> {
                if (typeof(distance) === 'undefined') {
                    console.log('undefined comparison');
                    return undefined;
                }
                return distance < conf.precisionThresholdPx.curr;
            } ),
            pullChanged(true),
            pull.asyncMap(( () => { 
                let timer = null;
                let itsOver = false;
                return (resting, cb) => {
                    console.log("resting: " + resting);
                    if (typeof(resting) === 'undefined') return cb(null, null);
                    if (itsOver)  return cb(true);
                    if (resting) {
                        if (timer) clearTimeout(timer);
                        timer = setTimeout( ()=>{
                            itsOver = true;
                            cb(null, buttonSpec);
                        }, conf.waitingTime.curr); 
                    } else {
                        clearTimeout(timer);
                        cb(null, null);
                    }
                };
            })()),
            pull.filter( (x) => {return x !== null;} )
        );
    };

    const createActionSequence = (buttonSpec) => {
        abortable = pull.drain( (buttonSpec) => {
            buttonClick(buttonSpec);
        }, (err) => {
            console.log('drain ended with err', err);
        });
        pull(
            pcontinue( (i,n) => {
                if (i>2) return;
                let stream = createClickerStream(buttonSpec);
                return stream;
            }),
            abortable
        );
    };

    
    pull(
        pullMouse(electron.screen, 'position'),
        pull.map( (pos) => { 
            return { 
                x: pos.x - bounds.x,
                y: pos.y - bounds.y
            };
        }
        ),
        pull.map( ( () => { // map pos to whether we hover above the UI (boolean)
            let wasAlreadyTouched = false;
            return (pos)=> {
                let touched = pos.x >= 0 && pos.y >= 0 &&
                    pos.x < bounds.width && pos.y < bounds.height;

                if (touched && !wasAlreadyTouched) {
                    console.log('enter UI');
                    abort();
                } else if (!touched && wasAlreadyTouched) {
                    // leaving the UI, we can now start our clickerstream
                    // if we have any active click buttons
                    console.log('leave UI');
                    if (currButtonSpec) {
                        abort();
                        createActionSequence(currButtonSpec);
                        currButtonSpec = null;
                    }
                }
                wasAlreadyTouched = touched;
                return touched ? pos : {x: null, y: null};
            };
        })()),
        pullChanged(false),
        pull.map( (pos)=>{ 
            if (pos.x === null) {
                return {name: "mouseleave"};
            } else {
                return {name:"mousemove", position: pos};
            }
        }),
        pull.drain( (event)=> {
            if (mainWindow) 
                mainWindow.webContents.send(event.name, event.position);
        })
    );

    let updateConfig = (type, data)=> {
        let home = process.env.HOME;
        let filename = path.join(home, '.hovercraftrc'); 
        let settings;
        try {
            settings = fs.readFileSync(filename);
        } catch (e) {
            settings = "{}";
        }
        try {
            settings = JSON.parse(settings);
            switch(type) {
                case 'configUpdate':
                    if (!settings.hasOwnProperty(data.name)) {
                        settings[data.name]={};
                    }
                    settings[data.name].curr = data.value;

                    if (!conf.hasOwnProperty(data.name)) {
                        conf[data.name]={};
                    }
                    conf[data.name].curr = data.value;
                    break;
                case 'resize':
                case 'move':
                    settings = xtend(settings, mainWindow.getBounds());
                    break;
            }
            settings = JSON.stringify(settings);
            fs.writeFileSync(filename, settings);
        } catch (e) {
            console.log('Unable to write settings: ' + e.message);
        }
        bounds = mainWindow.getBounds();
    };


    mainWindow.webContents.on('dom-ready', () => {
        mainWindow.setAlwaysOnTop(true);
        //send config values
        mainWindow.webContents.send('config', conf);
    });

    mainWindow.on('resize', () => {updateConfig('resize');});
    mainWindow.on('move', () => {updateConfig('move');});

    electron.ipcMain.on('configUpdate', (event, data) => {updateConfig('configUpdate', data);});

    // and load the index.html of the app.
    mainWindow.loadURL('file://' + __dirname + '/index.html');

    function buttonClick(buttonSpec) {
        for (let sym of buttonSpec.modifiers) {
            let code = xTest.keySyms["XK_"+sym];
            console.log(sym, code);
            xTest.fakeKeyEvent(code, true, 0);
        }

        for(let n=0; n<buttonSpec.count; ++n) {
            xTest.fakeButtonEvent(buttonSpec.buttonIndex, true, 0);
            xTest.fakeButtonEvent(buttonSpec.buttonIndex, false, 0);
        }

        for (let sym of buttonSpec.modifiers) {
            let code = xTest.keySyms["XK_"+sym];
            xTest.fakeKeyEvent(code, false, 0);
        }

        mainWindow.webContents.send('clicked');
    }

// Emitted when the window is closed.
mainWindow.on('closed', function() {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
});
});
