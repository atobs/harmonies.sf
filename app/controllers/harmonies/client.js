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
    client.install(s);
  }
};
