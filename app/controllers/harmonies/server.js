"use strict";

var controller = require_core("server/controller");
// Helpers for serialized form elements
var value_of = controller.value_of,
    array_of = controller.array_of;
    

var _id = 0;
function getID() {
  _id += 1;
  return _id;
}

var _strokes = { "default" : []};
var _fgColors = { };
var _bgColors = { };
var _users = {};
var _versions = {};
var _topics = {};
var _msgs = {};

var CLEAR_TIMEOUT = 10;

var levelup = require("level");
var db = levelup("harmonies.db", { valueEncoding: 'json' });

var MAX_MSGS = 50;



// This is an implementation of the Fisher-Yates algorithm, taken from
// http://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle
function array_shuffle (aArray) {
    for (var mTemp, j, i = aArray.length; i; ) {  // mTemp, j initialized here for shorter code
        j = parseInt (Math.random () * i);  // introduces modulo bias (see below)
        mTemp = aArray[--i];
        aArray[i] = aArray[j];
        aArray[j] = mTemp;
    }
}

var _dirty_rooms = {};
var _cleared_rooms = {};
var _to_clear = {};

function getPopulatedRooms() {
  var populatedRooms = {
    default: 0,
    gh: 0
  };

  _.each(_users, function(room, user) {
    populatedRooms[room] = (populatedRooms[room] || 0) + 1;
  });

  return populatedRooms;
}

module.exports = {
  // If the controller has assets in its subdirs, set is_package to true
  is_package: false,
  routes: {
    "/" : "index",
    "/:id" : "index",
    "/:id/:version" : "index_ver"
  },

  index_ver: function(ctx, api) {
    module.exports.index(ctx, api);
  },

  index: function(ctx, api) {
    api.template.add_stylesheet("harmonies.css");
    var room = ctx.req.params.id || "default";
    var version = ctx.req.params.version;
    var room_version = _versions[room] || 0;
    if (version) {
      version = parseInt(version, 10);
    } else {
      version = room_version;
    }

    var read_only = version !== room_version;

    this.set_fullscreen(true);

    api.bridge.controller("harmonies", "set_room", room, version, read_only);
    api.page.render({ socket: true, content: "" });
  },

  realtime: function() {
    db.get('versions', function(err, versions) {
      if (versions && !err) {
        console.log("READ VERSIONS", JSON.stringify(versions));
        _versions = versions;
        module.exports.versions = _versions;
      }
    });

    db.get('topics', function(err, topics) {
      if (!err && topics) {
        _topics = topics;
      }
    });

    db.get('msgs', function(err, msgs) {
      if (!err && msgs) {
        _msgs = msgs;
      }
    });

    db.get('rooms', function(err, rooms) {
      if (!err) {
        _.each(rooms, function(room) {
          db.get('room_' + room, function(err, strokes) {
            _strokes[room] = strokes;
          });
        });
      }
    });

    // Save the strokes to the DB
    setInterval(function() {
      _.each(_dirty_rooms, function(val, room) {
        db.put('room_' + room, _strokes[room]);
        db.put('room_' + room + '_' + _versions[room], _strokes[room]);
      });

      db.put('rooms', _.keys(_strokes));
      db.put('versions', _versions);
      db.put('msgs', _msgs);
      db.put('topics', _topics);

      _dirty_rooms = {};
    }, 1000);
  },

  socket: function(socket) {
    var _user_id = getID();
    var _user_hash = "#" + _user_id;
    var _room = "default";
    var _writer = false;
    var _nick = socket.session.nick;

    function server_perma_broadcast_html() {
      var data = server_broadcast_html.apply(null, arguments);
      _msgs[_room].push(data);
    }

    function server_broadcast_html() {
      var msg = _.toArray(arguments).join(" ");
      var data = {
        html: msg,
        user: -1,
        color: [100,100,100],
        server: true
      };
      socket.broadcast.to(_room).send("recvmsg", data);
      socket.emit("recvmsg", data);

      return data;
    }

    function server_perma_broadcast() {
      var data = server_broadcast.apply(null, arguments);
      _msgs[_room].push(data);
    }

    function server_broadcast() {
      var msg = _.toArray(arguments).join(" ");
      var data = {
        msg: msg,
        user: -1,
        color: [100,100,100],
        server: true
      };
      socket.broadcast.to(_room).send("recvmsg", data);
      socket.emit("recvmsg", data);

      return data;

    }

    function server_html() {
      var msg = _.toArray(arguments).join(" ");
      socket.emit("recvmsg", {
        html: msg,
        user: -1,
        color: [100,100,100],
        server: true
      });
    }

    function server_msg() {
      var msg = _.toArray(arguments).join(" ");
      socket.emit("recvmsg", {
        msg: msg,
        user: -1,
        color: [100,100,100],
        server: true
      });


    }

    if (_nick) {
      server_msg("Welcome back, " + _nick);
    } else {
      server_msg("Welcome.");
      server_msg("Type /help for help");
    }

    var help = {
      "/clear" : "Clears the current canvas. also gives everyone a chance to cancel",
      "/nick" : "[nickname] - change your nick name",
      "/cancel" : "Cancels the canvas clear. Use this to prevent accidents",
      "/help" : "[command] - get help about a command",
      "/topic" : "[topic] - set the canvas topic"
    };

    var handlers = {
      // Lists the commands available
      "/help" : function() {
        var help_msg = "Available commands:";
        server_msg(help_msg);

        _.each(_.keys(handlers), function(name) {
          if (help[name]) {
            var help_msg = _.template("<b><%= name %></b> <%= help[name] %>", {
              name: name,
              help: help
            });
            server_html(help_msg);
          }
        });
      },
      "/clear" : function() {
        clear_room();
      },
      "/cancel" : function() {
        if (_to_clear[_room]) {
          delete _to_clear[_room];
          server_broadcast("Canvas clear cancelled");
        }
      },
      "/topic" : function() {
        var topic = _.toArray(arguments).join(" ");
        var ver = _versions[_room];
        _topics[_room][ver] = topic;

        socket.emit("new-topic", topic);
        if (!topic) {
          server_broadcast(_nick || _user_hash, "delete the topic.");
        } else {
          server_broadcast(_nick || _user_hash, "changed the topic to", topic);
        }
      },
      "/nick" : function(name) {
        if (!name) {
          if (_nick) {
            server_html("Your nick is ", _nick, ". Use <b>/nick [new name]</b> to change it");
          } else {
            server_html("Your don't have a nickname. Use <b>/nick [new name]</b> to change that");
          }

          return;
        }

        _nick = name; 
        socket.session.nick = name;
        socket.session.save();
        server_broadcast("#" + _user_id + " is now known as " + name);
      }
    };


    function clear_room() {
      if (!_writer) { 
        return;
      }

      _to_clear[_room] = true;
      var room = _room;

      server_broadcast("Clearing the canvas in " + CLEAR_TIMEOUT + " seconds. " + 
        "Use /cancel to prevent the canvas from clearing.");
      setTimeout(function() {
        if (_to_clear[room]) {
          // Need to delay this by a few moments
          socket.spark.room(_room).send('clear');
          socket.emit('clear');

          var room_clear_msg = _.template(
            "Cleared the canvas, saved <a target=_blank href='/h/<%- room %>/<%- version %>'>#<%- version %></a>", 
            {
              room: _room,
              version: _versions[room] || 0
            }
          );

          server_perma_broadcast_html(room_clear_msg);

          _strokes[room] = [];
          _cleared_rooms[room] = true;
          _versions[room] = (_versions[room] || 0) + 1;
          delete _to_clear[room];
        }
      }, CLEAR_TIMEOUT * 1000);
    }

    function handle_command(data) {
      var args = data.msg.split(" ");
      var command = args.shift();
      if (handlers[command]) {
        handlers[command].apply(handlers[command], args);
      }
    }

    function handle_message(data) {

      data.color = _fgColors[_room][_user_id];
      data.nick = _nick;
      data.user = _user_id;
      delete data.server;

      _msgs[_room].push(data);
      if (_msgs[_room].length > MAX_MSGS) {
        _msgs.shift();
      }

      socket.emit("recvmsg", data);
      socket.broadcast.to(_room).emit("recvmsg", data);

    }

    socket.on('sendmsg', function(data) {

      if (data.msg[0] == '/') {
        // Trying out a command
        handle_command(data);
      } else {
        handle_message(data);
      }
    });

    socket.on('stroke', function (data) {
      if (!_writer) {
        return;
      }

      if (data && data.coords && data.coords.length >= 1) {
        data.user_id = _user_id;

        socket.spark.room(_room).send('stroke', data);
        _strokes[_room].push(data);
        _dirty_rooms[_room] = true;
      }
    });

    var updateInterval = setInterval(function() {
      if (_fgColors[_room]) {
        socket.emit('new-fgcolor', _fgColors[_room]);
      }
    }, 10000);

    socket.on('join', function(data) {
      _writer = true;
      _room = data.room || "default";

      _.each(_msgs[_room], function(msg) {
        socket.emit('recvmsg', msg);
      });

      if (!_strokes[_room]) {
        _strokes[_room] = [];
      }
      if (!_versions[_room]) {
        _versions[_room] = 0;
      }
      if (!_msgs[_room]) {
        _msgs[_room] = [];
      }
      if (!_topics[_room]) {    
        _topics[_room] = {};
      }




      _users[_user_id] = _room;

      if (!_fgColors[_room]) {
        _fgColors[_room] = {};
      }

      _fgColors[_room][_user_id] = [0,0,0];


      socket.spark.join(_room);

      if (_bgColors[_room]) {
        socket.emit('new-bgcolor', _bgColors[_room]);
      }

      if (_fgColors[_room]) {
        socket.emit('new-fgcolor', _fgColors[_room]);
        socket.spark.room(_room).send('new-fgcolor', _fgColors[_room]);
      }

      if (_topics[_room][_versions[_room]]) {
        server_msg("the topic is '" + _topics[_room][_versions[_room]] + "'");
      }
    });

    socket.on('history', function(data) {
      _room = data.room || "default";
      var room_key = "room_" + data.room + "_" + data.version;
      db.get(room_key, function(err, strokes) {
        if (!err) {
          _.each(strokes, function(stroke) {
            socket.emit('stroke', stroke);
          });
        }
      });
    });

    socket.on('new-bgcolor', function(data){
      if (!_writer) {
        return;
      }
      if (data){
        socket.spark.room(_room).send('new-bgcolor', data);
        _bgColors[_room] = data;
      }
    });

    socket.on('new-fgcolor', function(data) {
      if (!_writer) {
        return;
      }
      _fgColors[_room][_user_id] = data;

      socket.emit('new-fgcolor', _fgColors[_room]);
      socket.spark.room(_room).send('new-fgcolor', _fgColors[_room]);
    });

    // When someone saves a drawing, that will increment the version of the
    // room, so the current drawing is now always available.
    socket.on('save', function() {
      if (!_writer) {
        return;
      }
      _versions[_room] = (_versions[_room] || 0) + 1;
    });

    socket.on('clear', clear_room);

    socket.on('list-rooms', function(callback) {
      var populatedRooms = getPopulatedRooms();

      var rooms = Object.keys(populatedRooms);

      array_shuffle(rooms);
      callback(rooms.slice(0, 3));
    });

    socket.spark.on('end', function() {
      if (_fgColors[_room] && _fgColors[_room][_user_id]) {
        delete _fgColors[_room][_user_id];
      }

      if (_users[_user_id]) {
        delete _users[_user_id];
      }


      clearInterval(updateInterval);
    });
  },
  versions: _versions,
  get_populated_rooms: getPopulatedRooms
};
