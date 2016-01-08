var electron = require('electron');

console.log('I am the renderer');
document.getElementById("Shift_L").addEventListener('click', function() {
    console.log('Click');
    electron.ipcRenderer.send('buttonPressed', 'Shift_L');
});


