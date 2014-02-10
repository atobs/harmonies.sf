var room = window.location.hash || "#default";
var version;
var read_only = false;

module.exports = {

  set_room: function(new_room, new_version, new_read_only) {
    room = new_room;
    version = new_version;
    read_only = new_read_only;
  },

  install: function(socket) {
    if (!read_only) {
      socket.emit('join', {
        room: room.toLowerCase()
      });
    }


    socket.emit('history', {
      room: room.toLowerCase(),
      version: version
    });

    var userBrushes = {};
    var pendingStrokes = [];
    var midStroke = false;

    function nextStroke() {
        if (!midStroke && pendingStrokes.length > 0) {
            var data = pendingStrokes.shift();
            traceStroke(data.brush, data.coords, data.color, data.erase, data.bg, data.brush_size);
        }
    }


    function traceStroke(newBrush, coords, color, erase, bg, brush_size) {
        midStroke = true;

        var startCoords = coords.shift(),
            i = 0,
            queue_size = 20,
            curX = startCoords[0],
            curY = startCoords[1];

        newBrush.strokeStart(startCoords);

        var lastRun = Date.now();
        var doWork = function() {
            var lastColor = COLOR;
            var lastContext = window.CONTEXT;
            if (bg) {
              window.CONTEXT = window.BGCANVAS.getContext("2d");
            } else {
              window.CONTEXT = window.FGCANVAS.getContext("2d");
            }

            var old_brush_size = BRUSH_SIZE;
            if (brush_size) {
              BRUSH_SIZE = brush_size;
            }

            var lastCompositeOperation = window.CONTEXT.globalCompositeOperation;
            if (erase) {
                window.CONTEXT.globalCompositeOperation = "destination-out";
            } else {
                window.CONTEXT.globalCompositeOperation = "source-over";
            }

            COLOR = color || COLOR;

            newBrush.context = window.CONTEXT;

            for (var n = 0; i < coords.length && n < queue_size; i++, n++) {
                curX += coords[i][0];
                curY += coords[i][1];

                if (coords[i].length > 3) {
                  BRUSH_SIZE = coords[i][2];
                  BRUSH_PRESSURE = coords[i][3];
                }

                newBrush.stroke(curX, curY);
            }

            window.CONTEXT.globalCompositeOperation = lastCompositeOperation;
            window.CONTEXT = lastContext;
            COLOR = lastColor;

            if (i < coords.length) {
                var delta = Date.now() - lastRun;
                if (delta > 33) {
                  setTimeout(function() {
                    doWork();
                    lastRun = Date.now();
                  }, 10);
                } else {
                  doWork();
                }
            } else {
                newBrush.strokeEnd();
                midStroke = false;
                nextStroke();
            }

            COLOR = lastColor;
            BRUSH_SIZE = old_brush_size;

        };

        doWork();
    }

    function ChangeBrush(user_id, brushName, forceNew) {

        var userBrushObj = userBrushes[user_id];
        if (userBrushObj && userBrushObj.brushName == brushName && !forceNew) {
            return userBrushObj;
        } else if (userBrushObj) {
            userBrushObj.destroy();
        }

        var lastCompositeOperation = window.CONTEXT.globalCompositeOperation;
        var newBrushObj = eval("new " + brushName + "(window.CONTEXT)");
        window.CONTEXT.globalCompositeOperation = lastCompositeOperation;
        userBrushes[user_id] = newBrushObj;
        newBrushObj.brushName = brushName;
        return newBrushObj;

    }

    socket.on('stroke', function(data) {
        var newBrush = ChangeBrush(data.user_id, data.brush, data.lift);

        data.brush = newBrush;
        pendingStrokes.push(data);
        nextStroke();
    });

    socket.on('new-bgcolor', function(data) {
        document.body.style.backgroundColor = 'rgb(' + data[0] + ', ' + data[1] + ', ' + data[2] + ')';
        window.backgroundColorSelector.setColor(data);
    });

    var _colors = {};
    var color_to_rgb = function(color) {
      return 'rgb(' + color[0] + ', ' + color[1] + ', ' + color[2] + ')';
    };

    socket.on('new-fgcolor', function(data) {

      var width = 100.0 / Object.keys(data).length;
      var userContainer = document.createElement("span");

      for (var user in data) {
        var color = data[user].color;
        var userSwatch = document.createElement('span');
        userSwatch.style.display = "inline-block";
        userSwatch.style.width = width + "%";
        userSwatch.className = 'user-swatch';
        _colors[user] = color;

        userSwatch.style.backgroundColor = color_to_rgb(color);
        userContainer.appendChild(userSwatch);
      }

      window.MENU.users.innerHTML = '';
      window.MENU.users.appendChild(userContainer);
    });

    var _cursors = {};
    var _dom_cursors = {};

    function draw_cursors() {
      _.each(_cursors, function(cursor) {
        // need to draw this cursor somewhere
        var cursorEl = _dom_cursors[cursor.user_id];
        if (!_dom_cursors[cursor.user_id]) {
          _dom_cursors[cursor.user_id] = $("<div class='pointer' />");
          cursorEl = _dom_cursors[cursor.user_id];
          $("body").append(cursorEl);
          cursorEl.css({
            width: "10px",
            marginLeft: "-5px",
            marginTop: "-5px",
            height: "10px",
            opacity: "0.5",
            position: "fixed"
          });

        }

        var xScaled = parseInt(window.DX + (cursor.coords[0] * window.ZOOM), 10);
        var yScaled = parseInt(window.DY + (cursor.coords[1] * window.ZOOM), 10);

        if (cursor.click) {
          cursorEl.css("opacity", 0.8);
          cursorEl.css("border", "1px solid black");
        } else {
          cursorEl.css("opacity", 0.5);
          cursorEl.css("border", "1px solid gray");
        }

        var size = Math.max(cursor.size, 5);
        cursorEl.css({
          backgroundColor: color_to_rgb(_colors[cursor.user_id] || [0,0,0])
        });

        cursorEl.stop(true).animate({
          marginLeft: -1 * size / 2,
          marginTop: -1 * size / 2,
          width: size,
          height: size,
          left: xScaled,
          top: yScaled
        }, 200);

      });
    }

    socket.on('cursors', function(cursors, user_id) { 
      _.each(_dom_cursors, function(cursor, key) {
        if (!cursors[key] && cursor) {
          cursor.remove();
        }
      });

      _cursors = cursors;
    });

    socket.on('move', function(data) {
      if (data.coords) {
        _cursors[data.user_id] = data;
      } else {
        delete _cursors[data.user_id];
      }
    });

    socket.on('clear', function() {
        window.clearCanvas();
    });

    setInterval(draw_cursors, 100);
  }
};
