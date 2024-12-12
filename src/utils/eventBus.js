const EventEmitter = require("events");
class UpdateEventBus extends EventEmitter {}
module.exports = new UpdateEventBus();
