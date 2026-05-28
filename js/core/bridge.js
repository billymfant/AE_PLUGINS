'use strict';

window.Bridge = (function() {
  var _cs = null;

  function cs() {
    if (!_cs) _cs = new CSInterface();
    return _cs;
  }

  function call(action, params) {
    return new Promise(function(resolve, reject) {
      var paramsJSON = JSON.stringify(params || {});
      // Escape backslashes and quotes for safe evalScript injection
      var escaped = paramsJSON.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      var script = 'dispatch("' + action + '", "' + escaped + '")';

      cs().evalScript(script, function(result) {
        if (result === 'EvalScript Error' || result === null || result === undefined) {
          reject(new Error('ExtendScript error for: ' + action));
          return;
        }
        try {
          resolve(JSON.parse(result));
        } catch(e) {
          resolve({ raw: result });
        }
      });
    });
  }

  function evalRaw(script) {
    return new Promise(function(resolve, reject) {
      cs().evalScript(script, function(result) {
        if (result === 'EvalScript Error') {
          reject(new Error('evalRaw error: ' + script.slice(0, 80)));
          return;
        }
        resolve(result);
      });
    });
  }

  function getAEVersion() {
    return evalRaw('app.version');
  }

  return { call: call, evalRaw: evalRaw, getAEVersion: getAEVersion };
})();
