function addClickListener(el, handler) {
  var lastHandled = 0;
  var throttledHandler = function() {
    var now = Date.now();
    if (now - lastHandled > 50) {
      handler.apply(this, arguments);
      lastHandled = now;
    }
  };

  if ('ontouchstart' in document.documentElement) {
    el.addEventListener('touchstart', throttledHandler, false);
  } else {
    el.addEventListener('click', throttledHandler, false);
  }
}
window.addClickListener = addClickListener;
