const {app, BrowserWindow, ipcMain} = require('electron');
const SourceQuery = require('source-server-query');
const MasterStream = require('./MasterStream');

const master = new MasterStream();

function parseAddress(addr) {
    let [ip, port] = addr.split(':');
    port = Number(port);
    if (!ip || !port) throw new Error('failed to parse address: ' + addr);
    return {ip, port};
}

async function getServerInfo(addr) {
    try {
        const {ip, port} = parseAddress(addr);
        const start = Date.now();
        const info = await SourceQuery.info(ip, port);
        const end = Date.now();
        const ping = end - start;
        // returns an empty object if it fails for some reason
        if (Object.keys(info).length === 0) return null;
        return {ip, port, ping, info};
    } catch (err) {
        return null;
    }
}

let win = null;
let servers = [];
let request_stop = false;

master.listen(batch => {
    servers = servers.concat(batch);
});

// SourceQuery is limited to serial requests, one-by-one...
master.finished(async () => {
    for (const ip of servers) {
        const info = await getServerInfo(ip);
        if (request_stop) break;
        if (info) win.webContents.send('server-response', info);
    }
    win.webContents.send('finished');
});

ipcMain.on('stop', (event, ...args) => {
    request_stop = true;
    master.stop();
});

ipcMain.on('query-master', (event, ...args) => {
    servers = [];
    request_stop = false;
    master.start();
});

function createWindow() {
    win = new BrowserWindow({width: 800, height: 600, webPreferences: {nodeIntegration: true}});

    // and load the index.html of the app.
    win.loadFile('index.html');

    // Open the DevTools.
    // win.webContents.openDevTools()

    // Emitted when the window is closed.
    win.on('closed', () => {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        win = null;
    });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit();
    }

    master.close();
    SourceQuery.destroy();
})

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (win === null) {
        createWindow();
    }
});
