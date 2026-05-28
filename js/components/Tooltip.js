'use strict';

window.Tooltip = (function() {
  var _el = null;

  function init() {
    _el = document.createElement('div');
    _el.className = 'tooltip-float';
    _el.style.display = 'none';
    document.body.appendChild(_el);

    document.addEventListener('mousemove', function(e) {
      if (_el.style.display !== 'none') {
        var x = Math.min(e.clientX + 14, window.innerWidth - 220);
        _el.style.left = x + 'px';
        _el.style.top  = Math.max(4, e.clientY - 38) + 'px';
      }
    });

    document.addEventListener('mouseover', function(e) {
      var el = e.target && e.target.closest ? e.target.closest('[data-tooltip]') : null;
      if (el) {
        _el.textContent = el.getAttribute('data-tooltip');
        _el.style.display = 'block';
      }
    });

    document.addEventListener('mouseout', function(e) {
      var to = e.relatedTarget;
      var stillInside = to && to.closest && to.closest('[data-tooltip]');
      if (!stillInside) _el.style.display = 'none';
    });
  }

  return { init: init };
})();
