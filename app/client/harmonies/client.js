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

        var startCoords = coords.shift();
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
                  });
                } else {
                  doWork();
                }
            } else {
                newBrush.strokeEnd();
                midStroke = false;
                nextStroke();
            }

            COLOR = lastColor;

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

    socket.on('new-fgcolor', function(data) {

      var width = 100.0 / Object.keys(data).length;
      var userContainer = document.createElement("span");

      for (var user in data) {
        var color = data[user];
        var userSwatch = document.createElement('span');
        userSwatch.style.display = "inline-block";
        userSwatch.style.width = width + "%";
        userSwatch.className = 'user-swatch';

        userSwatch.style.backgroundColor = 'rgb(' + color[0] + ', ' + color[1] + ', ' + color[2] + ')';
        userContainer.appendChild(userSwatch);
      }

      window.MENU.users.innerHTML = '';
      window.MENU.users.appendChild(userContainer);
    });

    socket.on('clear', function() {
        window.clearCanvas();
    });
  }
}
