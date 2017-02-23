var PlaybulbDiscovery = require('./PlaybulbDiscovery.js');

var Accessory, Characteristic, Service;

class PlaybulbAccessory {
    constructor(log, config) {
        this.log = log;

        //Configuration
        this.name = config["name"];
        this.address = config["address"];

        //Bluetooth Connection
        this.bulb = null;
        this.bulbColorCharacteristic = null;

        //Timers
        this.writeTimer = null;
        this.timerInterval = null;
        this.timer = 0;

        //HomeKit Characteristic State
        this.on = 0;
        this.hue = 0;
        this.saturation = 0;
        this.brightness = 0;

        this.configureServices();

        PlaybulbDiscovery.onAddressConnected(this.address, this.connected.bind(this));
    }

    static setHomebridge(homebridge) {
        Accessory = homebridge.platformAccessory;
        Service = homebridge.hap.Service;
        Characteristic = homebridge.hap.Characteristic;
    }

    configureServices() {
        var service = this.service = new Service.Lightbulb(this.name);
        service.getCharacteristic(Characteristic.On).on('get', this.getPower.bind(this));
        service.getCharacteristic(Characteristic.On).on('set', this.setPower.bind(this));
        service.addCharacteristic(Characteristic.Brightness).on('get', this.getBrightness.bind(this));
        service.getCharacteristic(Characteristic.Brightness).on('set', this.setBrightness.bind(this));
        service.addCharacteristic(Characteristic.Hue).on('get', this.getHue.bind(this));
        service.getCharacteristic(Characteristic.Hue).on('set', this.setHue.bind(this));
        service.addCharacteristic(Characteristic.Saturation).on('get', this.getSaturation.bind(this));
        service.getCharacteristic(Characteristic.Saturation).on('set', this.setSaturation.bind(this));

        var timerService = this.timerService = new Service.Timer('Auto Off Timer');
        timerService.getCharacteristic(Characteristic.Timer).on('get', this.getTimer.bind(this));
        timerService.getCharacteristic(Characteristic.Timer).on('set', this.setTimer.bind(this));

        var infoService = this.infoService = new Service.AccessoryInformation();
        infoService.setCharacteristic(Characteristic.Manufacturer, "Mipow");
        infoService.setCharacteristic(Characteristic.Model, "Playbulb Candle");
        infoService.setCharacteristic(Characteristic.SerialNumber, this.address);
    }

    getServices() {
        return [this.service, this.timerService, this.infoService];
    }

    connected(bulb) {
        this.log("Connected on address " + this.address);

        this.bulb = bulb;
        this.bulb.on('disconnect', this.disconnect.bind(this));

        //Read initial state from device
        this.bulb.discoverAllServicesAndCharacteristics((error, services, characteristics) => {
            //this.log('discoverAllServicesAndCharacteristics', error, services, characteristics);

            characteristics.map((characteristic) => {
                if (characteristic.uuid === 'fffc') {
                    this.bulbColorCharacteristic = characteristic;

                    characteristic.read((error, data) => {
                        if (!error) {
                            var color = this._rgbToHsv(data[1], data[2], data[3]);

                            this.log("Read Initial Color", data, color);

                            this.hue = color.H;
                            this.saturation = color.S;
                            this.brightness = color.V;

                            if (!color.H && !color.S && !color.V) {
                                this.on = 0;
                            } else {
                                this.on = 1;
                            }
                        } else {
                            this.log('Error Reading Initial Color', error, data);
                        }
                    });
                }
            });
        });
    }

    reconnected() {
        //Re-discover Characteristic, Write latest value
        this.bulb.discoverAllServicesAndCharacteristics((error, services, characteristics) => {
            characteristics.map((characteristic) => {
                if (characteristic.uuid === 'fffc') {
                    this.bulbColorCharacteristic = characteristic;

                    this.writeColor();
                }
            });
        });
    }

    identification(paired, callback) {
        this.log.info("Identify candle " + this.name);
        callback();
    }

    disconnect(error) {
        this.log("Playbulb Disconnected", this.address, error);

        this.bulbColorCharacteristic = null;

        this.bulb.connect((error) => {
            this.log("Playbulb Reconnected", this.address, error);

            if (!error) {
                this.reconnected();
            }
        });
    }

    timerTick() {
        this.timer -= 5;

        //this.log("Timer Tick. Remaining Seconds:", this.timer);

        if(this.timer <= 0) {
            this.service.setCharacteristic(Characteristic.On, 0);

            this.timer = 0;
        }

        this.timerService.setCharacteristic(Characteristic.Timer, this.timer);
    }

    getPower(callback) {
        this.log.info("getPower", this.on);
        callback(null, this.on);
    }

    setPower(value, callback) {
        this.on = value;
        this.log('setPower', value);
        this.delayedWriteColor();
        callback(null);
    }

    getTimer(callback) {
        this.log.info("getTimer", this.timer);
        callback(null, this.timer);
    }

    setTimer(value, callback) {
        this.timer = value;
        this.log('setTimer', value);

        clearInterval(this.timerInterval);

        if(value) {
            this.timerInterval = setInterval(this.timerTick.bind(this), 5000);
        }

        callback(null);
    }

    getHue(callback) {
        this.log.info("getHue", this.hue);
        callback(null, this.hue);
    }

    setHue(value, callback) {
        this.hue = value;
        this.log('setHue', value);
        this.delayedWriteColor();
        callback(null);
    }

    getSaturation(callback) {
        this.log.info("getSaturation", this.saturation);
        callback(null, this.saturation);
    }

    setSaturation(value, callback) {
        this.saturation = value;
        this.log('setSaturation', value);
        this.delayedWriteColor();
        callback(null);
    }

    getBrightness(callback) {
        this.log.info("getBrightness", this.brightness);
        callback(null, this.brightness);
    }

    setBrightness(value, callback) {
        this.brightness = value;
        this.log('setBrightness', value);
        this.delayedWriteColor();
        callback(null);
    }

    delayedWriteColor() {
        if (!this.writeTimer) {
            this.writeTimer = setTimeout(() => {
                this.writeColor();
                this.writeTimer = null;
            }, 50);
        }
    }

    writeColor() {
        if (!this.bulbColorCharacteristic) {
            this.log("Can't writeColor, bulb is AWOL");
            return;
        }

        this.log("writeColor");

        var rgb = this._hsvToRgb(this.hue, this.saturation, this.brightness);
        var buf = Buffer.from([0, rgb.R, rgb.G, rgb.B]);

        if (!this.on) {
            buf = Buffer.from([0, 0, 0, 0]);
        }

        this.bulbColorCharacteristic.write(buf, true, (error) => {
            if (error) {
                this.log.info("Error while setting value on addres " + this.address + ": " + error);
            }
        });
    }

    _hsvToRgb(h, s, v) {
        var c = (v / 100.0) * (s / 100.0);
        var x = c * (1.0 - Math.abs(((h / 60.0) % 2) - 1));
        var m = (v / 100.0) - c;
        var rt = c;
        var gt = 0.0;
        var bt = x;
        if (h >= 0.0 && h < 60.0) {
            rt = c;
            gt = x;
            bt = 0.0;
        } else if (h >= 60.0 && h < 120.0) {
            rt = x;
            gt = c;
            bt = 0.0;
        } else if (h >= 120.0 && h < 180.0) {
            rt = 0.0;
            gt = c;
            bt = x;
        } else if (h >= 180.0 && h < 240.0) {
            rt = 0.0;
            gt = x;
            bt = c;
        } else if (h >= 240.0 && h < 300.0) {
            rt = x;
            gt = 0.0;
            bt = c;
        }
        var r = Math.round((rt + m) * 255.0);
        var g = Math.round((gt + m) * 255.0);
        var b = Math.round((bt + m) * 255.0);
        return { R: r, G: g, B: b };
    }

    _rgbToHsv(r, g, b) {
        var rt = r / 255.0;
        var gt = g / 255.0;
        var bt = b / 255.0;
        var cmax = Math.max(rt, gt, bt);
        var cmin = Math.min(rt, gt, bt);
        var delta = cmax - cmin;
        var h = 0;
        if (delta !== 0) {
            if (cmax === rt) {
                h = 60.0 * (((gt - bt) / delta) % 6);
            } else if (cmax === gt) {
                h = 60.0 * (((bt - rt) / delta) + 2);
            } else {
                h = 60.0 * (((rt - gt) / delta) + 4);
            }
        }
        var s = 0;
        if (cmax !== 0) {
            s = (delta / cmax) * 100.0;
        }
        var v = cmax * 100.0;
        return { H: h, S: s, V: v };
    }
}

module.exports = PlaybulbAccessory;