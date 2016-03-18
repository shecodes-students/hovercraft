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
const performInputActions = require('./actions');

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

    let currSentence = null;

    electron.ipcMain.on('buttonPressed', (event, sentence) => {
        console.log('button activate', sentence);
        currSentence = sentence;
    });

    let createClickerStream = (sentence) => {
        console.log('createClickerStream', sentence);
        if (!sentence) return;
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
                                cb(null, sentence);
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

    const createActionSequence = (sentence) => {
        abortable = pull.drain( () => {
            //is this correct here? TODO
            console.log('action performed');
            mainWindow.webContents.send('clicked');
        }, (err) => {
            mainWindow.webContents.send('sequence_ended');
            console.log('sequence ended with err', err);
        });

        pull(
            performInputActions(sentence),
            abortable
        );
    };

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
                if (currSentence) {
                        abort();
                    createActionSequence(currSentence);
                    currSentence = null;
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


// Emitted when the window is closed.
mainWindow.on('closed', function() {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
});
});
