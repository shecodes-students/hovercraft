/* jshint -W064, -W104, -W119, -W097, -W067 */
/* jshint node: true */
"use strict";
const conf = require('./conf');
const pull = require('pull-stream');
const electron = require('electron');
const pullMouse = require('./pullMouse');
const pullChanged = require('./pullChanged');

module.exports = (sentence) => {
    const jitterWindow = conf.jitterWindow.curr;
    return pull(
        pullMouse(electron.screen),
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
                return undefined;
            }
            return distance < conf.precisionThresholdPx.curr;
        }),
        pullChanged(true),
        pull.asyncMap(( () => {
            let timer = null;
            let itsOver = false;
            return (resting, cb) => {
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
