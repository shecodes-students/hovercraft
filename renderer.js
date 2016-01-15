'use strict';
var electron = require('electron');

console.log('I am the renderer');

const forEach = (array, func) => [].forEach.call(array, func);


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

// add handler that toggles data-active attribute of modifier buttons
forEach(
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

forEach(
    document.querySelectorAll("#clicks button"),
    (button)=>{
        button.addEventListener('click', function() {
            console.log('Click');
            let buttonSpec = {
                buttonIndex: button.getAttribute('data-button'),
                count: button.getAttribute('data-count') || 1,
                modifiers: getModifiers()
            };
            electron.ipcRenderer.send('buttonPressed', buttonSpec);
        });
    }
); 

