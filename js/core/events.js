'use strict';

window.Events = (function() {
  var _listeners = {};

  return {
    on: function(event, fn) {
      if (!_listeners[event]) _listeners[event] = [];
      _listeners[event].push(fn);
    },

    off: function(event, fn) {
      if (!_listeners[event]) return;
      _listeners[event] = _listeners[event].filter(function(f) { return f !== fn; });
    },

    once: function(event, fn) {
      var self = this;
      function wrapper(data) {
        fn(data);
        self.off(event, wrapper);
      }
      this.on(event, wrapper);
    },

    emit: function(event, data) {
      var fns = _listeners[event];
      if (!fns) return;
      fns.slice().forEach(function(fn) { fn(data); });
    }
  };
})();
