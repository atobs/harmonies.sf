var stringToColor = require("app/client/harmonies/string_to_color");

module.exports = {
  install: function(s) {
    var UI = $("<div class='chat_pane'/>");
    var form = $("<form />");
    var textinput = $("<input type='text' class='form-control'/>");
    var chat_area = $("<div class='chat_area'/>");
    var chat_toggle = $("<div class='pam'>hide chat</div>");

    chat_area.append(chat_toggle);
    chat_toggle.css("position", "absolute");
    chat_toggle.css("right", "10px");
    chat_toggle.css("background-color", "#dedede");

    function scroll_chat_area() {
      // scroll to bottom
      var height = chat_area[0].scrollHeight;
      chat_area.scrollTop(height);
    }

    var throttled_scroll_chat_area = _.throttle(scroll_chat_area, 100);

    var hidden = false;
    if (window.SCREEN_WIDTH < 768) {
      hidden = true;
    }

    chat_toggle.css("cursor", "pointer");

    function redraw_controls() {
      if (hidden) {
        UI.css("width", "100px");
        chat_toggle.html("show chat");
      } else {
        UI.css("width", "300px");
        chat_toggle.html("hide chat");
      }

    }

    chat_toggle.on('click', function() {
      hidden = !hidden; 
      redraw_controls();
    });

    UI.append(chat_area);
    UI.append(form);

    redraw_controls();


    form.append(textinput);

    form.on("submit", function(evt) {
      evt.preventDefault();
      s.emit("sendmsg", { 
        msg: textinput.val()
      });

      textinput.val("");
    });

    $("body").append(UI);

    s.on('clearchat', function(){ 
      chat_area.empty();  
      chat_area.append(chat_toggle);
    });

    s.on('recvmsg', function(data) {
      var msgEl = $("<div />");

      if (data.server && data.html) {
        msgEl.html(data.html);
      } else {
        msgEl.text(data.msg);
      }

      msgEl.data("user", data.user);
      var colorish = stringToColor(data.user);
      var color = data.color || [0,0,0];
      var colorStr = 'rgb(' + color[0] + ', ' + color[1] + ', ' + color[2] + ')';

      if (data.server) {
        msgEl.prepend($("<b>[Server] </b> "));
      }

      var nick = data.nick || data.user;
      if (nick && !data.server) {
        msgEl.prepend(
          $("<span /> ")
            .text(nick)
            .css("font-weight", "bold")
            .css("margin-right", "10px")
            .css("color", colorish)
        );
      }

      msgEl.css("color", colorStr);
      chat_area.append(msgEl);

      throttled_scroll_chat_area();

    });

  }

};
