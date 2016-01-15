'use strict';
var electron = require('electron');

console.log('I am the renderer');

const forEach = (array, func) => [].forEach.call(array, func);

electron.ipcRenderer.on('clicked', ()=>{
    forEach(
        document.querySelectorAll("#clicks button"),
        (button)=>{
            button.setAttribute('data-active', '0');
        }
    );
});

function getModifiers() {
    var modifiers = [];
    [].forEach.call(
        document.querySelectorAll('#modifiers button[data-active="1"]'),
        (button)=>{
            modifiers.push(button.getAttribute('data-symbol'));
        }
    );
    return modifiers;
}

let getButtonSpec = (button) => {
    return {
        buttonIndex: parseInt(button.getAttribute('data-button')),
        count: parseInt(button.getAttribute('data-count') || "1"),
        modifiers: getModifiers()
    };
};

let timer = (() => {
    let timerId;
    return {
        start: (cb) => {
            if (timerId) this.stop(timerId);
            timerId = setTimeout(cb, 2000); // TODO: get from config;
        },

        stop: ()=>{
            clearTimeout(timerId);
        }
    };
})();

let getButtonType = (button) => {
    return (button.getAttribute('data-button')) ? "clicks" : "modifier";
};

forEach(
    document.querySelectorAll("#clicks button,#modifiers button"),
    (button)=>{
        button.addEventListener('mouseenter', function() {
            console.log('mouse enter');
            electron.ipcRenderer.send('clickingAllowed', false);
            timer.start(() => {
                if (getButtonType(button) === 'modifier') {
                    // toggles data-active attribute of modifier buttons
                    console.log('Click modifier');
                    let active = button.getAttribute('data-active');
                    active = {0:1, 1:0}[active || 0];
                    button.setAttribute('data-active', active);
                } else {
                    button.setAttribute('data-active', '1');
                    console.log(getButtonSpec(button));
                    electron.ipcRenderer.send(
                        'buttonPressed',
                        getButtonSpec(button)
                    );
                }
            });
        });
        button.addEventListener('mouseleave', function() {
            console.log('mouse leave');
            electron.ipcRenderer.send('clickingAllowed', true);
            timer.stop();
        });
    }
);
