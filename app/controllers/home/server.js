"use strict";

module.exports = {
  routes: {
    "" : "index"
  },

  index: function(ctx, api) {
    ctx.res.redirect("/h/default");
  },

  socket: function() {}
};
