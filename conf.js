module.exports = require('rc')("hovercraft", {
    width: 160, 
    height: 470,
    x: 20,
    y: 20,
    precisionThresholdPx: {min:0, max:0.1, curr: 0.05},
    jitterWindow: {min: 1, max: 240, curr: 80},
    waitingTime: {min: 100, max: 5000, curr: 2000} 
});
