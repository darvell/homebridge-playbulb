var PlaybulbDiscovery = require("./PlaybulbDiscovery.js");
var Color = require("color");

var Accessory, Characteristic, Service;

class PlaybulbAccessory {
    constructor(log, config) {
        this.log = log;

        //Configuration
        this.name = config["name"];
        this.address = config["address"];

        //Bluetooth Connection
        this.bulb = null;
        this.connected = false;

        //HomeKit Characteristic State
        this.on = false;
        this.hue = 0;
        this.saturation = 0;
        this.brightness = 0;

        this.updateTimer = setTimeout(this.update.bind(this), 100);
        this.transIterations = 0;

        this.configureServices();

        PlaybulbDiscovery.onAddressConnected(this.address, this.bulbConnected.bind(this));
    }

    static setHomebridge(homebridge) {
        Accessory = homebridge.platformAccessory;
        Service = homebridge.hap.Service;
        Characteristic = homebridge.hap.Characteristic;
    }

    configureServices() {
        var service = (this.service = new Service.Lightbulb(this.name));
        service.getCharacteristic(Characteristic.On).on("get", this.getPower.bind(this));
        service.getCharacteristic(Characteristic.On).on("set", this.setPower.bind(this));
        service.addCharacteristic(Characteristic.Brightness).on("get", this.getBrightness.bind(this));
        service.getCharacteristic(Characteristic.Brightness).on("set", this.setBrightness.bind(this));
        service.addCharacteristic(Characteristic.Hue).on("get", this.getHue.bind(this));
        service.getCharacteristic(Characteristic.Hue).on("set", this.setHue.bind(this));
        service.addCharacteristic(Characteristic.Saturation).on("get", this.getSaturation.bind(this));
        service.getCharacteristic(Characteristic.Saturation).on("set", this.setSaturation.bind(this));

        var infoService = (this.infoService = new Service.AccessoryInformation());
        infoService.setCharacteristic(Characteristic.Manufacturer, "Mipow");
        infoService.setCharacteristic(Characteristic.Model, "Playbulb Rainbow");
        infoService.setCharacteristic(Characteristic.SerialNumber, this.address);
    }

    getServices() {
        return [this.service, this.infoService];
    }

    update() {
        if (this.bulb === undefined || this.bulb == null || !this.connected) {
            setTimeout(this.update.bind(this), 500);
            return;
        }

        this.bulb.readHandle(0x0025, (error, data) => {
            if (error) {
                // Ignore. Guess we won't update our pretty colors.
                setTimeout(this.update.bind(this), 500);
                return;
            }

            var red = data.readUInt8(1);
            var green = data.readUInt8(2);
            var blue = data.readUInt8(3);

            var bulbState = Color({r: red, g: green, b: blue});
            var targetColor = this.getColor();
            if (bulbState.rgbNumber() != targetColor.rgbNumber()) {
                // Move a little towards the new color.
                this.transIterations = this.transIterations + 1;
                var col = bulbState.mix(targetColor, 0.1 * this.transIterations).rgb();
                var buf = Buffer.from([
                    0,
                    Math.round(col.color[0]),
                    Math.round(col.color[1]),
                    Math.round(col.color[2])
                ]);
                this.bulb.writeHandle(0x0025, buf, true, error => {});
                setTimeout(this.update.bind(this), 5);
            } else {
                this.transIterations = 0;
                setTimeout(this.update.bind(this), 500);
            }
        });
    }

    bulbConnected(bulb) {
        this.log("Connected on address " + this.address);
        this.bulb = bulb;
        this.connected = true;
        this.bulb.on("disconnect", this.disconnect.bind(this));
    }

    reconnected() {
        this.log("Playbulb Reconnected", this.address);
        this.connected = true;
    }

    identification(paired, callback) {
        this.log.info("Identify bulb " + this.name);
        callback();
    }

    disconnect(error) {
        this.log("Playbulb Disconnected", this.address);
        this.connected = false;
        setTimeout(() => {
            this.bulb.connect(error => {
                if (!error) {
                    this.reconnected();
                }
            });
        }, 500);
    }
    getPower(callback) {
        callback(null, this.on);
    }

    setPower(value, callback) {
        this.on = value;
        callback(null);
    }

    getHue(callback) {
        callback(null, this.color.hsl().color[0]);
    }

    setHue(value, callback) {
        var hslColor = this.color.hsl();
        hslColor.color[0] = value;
        this.color = hslColor;
        callback(null);
    }

    getSaturation(callback) {
        callback(null, this.color.hsl().color[1]);
    }

    setSaturation(value, callback) {
        var hslColor = this.color.hsl();
        hslColor.color[1] = value;
        this.color = this.hslColor;
        callback(null);
    }

    getBrightness(callback) {
        callback(null, this.color.hsl().color[2]);
    }

    setBrightness(value, callback) {
        var hslColor = this.color.hsl();
        hslColor.color[2] = value;
        this.color = this.hslColor;
        callback(null);
    }

    getColor() {
        return Color().hue(this.hue).saturation(this.saturation).lightness(this.brightness);
    }
}

module.exports = PlaybulbAccessory;
