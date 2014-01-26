function Rooms() {
    this.init();
}

Rooms.prototype = {
    container: null,

    init: function() {
        var text, containerText;

        this.container = document.createElement("div");
        this.container.className = 'gui';
        this.container.style.position = 'absolute';
        this.container.style.textAlign = 'left';
        this.container.style.top = '0px';
        this.container.style.visibility = 'hidden';

    },

    update: function(data) {
      var updating = document.createElement("div");
      updating.innerHTML = "Now Updating...";

      this.container.appendChild(updating);

      var container = this.container;
      container.style.visibility = 'hidden';

      SF.socket().emit('list-rooms', function(room_list) {
        container.innerHTML = '';

        var newRoom = document.createElement('div');
        newRoom.innerHTML = 'create a new room'; 
        var roomInput = document.createElement('input');
        roomInput.setAttribute('type', 'text');
        roomInput.style.marginLeft = "25px";

        roomInput.addEventListener('change', function(event) {
          var room_url = '/h/' + roomInput.value;
          SF.go(room_url);
          window.location.reload();
        }, false);


        newRoom.appendChild(roomInput);
        container.appendChild(newRoom);

        container.appendChild($("<hr />")[0]);

        // Add the room list.
        if (room_list.length > 0) {
          var roomText = document.createElement('div');
          roomText.innerHTML = 'or click on a room below to join <br />';
          container.appendChild(roomText);

          room_list.forEach(function(room) {
            var href = document.createElement("a");
            var room_url = '/h/' + room;
            href.setAttribute("href", room_url);
            href.innerHTML = room + "<br />";
            container.appendChild(href);
            container.style.visibility = 'visible';
          });
        }

        container.appendChild($("<hr />")[0]);

        // Add room list link
        var allRoomLinks = $("<div>or </div>");
        allRoomLinks.append(
          $("<a />")
            .html("See all rooms")
            .attr("href", "/rooms")
          );
        container.appendChild(allRoomLinks[0]);


      });

    },

    show: function() {
        this.container.style.visibility = 'visible';
    },

    hide: function() {
        this.container.style.visibility = 'hidden';
    }
}

module.exports = Rooms;
