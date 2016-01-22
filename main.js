/* jshint -W104, -W119, -W097, -W067 */
/* jshint node: true */

'use strict';
const xTest = require('../node-xtest-bindings/index')();
const electron = require('electron');
const app = electron.app;  // Module to control application life.
const BrowserWindow = electron.BrowserWindow;  // Module to create native browser window.
const pull = require('pull-stream');
const generate = require('pull-generate');
const xtend = require('xtend');
const path = require('path');
const fs = require('fs');

let conf = require('rc')("hovercraft", {
    width: 160, 
    height: 470,
    x: 20,
    y: 20,
    precisionThresholdPx: {min:0, max:0.1, curr: 0.05},
    jitterWindow: {min: 1, max: 240, curr: 80},
    waitingTime: {min: 100, max: 5000, curr: 2000} 
});

// Config section
let precisionThresholdPx = conf.precisionThresholdPx.curr;
let jitterWindow = conf.jitterWindow.curr;
let waitingTime = conf.waitingTime.curr;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

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
    mainWindow = new BrowserWindow(
        xtend({
            minWidth: 80,
            minHeight: 200,
            resizable: true,
            movable: true,
            alwaysOnTop: true,
            skipTaskbar: false,
            title: "Hovercraft",
            autoHideMenuBar: true,
            webPreferences: {
                webgl: false,
                webaudio: false
            }
        },
            conf
        )
    );

    let saveBounds = ()=> {
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
            settings = xtend(settings, mainWindow.getBounds());
            settings = JSON.stringify(settings);
            fs.writeFileSync(filename, settings);
        } catch (e) {
            console.log('Unable to write settings: ' + e.message);
        }
    };
    mainWindow.on('resize', saveBounds);
    mainWindow.on('move', saveBounds);

    // and load the index.html of the app.
    mainWindow.loadURL('file://' + __dirname + '/index.html');
    let screen = electron.screen;
    let clickingAllowed = true;

    electron.ipcMain.on('clickingAllowed', (event, state) => {
        clickingAllowed = state;
    });

    electron.ipcMain.on('buttonPressed', (event, buttonSpec) => {
        pull(
            generate(0, (state, cb)=> {
                setTimeout( ()=> {
                    cb(null, screen.getCursorScreenPoint());
                }, 5);
            }), 

            // sliding-window de-jitter
            pull.asyncMap( ( ()=> {
                let values = [];
                return (value, cb) => {
                    values.unshift(value);
                    //console.log(value);
                    //console.log(values.length);
                    if (values.length < jitterWindow) {
                        return cb(null, undefined);
                    }
                    pull(
                        pull.values(values),
                        pull.reduce((a,b)=>{return {x:a.x+b.x, y:a.y+b.y};}, {x:0, y:0}, (err, sum)=> {
                            values.pop();
                            //console.log(values);
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
                //console.log(distance);
                return distance < precisionThresholdPx;
            } ),

            // filter state transitions
            pull.filter( (()=>{
                let oldState;
                return (newState)=>{
                    let transition = oldState !== newState;
                    oldState = newState;
                    return transition;
                };
            })()),

            pull.drain((resting)=> {
                let timer;
                if (resting) {
                    timer = setTimeout( ()=>{
                        if (clickingAllowed) {
                            buttonClick(buttonSpec);
                        }
                    }, waitingTime); 
                    return false;
                } else {
                    clearTimeout(timer);
                }
            })
        );
    });

    function buttonClick(buttonSpec) {
        for (let sym of buttonSpec.modifiers) {
            let code = xTest.keySyms["XK_"+sym];
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
