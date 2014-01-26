module.exports = {
  install: function(s) {
    var UI = $("<div class='chat_pane'/>");
    var form = $("<form />");
    var textinput = $("<input type='text' class='form-control'/>");
    var chat_area = $("<div class='chat_area'/>");
    UI.append(chat_area);
    UI.append(form);


    form.append(textinput);

    form.on("submit", function(evt) {
      evt.preventDefault();
      s.emit("sendmsg", { 
        msg: textinput.val()
      });

      textinput.val("");
    });

    $("body").append(UI);

    s.on('recvmsg', function(data) {
      var msgEl = $("<div />");
      msgEl.text(data.msg);
      msgEl.data("user", data.user);
      var color = data.color || [0,0,0];
      var colorStr = 'rgb(' + color[0] + ', ' + color[1] + ', ' + color[2] + ')';

      msgEl.css("color", colorStr);
      chat_area.append(msgEl);
    });

  }

};
