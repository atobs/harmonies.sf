var REV = 6;

window.BRUSHES = ["sketchy", "shaded", "chrome", "fur", "longfur", "web", "", "simple", "squares", "ribbon", "", "circles", "grid"];
window.USER_AGENT = navigator.userAgent.toLowerCase();

var Palette =  require("app/client/harmonies/palette");
var ColorSelector = require("app/client/harmonies/colorselector");
var Menu = require("app/client/harmonies/menu");
var About = require("app/client/harmonies/about");
var Rooms = require("app/client/harmonies/rooms");

// Globals ?
window.SCREEN_WIDTH = window.innerWidth * 2;
window.SCREEN_HEIGHT = window.innerHeight * 2;
window.CANVAS_WIDTH = 1000;
window.CANVAS_HEIGHT = 1000;
window.BRUSH_SIZE = 1;
window.BRUSH_PRESSURE = 1;
window.COLOR = [0, 0, 0];
window.BACKGROUND_COLOR = [250, 250, 250];
window.ZOOM = 1;
window.MAX_ZOOM = 1.5;
window.MIN_ZOOM = 0.5;
window.CONTEXT = null;

var brush, panStart = [],
panCoords = [],
panOffset = [0, 0],
strokeCoordinates = [],
wacom, i, dX = 0,
dY = 0,
origX = 0,
origY = 0,
mouseX = 0,
mouseY = 0,
prevX = 0,
prevY = 0,
container,
foregroundColorSelector,
backgroundColorSelector,
about,
rooms,
zoomin,
zoomout,
rooms,
flattenCanvas,
isBackground = false,
isFgColorSelectorVisible = false,
isBgColorSelectorVisible = false,
isAboutVisible = false,
isRoomsVisible = false,
isMenuMouseOver = false,
modalDialogOpen = false,
colorKeyIsDown = false,
pickerKeyIsDown = false,
panModeOn = false,
isEraseModeOn = false,
isRoomsOpen = false,
newStroke = false,
lastCompositeOperation,
lastColor = [0,0,0];

function init(container) {
    var hash, palette, embed, localStorageImage;

    if (USER_AGENT.search("android") > -1 || USER_AGENT.search("iphone") > -1) BRUSH_SIZE = 2;

    document.body.style.backgroundRepeat = 'no-repeat';
    document.body.style.backgroundPosition = 'center center';

    /*
     * TODO: In some browsers a naste "Plugin Missing" window appears and people is getting confused.
     * Disabling it until a better way to handle it appears.
     *
     * embed = document.createElement('embed');
     * embed.id = 'wacom-plugin';
     * embed.type = 'application/x-wacom-tablet';
     * document.body.appendChild(embed);
     *
     * wacom = document.embeds["wacom-plugin"];
     */

    window.fgcanvas = canvas = document.createElement("canvas");
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    canvas.setAttribute("id", "drawing");
    canvas.style.cursor = 'crosshair';

    window.bgcanvas = document.createElement("canvas");
    bgcanvas.width = CANVAS_WIDTH;
    bgcanvas.height = CANVAS_HEIGHT;
    bgcanvas.setAttribute("id", "drawing-bg");

    container.appendChild(bgcanvas);
    container.appendChild(canvas);

    window.CONTEXT = canvas.getContext("2d");

    flattenCanvas = document.createElement("canvas");
    flattenCanvas.width = CANVAS_WIDTH;
    flattenCanvas.height = CANVAS_HEIGHT;

    palette = new Palette();

    foregroundColorSelector = new ColorSelector(palette);
    foregroundColorSelector.addEventListener('change', onForegroundColorSelectorChange, false);
    container.appendChild(foregroundColorSelector.container);

    backgroundColorSelector = new ColorSelector(palette);
    backgroundColorSelector.addEventListener('change', onBackgroundColorSelectorChange, false);
    container.appendChild(backgroundColorSelector.container);

    window.MENU = new Menu();
    window.MENU.selector.addEventListener('change', onMenuSelectorChange, false);
    var menu = window.MENU;

    addClickListener(menu.foregroundColor, onMenuForegroundColor)
    addClickListener(menu.backgroundColor, onMenuBackgroundColor)
    addClickListener(menu.save, onMenuSave)
    addClickListener(menu.clear, onMenuClear)
    addClickListener(menu.pan, onMenuPan)
    addClickListener(menu.erase, onMenuErase)
    addClickListener(menu.zoomin, onMenuZoomIn)
    addClickListener(menu.zoomout, onMenuZoomOut)
    addClickListener(menu.about, onMenuAbout)
    addClickListener(menu.join, onMenuJoin)
    addClickListener(menu.rooms, onMenuRooms)
    addClickListener(menu.layerbg, onMenuBG)
    menu.container.addEventListener('mouseover', onMenuMouseOver, false);
    menu.container.addEventListener('mouseout', onMenuMouseOut, false);
    container.appendChild(menu.container);

    foregroundColorSelector.setColor(COLOR);
    backgroundColorSelector.setColor(BACKGROUND_COLOR);

    if (!brush) {
        changeBrush(0);
    }

    about = new About();
    container.appendChild(about.container);

    rooms = new Rooms();
    container.appendChild(rooms.container);

    window.addEventListener('mousemove', onWindowMouseMove, false);
    window.addEventListener('resize', onWindowResize, false);
    window.addEventListener('keydown', onWindowKeyDown, false);
    window.addEventListener('keyup', onWindowKeyUp, false);
    window.addEventListener('blur', onWindowBlur, false);

    document.addEventListener('touchstart', touchHandlerDummy, false);
    document.addEventListener('touchmove', touchHandlerDummy, false);
    document.addEventListener('touchend', touchHandlerDummy, false);

    document.addEventListener('mouseout', onDocumentMouseOut, false);

    document.addEventListener("dragenter", onDocumentDragEnter, false);
    document.addEventListener("dragover", onDocumentDragOver, false);
    document.addEventListener("drop", onDocumentDrop, false);

    canvas.addEventListener('mousedown', onCanvasMouseDown, false);
    canvas.addEventListener('touchstart', onCanvasTouchStart, false);
    canvas.addEventListener('touchmove', touchHandlerDummy, false);
    canvas.addEventListener('touchend', touchHandlerDummy, false);

    displayControls();
    onWindowResize(null);
}

function touchHandlerDummy() {
    //need to fix this
    e.preventDefault();
    return false;
}


function zoomBy(amount) {
    ZOOM += amount;

    if (ZOOM <= MIN_ZOOM) {
        ZOOM = MIN_ZOOM;
    } else if (ZOOM >= MAX_ZOOM) {
        ZOOM = MAX_ZOOM;
    } else {
        dX = origX * ZOOM;
        dY = origY * ZOOM;
    }

    PanCanvas();
}


// WINDOW

function onWindowMouseMove(event) {
    mouseX = event.clientX;
    mouseY = event.clientY;
}

function onWindowResize() {
    SCREEN_WIDTH = window.innerWidth;
    SCREEN_HEIGHT = window.innerHeight;

    //menu.container.style.left = ((SCREEN_WIDTH - menu.container.offsetWidth) / 2) + 'px';

    about.container.style.top = ((SCREEN_HEIGHT - about.container.offsetHeight) / 2) + 'px';

    rooms.container.style.top = ((SCREEN_HEIGHT - about.container.offsetHeight) / 2) + 'px';
}

function onWindowKeyDown(event) {
    if (modalDialogOpen) return;

    switch (event.keyCode) {
    case 66:
        // b
        onMenuBG();
        break;
    case 67:
        // c
        colorKeyIsDown = true;
        if (event.shiftKey) {
          onMenuBackgroundColor(null, true);
        } else {
          onMenuForegroundColor(null, true);
        }
        break;

    case 16:
        // Shift
        pickerKeyIsDown = true;
        break;

    case 68:
        // d
        if (BRUSH_SIZE > 1) BRUSH_SIZE--;
        break;

    case 69:
        // e
        onMenuErase();
        break;

    case 70:
        // f
        BRUSH_SIZE++;
        break;

    case 80:
        // p
        onMenuPan();
        break;

    case 187:
        // =
        zoomBy(0.1);
        break;


    case 189:
        // -
        zoomBy(-0.1);
        break;


    }
}

function onWindowKeyUp(event) {
    switch (event.keyCode) {
    case 67:
        // c
        if (colorKeyIsDown) {
          cleanPopUps();
        }
        colorKeyIsDown = false;
        break;

    case 16:
        // Shift
        pickerKeyIsDown = false;
        break;

    case 82:
        // r
        changeBrush(window.MENU.selector.selectedIndex);
        break;

    case 66:
        // b
        document.body.style.backgroundImage = null;
        break;
    }

    window.CONTEXT.lineCap = BRUSH_SIZE == 1 ? 'butt' : 'round';
}

function onWindowBlur(event) {
    colorKeyIsDown = false;
    pickerKeyIsDown = false;
}


// DOCUMENT

function onDocumentMouseDown(event) {
    if (!isMenuMouseOver) event.preventDefault();
}

function onDocumentMouseOut(event) {
    onCanvasMouseUp();
}

function onDocumentDragEnter(event) {
    event.stopPropagation();
    event.preventDefault();
}

function onDocumentDragOver(event) {
    event.stopPropagation();
    event.preventDefault();
}

function onDocumentDrop(event) {
    event.stopPropagation();
    event.preventDefault();

    var file = event.dataTransfer.files[0];

    if (file.type.match(/image.*/)) {
        /*
         * TODO: This seems to work on Chromium. But not on Firefox.
         * Better wait for proper FileAPI?
         */

        var fileString = event.dataTransfer.getData('text').split("\n");
        document.body.style.backgroundImage = 'url(' + fileString[0] + ')';
    }
}
// BRUSH SELECTORS


function changeBrush(i) {
    if (brush) {
        brush.destroy();
    }

    newStroke = true;
    brush = eval("new " + BRUSHES[i] + "(window.CONTEXT)");
    brushName = BRUSHES[i];
}

// COLOR SELECTORS

function onForegroundColorSelectorChange(event) {
    lastColor = COLOR = foregroundColorSelector.getColor();

    window.MENU.setForegroundColor(COLOR);

}

function onBackgroundColorSelectorChange(event) {
    BACKGROUND_COLOR = backgroundColorSelector.getColor();

    window.MENU.setBackgroundColor(BACKGROUND_COLOR);

    document.body.style.backgroundColor = 'rgb(' + BACKGROUND_COLOR[0] + ', ' + BACKGROUND_COLOR[1] + ', ' + BACKGROUND_COLOR[2] + ')';

}


function setCanvasCursor() {
  if (panModeOn) {
    canvas.style.cursor = 'move';
  } else if (isEraseModeOn) {
    canvas.style.cursor = 'url(/images/eraser.png) 6 8, hand';
  } else {
    canvas.style.cursor = 'crosshair';
  }
}

// MENU


function onMenuForegroundColor(_, moveToMouse) {
    cleanPopUps();

    if (moveToMouse) {
        foregroundColorSelector.container.style.left = mouseX - 125 + 'px';
        foregroundColorSelector.container.style.top = mouseY - 125 + 'px';
        foregroundColorSelector.container.style.visibility = 'visible';
    } else {
      foregroundColorSelector.show();
      foregroundColorSelector.container.style.left = ((SCREEN_WIDTH - foregroundColorSelector.container.offsetWidth) / 2) + 'px';
      foregroundColorSelector.container.style.top = ((SCREEN_HEIGHT - foregroundColorSelector.container.offsetHeight) / 2) + 'px';
      foregroundColorSelector.container.style.zIndex = '1';
    }

    isFgColorSelectorVisible = true;
    modalDialogOpen = true;
}

function onMenuBackgroundColor(_, moveToMouse) {
    cleanPopUps();

    if (moveToMouse) {
        backgroundColorSelector.container.style.left = mouseX - 125 + 'px';
        backgroundColorSelector.container.style.top = mouseY - 125 + 'px';
        backgroundColorSelector.container.style.visibility = 'visible';
    } else {
      backgroundColorSelector.show();
      backgroundColorSelector.container.style.left = ((SCREEN_WIDTH - backgroundColorSelector.container.offsetWidth) / 2) + 'px';
      backgroundColorSelector.container.style.top = ((SCREEN_HEIGHT - backgroundColorSelector.container.offsetHeight) / 2) + 'px';
      backgroundColorSelector.container.style.zIndex = '1';
    }

    isBgColorSelectorVisible = true;
    modalDialogOpen = true;
}

function onMenuSelectorChange() {
    if (BRUSHES[window.MENU.selector.selectedIndex] == "") return;


    changeBrush(window.MENU.selector.selectedIndex);
    if (isEraseModeOn) {
      window.CONTEXT.globalCompositeOperation = "destination-out";
    }

}

function onMenuMouseOver() {
    isMenuMouseOver = true;
}

function onMenuMouseOut() {
    isMenuMouseOver = false;
}

function onMenuSave() {
    // window.open(canvas.toDataURL('image/png'),'mywindow');
    flatten();
    window.open(flattenCanvas.toDataURL('image/png'), 'mywindow');
}

function onMenuErase() {
    if (isEraseModeOn == true) {
        isEraseModeOn = false;

        window.CONTEXT.globalCompositeOperation = lastCompositeOperation;
        COLOR = lastColor;

        document.getElementById("erase").className = "button";
        setCanvasCursor();
        return;
    }

    //turn erase mode on
    isEraseModeOn = true;
    lastCompositeOperation = window.CONTEXT.globalCompositeOperation;

    window.CONTEXT.globalCompositeOperation = "destination-out";
    COLOR = [0,0,0];


    document.getElementById("erase").className = "button selected";
    setCanvasCursor();
}

function onMenuZoomIn(){
    zoomBy(0.1);
}

function onMenuZoomOut(){
    zoomBy(-0.1);
}
function onMenuPan() {
    if (panModeOn == true) {
        //turn pan mode off
        panModeOn = false;
        document.getElementById("pan").className = "button";
        panCoords = null;
        panStart = null;
        setCanvasCursor();
    } else {
      //turn pan mode on
      panModeOn = true;
      document.getElementById("pan").className = "button selected";
      setCanvasCursor();
    }

    displayControls();

}

function onMenuClear() {
    if (confirm("Are you sure you want to clear the canvas?")) {
      clearCanvas();
      SF.socket().emit('clear');
    }
}

function onMenuRooms(){
    if (isRoomsOpen == true){
        cleanPopUps();
    } else {
      isRoomsOpen = true;
      document.getElementById("rooms").className = "button selected";
    }

    displayControls();
}

function PanCanvas() {

    var x = parseInt(dX / ZOOM, 10);
    var y = parseInt(dY / ZOOM, 10);

    canvas.style.transform = "translate(" + x + "px," + y + "px)";
    canvas.style.msTransform = "translate(" + x + "px," + y + "px)";
    canvas.style.webkitTransform = "translate(" + x + "px," + y + "px)";
    canvas.style.MozTransform = "translate(" + x + "px," + y + "px) scale(" + ZOOM +")";
    canvas.style.oTransform = "translate(" + x + "px," + y + "px)";

    canvas.style.zoom = ZOOM;

    bgcanvas.style.transform = "translate(" + x + "px," + y + "px)";
    bgcanvas.style.msTransform = "translate(" + x + "px," + y + "px)";
    bgcanvas.style.webkitTransform = "translate(" + x + "px," + y + "px)";
    bgcanvas.style.MozTransform = "translate(" + x + "px," + y + "px) scale(" + ZOOM +")";
    bgcanvas.style.oTransform = "translate(" + x + "px," + y + "px)";

    bgcanvas.style.zoom = ZOOM;
    origX = x;
    origY = y;
}

function clearCanvas() {

    window.bgcanvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    window.fgcanvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);

    changeBrush(window.MENU.selector.selectedIndex);
}

function onMenuBG() {
  if (isBackground) {
    isBackground = false;

    window.CONTEXT = fgcanvas.getContext("2d");
    brush.context = window.CONTEXT;
    document.getElementById("bg-layer").className = "button";
    bgcanvas.style.opacity = "0.5";
    fgcanvas.style.opacity = "1";
  } else {
    isBackground = true;
    window.CONTEXT = bgcanvas.getContext("2d");
    brush.context = window.CONTEXT;
    document.getElementById("bg-layer").className = "button selected";

    fgcanvas.style.opacity = "0.5";
    bgcanvas.style.opacity = "1";
  }

  onMenuSelectorChange();
}

function onMenuAbout() {
    cleanPopUps();

    about.show();
    isAboutVisible = true;
    modalDialogOpen = true;
}

function onMenuJoin() {
    cleanPopUps();

    rooms.update();
    rooms.show();

    isRoomsVisible = true;
    modalDialogOpen = true;
}



// INPUT HELPERS

function inputStart(x, y) {
    if (panModeOn) {
      panStart = [x - dX, y - dY];

      return;
    }

    // TODO: Actually get color picker working
    if (pickerKeyIsDown) {
        flatten();

        data = flattenCanvas.getContext("2d").getImageData(0, 0, flattenCanvas.width, flattenCanvas.height).data;
        position = (x / ZOOM + (y / ZOOM * canvas.width)) * 5;

        foregroundColorSelector.setColor([data[position], data[position + 1], data[position + 2]]);

        return;
    }

    if (isEraseModeOn) {
      BRUSH_PRESSURE = 1;
    } else {
      BRUSH_PRESSURE = wacom && wacom.isWacom ? wacom.pressure : 1;
    }

    var xScaled = parseInt((-dX + x) / ZOOM, 10);
    var yScaled = parseInt((-dY + y) / ZOOM, 10);

    brush.strokeStart(xScaled, yScaled);

    strokeCoordinates = [[xScaled, yScaled]];

    prevX = xScaled;
    prevY = yScaled;
}

function inputContinue(x, y) {
    if (pickerKeyIsDown) {
      return;
    }

    if (panModeOn) {
        panCoords = [x, y];
        dX = panCoords[0] - panStart[0];
        dY = panCoords[1] - panStart[1];

        PanCanvas();

        return;
    }


    if (isEraseModeOn) {
      BRUSH_PRESSURE = 1;
    } else {
      BRUSH_PRESSURE = wacom && wacom.isWacom ? wacom.pressure : 1;
    }

    var xScaled = parseInt((-dX + x) / ZOOM, 10);
    var yScaled = parseInt((-dY + y) / ZOOM, 10);

    brush.stroke(xScaled, yScaled);


    if (strokeCoordinates) {
      strokeCoordinates.push([xScaled - prevX, yScaled - prevY]);
    }

    prevX = xScaled;
    prevY = yScaled;
}

function inputEnd() {
    if (panModeOn) {
        panOffset = [dX, dY];
        return;
    }

    brush.strokeEnd();
    if (strokeCoordinates && strokeCoordinates.length >= 1) {
        var stroke_data = {
            brush: brushName,
            coords: strokeCoordinates,
            color: COLOR,
        };

        if (isEraseModeOn) {
          stroke_data.erase = 1;
        }

        if (newStroke) {
          stroke_data.lift = 1;
        }

        if (isBackground) {
          stroke_data.bg = 1;
        }

        SF.socket().emit('stroke', stroke_data);


    }

    newStroke = false;
    strokeCoordinates = null;
}

// CANVAS

function onCanvasMouseDown(event) {
    var data, position;

    cleanPopUps();

    window.addEventListener('mousemove', onCanvasMouseMove, false);
    window.addEventListener('mouseup', onCanvasMouseUp, false);

    inputStart(event.clientX, event.clientY);

}

function onCanvasMouseMove(event) {
    inputContinue(event.clientX, event.clientY);
}

function onCanvasMouseUp() {
    window.removeEventListener('mousemove', onCanvasMouseMove, false);
    window.removeEventListener('mouseup', onCanvasMouseUp, false);

    inputEnd();

}


function onCanvasTouchStart(event) {
    cleanPopUps();
    event.preventDefault();

    if (event.touches.length == 1) {
        window.addEventListener('touchmove', onCanvasTouchMove, false);
        window.addEventListener('touchend', onCanvasTouchEnd, false);

        inputStart(event.targetTouches[0].pageX, event.targetTouches[0].pageY);
    }
}

function onCanvasTouchMove(event) {
    if (event.touches.length == 1) {
        event.preventDefault();

        inputContinue(event.targetTouches[0].pageX, event.targetTouches[0].pageY);
    }
}

function onCanvasTouchEnd(event) {
    event.preventDefault();
    if (event.touches.length == 0) {
        window.removeEventListener('touchmove', onCanvasTouchMove, false);
        window.removeEventListener('touchend', onCanvasTouchEnd, false);

        inputEnd();
    }
}

//

function saveToLocalStorage() {
    localStorage.canvas = canvas.toDataURL('image/png');
}

function flatten() {
    var context = flattenCanvas.getContext("2d");

    context.fillStyle = 'rgb(' + BACKGROUND_COLOR[0] + ', ' + BACKGROUND_COLOR[1] + ', ' + BACKGROUND_COLOR[2] + ')';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(window.bgcanvas, 0, 0);
    context.drawImage(window.fgcanvas, 0, 0);
}

function cleanPopUps() {
    if (isFgColorSelectorVisible) {
        foregroundColorSelector.hide();
        isFgColorSelectorVisible = false;
        SF.socket().emit('new-fgcolor', [COLOR[0], COLOR[1], COLOR[2]]);
    }

    if (isBgColorSelectorVisible) {
        backgroundColorSelector.hide();
        isBgColorSelectorVisible = false;
        SF.socket().emit('new-bgcolor', [BACKGROUND_COLOR[0], BACKGROUND_COLOR[1], BACKGROUND_COLOR[2]]);
    }

    if (isAboutVisible) {
        about.hide();
        isAboutVisible = false;
    }

    if (isRoomsVisible) {
        rooms.hide();
        isRoomsVisible = false;
    }

    if (isRoomsOpen) {
      isRoomsOpen = false;
      document.getElementById("rooms").className = "button";
    }

    modalDialogOpen = false;
    displayControls();
}

function displayControls() {
    if (isRoomsOpen) {
      document.getElementById('pan').style.display = 'none';
      document.getElementById('roomControls').style.display = 'inline-block';
      document.getElementById('zoomControls').style.display = 'none';
      document.getElementById('brushControls').style.display = 'none';
    } else if (panModeOn) {
      document.getElementById('pan').style.display = 'inline-block';
      document.getElementById('roomControls').style.display = 'none';
      document.getElementById('zoomControls').style.display = 'inline-block';
      document.getElementById('brushControls').style.display = 'none';
    } else {
      document.getElementById('pan').style.display = 'inline-block';
      document.getElementById('roomControls').style.display = 'none';
      document.getElementById('zoomControls').style.display = 'none';
      document.getElementById('brushControls').style.display = 'inline-block';
    }
}

window.clearCanvas = clearCanvas;

module.exports = {
  init: init
};
