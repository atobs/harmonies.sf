"use strict";

require("app/client/harmonies/brush");
var main = require("app/client/harmonies/main");
var client = require("app/client/harmonies/client");

module.exports = {
  events: {

  },
  init: function() {
    main.init(this.$page[0]);
  },
  socket: function(s) {
    this.do_when(this.room, "set_room", function() {
      console.log("INSTALLING SOCKET");
      client.install(s);
    });
  },
  set_room: function(room) {
    this.room = room;
    client.set_room(room);
    console.log("SETTING ROOM", room);
    this.trigger("set_room");
  }
};
