// jshint: -w104, esnext
'use strict';
const xTest = require('../node-xtest-bindings/index')();
const electron = require('electron');
const app = electron.app;  // Module to control application life.
const BrowserWindow = electron.BrowserWindow;  // Module to create native browser window.
const pull = require('pull-stream');
const generate = require('pull-generate');

// Config section
const precisionThresholdPx = 0.05;
const jitterWindow = 80;
const waitingTime = 2000; 

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
    mainWindow = new BrowserWindow({width: 800, height: 600});

    // and load the index.html of the app.
    mainWindow.loadURL('file://' + __dirname + '/index.html');
    let screen = electron.screen;

    electron.ipcMain.on('buttonPressed', (event, msg) => {
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
                    timer = setTimeout(buttonClick, waitingTime); 
                } else {
                    clearTimeout(timer);
                }
            })
        );
    });

    function buttonClick() {
        let shift = xTest.keySyms.XK_Shift_L;
        xTest.fakeKeyEvent(shift, true, 0);
        xTest.fakeButtonEvent(1, true, 0);
        xTest.fakeButtonEvent(1, false, 0);
        xTest.fakeKeyEvent(shift, false, 0);
    }

// Emitted when the window is closed.
mainWindow.on('closed', function() {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
});
});
