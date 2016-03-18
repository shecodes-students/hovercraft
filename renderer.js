/* jshint -W104, -W119, -W097, -W067 */
/* jshint node: true */
/* jshint browser: true */
'use strict';
var electron = require('electron');

let waitingTime = 2000;

const forEach = (array, func) => [].forEach.call(array, func);


document.querySelector('#settings').addEventListener('click', ()=> {
    let infoSection = document.querySelector('#info');
    infoSection.style.display = {"none": "block", "block": "none"}[infoSection.style.display || "none"];
});

let format=(value)=>{
    return Math.floor(value*10000)/10000;
};

forEach(
    document.querySelectorAll('input[type="range"]'),
    (slider)=>{
        let name = slider.name;
        let span = slider.parentElement.querySelector('span[name="' + name + '"]');
        slider.addEventListener('input', (event) => {
            let value = slider.value;
            span.innerHTML = "(" + format(value) + ")";
        });
        slider.addEventListener('change', (event) => {
            if (name === "waitingTime") {
                waitingTime = slider.value;
            }
            let value = slider.value;
            let configUpdate = {name: name, value: value};
            electron.ipcRenderer.send('configUpdate', configUpdate);
        });
    }
);

const fireEvent = (el, eventName) => {
    forEach(el.myListeners || [], (l)=> {
        if (eventName === l.name) {
            l.handler();
        }
    });
};


let currentButton = null;
electron.ipcRenderer.on('mousemove', (event, pos) => {
    let el = document.elementFromPoint(pos.x, pos.y);
    while(el !== null && el.tagName !== 'BUTTON') el = el.parentElement;
    if (currentButton != el) {
        if (currentButton) {
            fireEvent(currentButton, "mouseleave");
            currentButton.classList.remove('hover');
        }
        if (el) {
            fireEvent(el, "mouseenter");
            el.classList.add('hover');
        } 
        currentButton = el;
    }
});

electron.ipcRenderer.on('mouseleave', () => {
    document.body.style.backgroundColor=null;
    if (currentButton) {
        fireEvent(currentButton, "mouseleave");
        currentButton.classList.remove('hover');
        currentButton = null;
    }
});

electron.ipcRenderer.on('config', (event, config) => {
    waitingTime = config.waitingTime.curr;
    forEach(
        document.querySelectorAll('input[type="range"]'),
        (slider)=>{
            let name = slider.getAttribute('name');
            let value = config[name].curr;
            slider.min = config[name].min;
            slider.max = config[name].max;
            slider.value = value;
            let span = slider.parentElement.querySelector('span[name="' + name + '"]');
            span.innerHTML = "(" + format(value) + ")";
        }
    );
});
        

let deactivateOtherClickButtons = () => {
    forEach(
        document.querySelectorAll("#clicks button"),
        (button)=>{
            button.setAttribute('data-active', '0');
        }
    );
};

electron.ipcRenderer.on('clicked', ()=>{
    deactivateOtherClickButtons();
    currentButton = null;
});

electron.ipcRenderer.on('friendly fire', ()=>{
    deactivateOtherClickButtons();
    currentButton = null;
});

function getModifiers() {
    var modifiers = [];
    [].forEach.call(
        document.querySelectorAll('#modifiers button[data-active="1"]'),
        (button)=>{
            modifiers.push(button.getAttribute('data-symbol'));
        }
    );
    return modifiers.join();
}

let getButtonSpec = (button) => {
    let clickSymbols = button.getAttribute('data-symbol');
    let modSymbols = getModifiers();
    return modSymbols + clickSymbols + modSymbols.toUpperCase();
};

let timer = (() => {
    let timerId;
    return {
        start: (cb) => {
            if (timerId) this.stop(timerId);
            timerId = setTimeout(cb, waitingTime);
        },

        stop: ()=>{
            clearTimeout(timerId);
        }
    };
})();

forEach(
    document.querySelectorAll("#clicks button,#modifiers button"),
    (button)=>{
        button.addMyEventListener = (name, handler)=>{
            let l = button.myListeners || [];
            l.push({name, handler});
            button.myListeners = l;
        };
    }
);

forEach(
    ['clicks', 'modfiers'],
    (section) => {
        forEach(
            document.querySelectorAll("#" + section + " button"),
            (button)=>{
                button.addMyEventListener('mouseenter', () => {
                    timer.start(() => {
                        if (section === 'modifiers') {
                            // toggles data-active attribute of modifier buttons
                            let active = button.getAttribute('data-active');
                            active = {0:1, 1:0}[active || 0];
                            button.setAttribute('data-active', active);
                        } else {
                            deactivateOtherClickButtons();
                            button.setAttribute('data-active', '1');
                            electron.ipcRenderer.send('buttonPressed', getButtonSpec(button));
                        }
                    });
                });
                button.addMyEventListener('mouseleave', () => {
                    timer.stop();
                });
            }
        );
    }
);
// testing functionality
document.querySelector('#testButton').addEventListener('mouseup', function(event) {
    console.log(event);
    let keys = "meta alt shift ctrl".split(" ");
    let buttons = "none left middle right".split(" ");
    let info = [];
    for(let key of keys) {
        if (event[key+"Key"]) {
            info.push(key);
        }
    }
    info.push(buttons[event.which]);
    info = info.join(" ");
    document.querySelector("#testOutput").innerHTML = info;
});

