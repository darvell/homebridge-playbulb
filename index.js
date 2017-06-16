var HomeSysPlatform = require("./lib/HomeSysPlatform.js");
var PlaybulbAccessory = require("./lib/PlaybulbAccessory.js");

var Service, Characteristic;

module.exports = function(homebridge) {
    PlaybulbAccessory.setHomebridge(homebridge);
    homebridge.registerAccessory("playbulb", "Playbulb", PlaybulbAccessory);
};
