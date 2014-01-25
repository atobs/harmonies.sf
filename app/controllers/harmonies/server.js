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

var levelup = require("level");
var db = levelup("harmonies.db", { valueEncoding: 'json' });



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

module.exports = {
  // If the controller has assets in its subdirs, set is_package to true
  is_package: false,
  routes: {
    "/" : "index",
    "/:id/?" : "index",
    "/:id/:version" : "index"
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

    console.log("ROOM", room, "V", version, "RV", room_version, "RO", read_only);
    api.bridge.controller("harmonies", "set_room", room, version, read_only);
    api.page.render({ socket: true, content: "" });
  },

  realtime: function() {
    db.get('versions', function(err, versions) {
      if (versions && !err) {
        console.log("READ VERSIONS", JSON.stringify(versions));
        _versions = versions;
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

      _dirty_rooms = {};
    }, 1000);
  },

  socket: function(socket) {
    var _user_id = getID();
    var _room = "default";

    socket.on('stroke', function (data) {
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
      _room = data.room || "default";
      if (!_strokes[_room]) {
        _strokes[_room] = [];
      }
      if (!_versions[_room]) {
        _versions[_room] = 0;
      }

      _users[_user_id] = _room;

      if (!_fgColors[_room]) {
        _fgColors[_room] = {};
      }

      _fgColors[_room][_user_id] = [0,0,0];


      socket.spark.join(_room);
      socket.emit('clear');

      if (_bgColors[_room]) {
        socket.emit('new-bgcolor', _bgColors[_room]);
      }

      if (_fgColors[_room]) {
        socket.emit('new-fgcolor', _fgColors[_room]);
        socket.spark.room(_room).send('new-fgcolor', _fgColors[_room]);
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
      if (data){
        socket.spark.room(_room).send('new-bgcolor', data);
        _bgColors[_room] = data;
      }
    });

    socket.on('new-fgcolor', function(data) {
      _fgColors[_room][_user_id] = data;

      socket.emit('new-fgcolor', _fgColors[_room]);
      socket.spark.room(_room).send('new-fgcolor', _fgColors[_room]);
    });

    socket.on('clear', function() {
      socket.spark.room(_room).send('clear');
      _strokes[_room] = [];
      _cleared_rooms[_room] = true;
      _versions[_room] = (_versions[_room] || 0) + 1;

      console.log("VERSIONS ARE NOW", JSON.stringify(_versions));
    });

    socket.on('list-rooms', function(callback) {
      var populatedRooms = {
        default: true,
        gh: true
      };

      _.each(_users, function(user) {
        populatedRooms[_users[user]] = true;
      });

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
  }
};
