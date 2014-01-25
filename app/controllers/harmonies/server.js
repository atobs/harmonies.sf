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
var _drawings = {};

var levelup = require("level");
var db = levelup("harmonies.db");



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
  },

  index: function(ctx, api) {
    api.template.add_stylesheet("harmonies.css");
    var room = ctx.req.params.id || "default";
    api.bridge.controller("harmonies", "set_room", room);
    api.page.render({ socket: true, content: "" });
  },

  realtime: function() {
    db.get('rooms', function(err, room_str) {
      if (!err) {
        var rooms;
        try {
          rooms = JSON.parse(room_str);
        } catch(e) {
          return;
        }
        
        _.each(rooms, function(room) {
          db.get('room_' + room, function(err, stroke) {
            try {
              _strokes[room] = JSON.parse(stroke);
            } catch(e) {
              console.log("Trouble deserializing", room);
            }
          });
        });
      }
    });

    // Save the strokes to the DB
    setInterval(function() {
      _.each(_dirty_rooms, function(val, room) {
        db.put('room_' + room, JSON.stringify(_strokes[room]), function(err) { });
      });

      db.put('rooms', JSON.stringify(_.keys(_strokes)));

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
      console.log("JOINING", data);
      _room = data.room || "default";
      if (!_strokes[_room]) {
        _strokes[_room] = [];
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


      for (var i in _strokes[_room]) {
        socket.emit('stroke', _strokes[_room][i]);
      }
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
    });

    socket.on('list-rooms', function(callback) {
      var populatedRooms = {};
      for (var user in _users) {
        populatedRooms[_users[user]] = true;
      }

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
