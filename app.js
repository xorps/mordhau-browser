const { ipcRenderer } = require('electron');
const ServerTable = document.getElementById("server-table");
const Stop = document.getElementById("stop");
const Refresh = document.getElementById("refresh");
const ErrorContainer = document.getElementById("error");
const Ping = document.getElementById("ping");
const Name = document.getElementById("name");

const SortByPlayer = Symbol();
const SortByName = Symbol();

const Sorting = {};
Sorting[SortByPlayer] = (server, node) => server.info.playersnum > node.childNodes[1].dataset.players;
Sorting[SortByName] = (server, node) => server.info.name > node.childNodes[0].textContent;

Stop.addEventListener("click", () => {
    hideError();
    ipcRenderer.send("stop")
});

Refresh.addEventListener("click", () => {
    if (Refresh.hasAttribute('disabled')) return;
    hideError();
    hideServers();
    Refresh.setAttribute('disabled', 'disabled');
    Refresh.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>    Loading...';
    ipcRenderer.send("query-master");
});

Ping.addEventListener("click", () => {

});

ipcRenderer.on("finished", (event, ...args) => {
    Refresh.removeAttribute('disabled');
    Refresh.innerHTML = 'Refresh';
});

function hideServers() {
    ServerTable.parentElement.style.setProperty('display', 'none');
    ServerTable.innerHTML = "";
}

function ensureVisible() {
    hideError();
    if (ServerTable.parentElement.style.display == "none") {
        ServerTable.parentElement.style.removeProperty('display');
    }
}

function showError(err) {
    ErrorContainer.innerText = "Error: " + err.toString();
    ErrorContainer.style.removeProperty('display');
}

function hideError() {
    if (ErrorContainer.style.display != "none") {
        ErrorContainer.style.setProperty('display', 'none');
    }
}

function insert(tr, cmp) {
    for (let iter = ServerTable.firstChild; iter; iter = iter.nextSibling) {
        // some siblings we get empty text nodes
        // so we check for TR
        if (iter.tagName == 'TR' && cmp(iter)) {
            ensureVisible();
            ServerTable.insertBefore(tr, iter);
            return;
        }
    }
    ensureVisible();
    ServerTable.appendChild(tr);
}

ipcRenderer.on("error", (event, err) => {
    showError(err);
    console.log(err);
});

ipcRenderer.on("server-response", (event, server) => {
    const name = server.info.name;
    const players = "(" + server.info.playersnum + "/" + server.info.maxplayers + ")";
    const map = server.info.map;
    const ping = server.ping;
    const tr = document.createElement("tr");
    tr.innerHTML = "<td>" + name + "</td><td data-players='" + server.info.playersnum + "'>" + players + "</td><td>" + map + "</td><td>" + ping + "</td>";

    function PlayerSort(node) {
        return server.info.playersnum > node.childNodes[1].dataset.players;
    }

    insert(tr, PlayerSort);
});
