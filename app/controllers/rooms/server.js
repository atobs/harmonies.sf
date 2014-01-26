"use strict";

var controller = require_core("server/controller");
// Helpers for serialized form elements
var value_of = controller.value_of,
    array_of = controller.array_of;


module.exports = {
  // If the controller has assets in its subdirs, set is_package to true
  is_package: false,
  routes: {
    "" : "index",
  },

  index: function(ctx, api) {
    var harmonies = require_app("controllers/harmonies/server");
    var versions = harmonies.versions;
    var idle_versions = {},
        active_versions = {};

    var populated_rooms = harmonies.get_populated_rooms();

    _.each(versions, function(ver, room) {
      if (populated_rooms[room]) {
        active_versions[room] = populated_rooms[room];
      } else {
        idle_versions[room] = ver;
      }
    });

    var template_str = api.template.render("controllers/rooms/rooms.html.erb", {
      versions: versions,
      idle_versions: idle_versions,
      active_versions: active_versions
    });
    api.page.render({ content: template_str});
  },

  socket: function() {}
};
