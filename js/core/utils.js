'use strict';

window.Utils = {
  clamp: function(val, min, max) {
    return Math.min(Math.max(val, min), max);
  },

  round: function(val, decimals) {
    return +parseFloat(val).toFixed(decimals === undefined ? 2 : decimals);
  },

  debounce: function(fn, delay) {
    var timer;
    return function() {
      var args = arguments;
      var ctx = this;
      clearTimeout(timer);
      timer = setTimeout(function() { fn.apply(ctx, args); }, delay);
    };
  },

  deepClone: function(obj) {
    return JSON.parse(JSON.stringify(obj));
  },

  hexToRgb: function(hex) {
    var r = parseInt(hex.slice(1, 3), 16) / 255;
    var g = parseInt(hex.slice(3, 5), 16) / 255;
    var b = parseInt(hex.slice(5, 7), 16) / 255;
    return [r, g, b];
  },

  rgbToHex: function(r, g, b) {
    function toHex(n) {
      var h = Math.round(n * 255).toString(16);
      return h.length === 1 ? '0' + h : h;
    }
    return '#' + toHex(r) + toHex(g) + toHex(b);
  },

  el: function(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function(k) {
        if (k === 'class') el.className = attrs[k];
        else if (k === 'style') el.style.cssText = attrs[k];
        else el.setAttribute(k, attrs[k]);
      });
    }
    if (children) {
      if (typeof children === 'string') el.textContent = children;
      else if (Array.isArray(children)) children.forEach(function(c) { if (c) el.appendChild(c); });
      else el.appendChild(children);
    }
    return el;
  },

  escapeHtml: function(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
};
