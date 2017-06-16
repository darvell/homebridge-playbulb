const util = require("util");

var Accessory, Characteristic, Service;

class HomeSysPlatform {
    constructor() {}

    static setHomebridge(homebridge) {
        Accessory = homebridge.platformAccessory;
        Service = homebridge.hap.Service;
        Characteristic = homebridge.hap.Characteristic;
    }
}

module.exports = HomeSysPlatform;
