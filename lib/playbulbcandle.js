var Accessory, Characteristic, Service;
var DEFAULT_EFFECTS_TEMPLATE = "00<rgb>04000a00";
var DEFAULT_PLACEHOLDER = "<rgb>";
var DEFAULT_EFFECTS_HANDLE = 0x0014;
var DEFAULT_COLOR = "ff0000";

class PlaybulbCandle {
    constructor(log, name, address, platform) {
        this.log = log;
        this.name = name;
        this.address = address;

        /*var rgb = this._hexToRgb(hex);
        var hsv = this._rgbToHsv(rgb.R, rgb.G, rgb.B);
        this.hue = hsv.H;
        this.saturation = hsv.S;
        this.value = hsv.V;*/

        Accessory = platform.Accessory;
        Characteristic = platform.Characteristic;
        Service = platform.Service;

        this.homebridgeAcc = null;
        this.bulb = null;
        this.bulbColorCharacteristic = null;
        this.writeTimer = null;

        this.on = 0;
        this.hue = 0;
        this.saturation = 0;
        this.brightness = 0;
    }

    connect(bulb, homebridgeAcc) {
        this.log.info("Candle connected on address " + this.address);
        this.homebridgeAcc = homebridgeAcc;
        this.homebridgeAcc.on('identify', this.identification.bind(this));
        this.homebridgeAcc.updateReachability(true);

        this.bulb = bulb;
        this.bulb.once('disconnect', this.disconnect.bind(this));

        var service = new Service.Lightbulb(this.name);
        service.getCharacteristic(Characteristic.On).on('get', this.getPower.bind(this));
        service.getCharacteristic(Characteristic.On).on('set', this.setPower.bind(this));
        service.addCharacteristic(Characteristic.Brightness).on('get', this.getBrightness.bind(this));
        service.getCharacteristic(Characteristic.Brightness).on('set', this.setBrightness.bind(this));
        service.addCharacteristic(Characteristic.Hue).on('get', this.getHue.bind(this));
        service.getCharacteristic(Characteristic.Hue).on('set', this.setHue.bind(this));
        service.addCharacteristic(Characteristic.Saturation).on('get', this.getSaturation.bind(this));
        service.getCharacteristic(Characteristic.Saturation).on('set', this.setSaturation.bind(this));
        homebridgeAcc.addService(service);

        var infservice = homebridgeAcc.getService(Service.AccessoryInformation);
        infservice.setCharacteristic(Characteristic.Manufacturer, "Mipow");
        infservice.setCharacteristic(Characteristic.Model, "Playbulb Candle");
        infservice.setCharacteristic(Characteristic.SerialNumber, this.address);

        //Read initial state from device
        this.bulb.discoverAllServicesAndCharacteristics((error, services, characteristics) => {
            //this.log('discoverAllServicesAndCharacteristics', error, services, characteristics);

            characteristics.map((characteristic) => {
                if (characteristic.uuid === 'fffc') {
                    this.bulbColorCharacteristic = characteristic;

                    characteristic.read((error, data) => {
                        if(!error) {
                            var color = this._rgbToHsv(data[1], data[2], data[3]);

                            this.log("Read Color", data, color);

                            this.hue = color.H;
                            this.saturation = color.S;
                            this.brightness = color.V;

                            if(!color.H && !color.S && !color.V) {
                                this.on = 0;
                            } else {
                                this.on = 1;
                            }
                        } else {
                            this.log('Error Reading Color', error, data);
                        }
                    });
                }
            });
        });
    }

    identification(paired, callback) {
        this.log.info("Identify candle " + this.name);
        callback();
    }

    disconnect(error) {
        if (error) {
            this.log.error("Disconnecting of address " + this.address + " failed: " + error);
        }
        if (this.bulb && this.homebridgeAcc) {
            this.homebridgeAcc.removeAllListeners('identify');
            this.homebridgeAcc.updateReachability(false);
            this.homebridgeAcc = null;
            this.bulb = null;
            this.log.info("Candle " + this.name + " disconnected");
        }
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
        if(!this.writeTimer) {
            this.writeTimer = setTimeout(() => {
                this.writeColor();
                this.writeTimer = null;
            }, 50);
        }
    }

    writeColor() {
        this.log("writeColor");

        var rgb = this._hsvToRgb(this.hue, this.saturation, this.brightness);
        var buf = Buffer.from([0, rgb.R, rgb.G, rgb.B]);

        if(!this.on) {
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

module.exports = PlaybulbCandle;
