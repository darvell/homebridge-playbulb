var PlaybulbDiscovery = require("./PlaybulbDiscovery.js");
var colorTransitions = require("color-transitions");
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

        //Timers
        this.writeTimer = null;
        this.timerInterval = null;
        this.timer = 0;

        //HomeKit Characteristic State
        this.on = 0;
        this.color = Color();
        this.internalColor = Color();

        // Internal color transition state
        this.transition = null;

        this.configureServices();

        PlaybulbDiscovery.onAddressConnected(this.address, this.connected.bind(this));
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

        var timerService = (this.timerService = new Service.Timer("Auto Off Timer"));
        timerService.getCharacteristic(Characteristic.Timer).on("get", this.getTimer.bind(this));
        timerService.getCharacteristic(Characteristic.Timer).on("set", this.setTimer.bind(this));

        var infoService = (this.infoService = new Service.AccessoryInformation());
        infoService.setCharacteristic(Characteristic.Manufacturer, "Mipow");
        infoService.setCharacteristic(Characteristic.Model, "Playbulb Rainbow");
        infoService.setCharacteristic(Characteristic.SerialNumber, this.address);
    }

    getServices() {
        return [this.service, this.timerService, this.infoService];
    }

    connected(bulb) {
        this.log("Connected on address " + this.address);

        this.bulb = bulb;
        this.bulb.on("disconnect", this.disconnect.bind(this));

        this.writeColor();
    }

    reconnected() {
        this.log("Playbulb Reconnected", this.address);

        this.writeColor();
    }

    identification(paired, callback) {
        this.log.info("Identify candle " + this.name);
        callback();
    }

    disconnect(error) {
        this.log("Playbulb Disconnected", this.address);

        this.bulbColorCharacteristic = null;

        setTimeout(() => {
            this.bulb.connect(error => {
                if (!error) {
                    this.reconnected();
                }
            });
        }, 1000);
    }

    timerTick() {
        this.timer -= 5;

        //this.log("Timer Tick. Remaining Seconds:", this.timer);

        if (this.timer <= 0) {
            this.service.setCharacteristic(Characteristic.On, 0);

            this.timer = 0;
        }

        this.timerService.setCharacteristic(Characteristic.Timer, this.timer);
    }

    getPower(callback) {
        callback(null, this.on);
    }

    setPower(value, callback) {
        this.on = value;
        callback(null);
    }

    getTimer(callback) {
        callback(null, this.timer);
    }

    setTimer(value, callback) {
        this.timer = value;

        clearInterval(this.timerInterval);

        if (value) {
            this.timerInterval = setInterval(this.timerTick.bind(this), 5000);
        }

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

    writeAndTransition() {
        var rgb = this.color.rgb();
        if (!this.on) {
            rgb = Color({red: 0, blue: 0, green: 0});
        }

        colorTransitions(this.internalColor.rgb().color, rgb.color, {duration: 200}, color => {
            if (this.bulb == null || this.bulb === undefined) {
                return false;
            }

            // Target color changed. End this one.
            if (rgb.rgbNumber() != this.color.rgbNumber()) {
                return false;
            }

            this.internalColor = Color({red: color[0], green: color[1], blue: color[2]}).hsv();
            var buf = Buffer.from([0, color[0], color[1], color[2]]);
            this.bulb.writeHandle(0x0025, buf, true, error => {});
        });
    }

    writeColor() {
        var rgb = this._hsvToRgb(this.hue, this.saturation, this.brightness);
        var buf = Buffer.from([0, rgb.R, rgb.G, rgb.B]);

        if (!this.on) {
            buf = Buffer.from([0, 0, 0, 0]);
        }
    }
}

module.exports = PlaybulbAccessory;
