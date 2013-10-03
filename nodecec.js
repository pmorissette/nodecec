var EventEmitter = require('events').EventEmitter;
var spawn = require('child_process').spawn;
var byline = require('byline');

// NodeCEC object
function NodeCEC(args) {
    if(false === (this instanceof NodeCEC)) {
        return new NodeCEC(args);
    }
    this.args = args;
    EventEmitter.call(this);
}

// inherit from EventEmitter
NodeCEC.prototype.__proto__ = EventEmitter.prototype;

// ========================
// PUBLIC API 
// ========================

// start NodeCEC server
NodeCEC.prototype.start = function() {
    this.client = spawn('cec-client');

    this.stdout = byline(this.client.stdout);
    this.stderr = byline(this.client.stderr);
    this.stdin = this.client.stdin;

    var that = this;

    this.stdout.on('data', function(data) {
        that.handleData(data);
    });

    this.stderr.on('data', function(data) {

        that.handleError(data);
    });

    this.client.on('close', function(code) {
        that.emit('close', code);
        that.ready = false;
        that.client = null;
    });
    
    this.client.on('error', function(err) {
    	that.handleError(err);
    });
}

// stop NodeCEC server
NodeCEC.prototype.stop = function(callback) {
    // if client is null nothing to do
    if (!this.client) {
        callback(null);
    }

    // if we are ready to send then send quit command
    if (this.ready) {
        this.send('q');
        callback(null);
    } else {
        callback('cec-client not ready. Could not terminate');
    }
}

// send command
NodeCEC.prototype.send = function(command) {
    this.stdin.write(command);
}

// ========================
// PUBLIC API END
// ========================


// handle data from stdout
NodeCEC.prototype.handleData = function(data) {
    var line = data.toString();
    //console.log(line);

    if (line == 'waiting for input') {
        // means cec-client is up and running
        // set ready flag
        this.ready = true;
        this.emit('ready', this);
    } else if (line.indexOf('power status changed') > -1) {
        // power status changed
        var id = line.match(/\((\w+)\)/)[1];
        // save id for potential use later
        this.id = id;

        var statuses = line.match(/'(\w+)'/g);
        var from = statuses[0];
        var to = statuses[1];

        // save status for later use
        this.status = to;

        // emit status update event
        this.emit('status', { id: id, from: from, to: to });
    } else if (line.indexOf('key released') > -1) {
        // generic key press
        var key = line.match(/key released:([\w\s]+)/)[1].trim();
        var code = line.match(/\((\w+)\)/)[1];
        this.emit('key', { code: code, name: key });
    } else if (line.indexOf('play') > -1) {
        this.emit('key', { code: 41, name: 'play' });
    } else if (line.indexOf('deck control') > -1) {
        this.emit('key', { code: 42, name: 'stop' });
    }
}

// handles stderr data
NodeCEC.prototype.handleError = function(data) {
    this.emit('error', data);
};

module.exports = NodeCEC;
