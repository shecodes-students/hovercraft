'use strict';
var nativeModule = require('../node-native-boilerplate/index');
const electron = require('electron');
const app = electron.app;  // Module to control application life.
const BrowserWindow = electron.BrowserWindow;  // Module to create native browser window.

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

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', function() {
    // Create the browser window.
    mainWindow = new BrowserWindow({width: 800, height: 600});

    // and load the index.html of the app.
    mainWindow.loadURL('file://' + __dirname + '/index.html');
    var screen = electron.screen;
    var previousPosition = undefined;
    var currentPosition = undefined;
    var stoppingStarted = undefined;
    var clicked = false;

    var precisionThresholdPx = 10;
    var waitingTime = 2000; 
    setInterval(pollCursor, 1000, waitingTime, precisionThresholdPx);

    function pollCursor() {
        currentPosition = screen.getCursorScreenPoint();
        if (!previousPosition) {
            previousPosition = currentPosition;
        }
        var distance = getDistance();
        if (distance < precisionThresholdPx ) {
            if (!stoppingStarted) {
                stoppingStarted = Date.now();
            }
            var timePassed = Date.now() - stoppingStarted; 
            if (timePassed >= waitingTime && !clicked) {
                pressA();
            }
        } else {
            clicked = false;
        }
        previousPosition = currentPosition;
    }

    function pressA() {
        var f = nativeModule.MyObject();
        f.fakeKeyEvent(65, true, 0);
        f.fakeKeyEvent(65, false, 0);
        clicked = true;
        stoppingStarted = undefined;
    }

    function getDistance() {
        var distanceX = currentPosition.x - previousPosition.x;
        var distanceY = currentPosition.y - previousPosition.y;
        var distance = Math.sqrt(Math.pow(distanceX,2) + Math.pow(distanceY,2));
        return distance;
    }

// Emitted when the window is closed.
mainWindow.on('closed', function() {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
});
});
