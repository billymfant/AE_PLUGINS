'use strict';

var Sections = (function () {
  function _siblingsUntilNextLabel(label) {
    var out = [], n = label.nextElementSibling;
    while (n && !n.classList.contains('section-label')) {
      out.push(n);
      n = n.nextElementSibling;
    }
    return out;
  }

  function makeCollapsible(container) {
    var labels = container.querySelectorAll('.section-label');
    Array.prototype.forEach.call(labels, function (label) {
      if (label.getAttribute('data-collapsible')) return;
      label.setAttribute('data-collapsible', '1');

      var chev = document.createElement('span');
      chev.className = 'sec-chevron';
      chev.textContent = '▾';
      label.insertBefore(chev, label.firstChild);

      label.addEventListener('click', function () {
        var collapsed = label.classList.toggle('collapsed');
        var sibs = _siblingsUntilNextLabel(label);
        for (var i = 0; i < sibs.length; i++) {
          sibs[i].style.display = collapsed ? 'none' : '';
        }
      });
    });
  }

  return { makeCollapsible: makeCollapsible };
}());
