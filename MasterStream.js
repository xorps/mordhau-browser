const dgram = require('dgram');
const {EventEmitter} = require('events');

const MASTER_HOSTNAME = 'hl2master.steampowered.com';
const MASTER_PORT = 27011;
const MORDHAU_APPID = 629760;
const ZERO_IP = '0.0.0.0:0';
const RESPONSE_HEADER = Buffer.from("\xFF\xFF\xFF\xFF\x66\x0A", 'ascii');
const Stop = Symbol();
const Continue = Symbol();

function message(IP) {
    const NUL = "\x00";
    const MessageType = "\x31";
    const RegionCode = "\xFF";
    const Filter = "\\appid\\" + MORDHAU_APPID;
    const msg = MessageType + RegionCode + IP + NUL + Filter + NUL;
    return Buffer.from(msg, 'ascii');
}

function read(buf) {
    if (buf.compare(RESPONSE_HEADER, 0, 6, 0, 6) !== 0) {
        console.log(buf);
        throw new UnexpectedHeaderError();
    }
    const ips = [];
    for (let i = 6; i < buf.length; i += 6) {
        const ip = [0, 1, 2, 3].map(o => buf.readUInt8(o + i).toString()).join('.');
        const port = buf.readUInt16BE(i + 4);
        const host = ip + ':' + port;
        if (host === ZERO_IP) return [ips, Stop];
        ips.push(host);
    }
    return [ips, Continue];
}

function sleep(time) {
    return new Promise((resolve, reject) => {
        setTimeout(() => resolve(), time);
    });
}

function last(arr) {
    if (arr.length === 0) throw new Error('Cannot get tail of empty array');
    return arr[arr.length - 1];
}

class MasterStream {
    constructor() {
        this.socket = dgram.createSocket('udp4');
        this.events = new EventEmitter();
        this.on_message = (buf, r) => {
            const [batch, status] = read(buf);
            if (batch.length > 0) this.events.emit('batch', batch);
            if (status === Continue) {
                const seed = last(batch);
                this.socket.send(message(seed), r.port, r.address);
            } else {
                this.events.emit('done');
            }
        };
    }
    listen(handler) {
        this.events.on('batch', handler);
    }
    finished(handler) {
        this.events.on('done', handler);
    }
    stop() {
        this.socket.off('message', this.on_message);
        this.events.emit('done');
    }
    start() {
        this.socket.on('message', this.on_message);
        this.socket.send(message(ZERO_IP), MASTER_PORT, MASTER_HOSTNAME);
    }
    close() {
        this.socket.close();
        this.socket = null;
    }
}

module.exports = MasterStream;