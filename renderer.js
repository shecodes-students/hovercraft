'use strict';
var electron = require('electron');

console.log('I am the renderer');

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

[].forEach.call(
    document.querySelectorAll("#modifiers button"),
    (button)=>{
        button.addEventListener('click', function() {
            console.log('Click modifier');
            let active = button.getAttribute('data-active');
            active = !active;
            button.setAttribute('data-active', active ? "1" : "0");
        });
    }
); 

[].forEach.call(
    document.querySelectorAll("#clicks button"),
    (button)=>{
        button.addEventListener('click', function() {
            console.log('Click');
            electron.ipcRenderer.send('buttonPressed', button.getAttribute('data-button'), getModifiers());
        });
    }
); 



