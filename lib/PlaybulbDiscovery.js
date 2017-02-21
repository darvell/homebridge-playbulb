var noble = require('noble');

var DISCOVER_SERVICE_TYPES = ['ff02'];

class PlaybulbDiscovery {
    constructor() {
        this.connectionCallbacks = {};

        noble.on('stateChange', this.nobleStateChange.bind(this));
        noble.on('discover', this.bulbDiscovered.bind(this));

        this.initiateScanning();
    }

    onAddressConnected(address, callback) {
        this.connectionCallbacks[address] = callback;
    }

    initiateScanning() {
        if (noble.state === "poweredOn") {
            console.log("Starting BLE Scanning");

            noble.on('scanStop', function() {
                setTimeout(() => {
                    console.log("Restarting BLE Scanning");

                    noble.startScanning(DISCOVER_SERVICE_TYPES, true, (error) => {
                        if (error) {
                            console.log("BLE Scanning Error", error);
                        }
                    });
                }, 2500);
            });

            noble.startScanning(DISCOVER_SERVICE_TYPES, false);
        }
    }

    nobleStateChange(state) {
        console.log("BT State ->", state);

        if (state !== 'poweredOn') {
            console.log("Stopped scanning");
            noble.stopScanning();
        }

        this.initiateScanning();
    }

    bulbDiscovered(bulb) {
        var address = bulb.address;

        if (this.connectionCallbacks[address]) {
            console.log("Discovered Playbulb, connecting", address);

            bulb.connect(function(error) {
                this.bulbConnected(error, bulb);
            }.bind(this));
        } else {
            console.log("Discovered Playbulb, uninterested", address);
        }
    }

    bulbConnected(error, bulb) {
        if (error) {
            console.log("Failed to connect to candle on address " + bulb.address + ": " + error);
            return;
        }

        var address = bulb.address;
        console.log("Connected to Playbulb", address);

        var callback = this.connectionCallbacks[address];

        if (callback && !error) {
            callback(bulb);
            delete this.connectionCallbacks[address];
        }
    }
}

module.exports = new PlaybulbDiscovery;
