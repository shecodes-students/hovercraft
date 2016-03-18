/* jshint -W064, -W104, -W119, -W097, -W067 */
/* jshint node: true */
"use strict";

const pull = require('pull-stream');
const equal = require('deep-equal');

module.exports = (eatFirst)=> {
    // filter state transitions
    return pull.filter( (()=>{
        let oldState;
        return (newState)=>{
            let transition = !equal(oldState, newState);
            if (eatFirst && typeof(oldState) === 'undefined') {
                transition = false;
            }
            oldState = newState;
            return transition;
        };
    })());
};

