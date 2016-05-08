/* jshint -W064, -W104, -W119, -W097, -W067 */
/* jshint node: true */

'use strict';
const electron = require('electron');
const app = electron.app;  // Module to control application life.
const BrowserWindow = electron.BrowserWindow;  // Module to create native browser window.
const pull = require('pull-stream');
const generate = require('pull-generate');
const xtend = require('xtend');
const path = require('path');
const fs = require('fs');
const performInputActions = require('./actions');
const conf = require('./conf');
const pullMouse = require('./pullMouse');
const pullChanged = require('./pullChanged');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
let bounds;

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
    conf);
    mainWindow = new BrowserWindow(usedConfig);
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
        currSentence = sentence;
    });

    const createActionSequence = (sentence) => {
        abortable = pull.drain( () => {
            currSentence = null;
            mainWindow.webContents.send('clicked');
        }, (err) => {
            performInputActions.endDepressions();
            console.log('sequence ended with err', err);
        });

        pull(
            performInputActions(sentence),
            abortable
        );
    };

    pull(
        pullMouse(electron.screen),
        pull.map( (pos) => {
            return {
                x: pos.x - bounds.x,
                y: pos.y - bounds.y
            };
        }),
        // map pos to whether we hover above the UI (boolean)
        pull.map( ( () => {
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
            if (mainWindow) {
                mainWindow.webContents.send(event.name, event.position);
            }
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
