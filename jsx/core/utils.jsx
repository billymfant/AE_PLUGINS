// JSON polyfill for older ExtendScript engines
if (typeof JSON === 'undefined') {
  JSON = {};
}

if (typeof JSON.stringify !== 'function') {
  JSON.stringify = function(val) {
    var t = typeof val;
    if (t === 'undefined') return undefined;
    if (val === null)      return 'null';
    if (t === 'boolean')   return val ? 'true' : 'false';
    if (t === 'number')    return isFinite(val) ? String(val) : 'null';
    if (t === 'string')    return '"' + val.replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\n/g,'\\n').replace(/\r/g,'\\r').replace(/\t/g,'\\t') + '"';
    if (t === 'object') {
      var s, i;
      if (val instanceof Array) {
        s = '[';
        for (i = 0; i < val.length; i++) {
          if (i > 0) s += ',';
          var sv = JSON.stringify(val[i]);
          s += (sv === undefined) ? 'null' : sv;
        }
        return s + ']';
      }
      s = '{';
      var first = true;
      for (var k in val) {
        if (!val.hasOwnProperty(k)) continue;
        var v = JSON.stringify(val[k]);
        if (v === undefined) continue;
        if (!first) s += ',';
        s += JSON.stringify(k) + ':' + v;
        first = false;
      }
      return s + '}';
    }
    return undefined;
  };
}

if (typeof JSON.parse !== 'function') {
  JSON.parse = function(str) {
    return eval('(' + str + ')');
  };
}

// Shared helpers
function getActiveComp() {
  var item = app.project.activeItem;
  if (!item || !(item instanceof CompItem)) return null;
  return item;
}

function requireComp() {
  var comp = getActiveComp();
  if (!comp) throw new Error('No active composition. Please open or select a composition first.');
  return comp;
}

function hsvToRgb(h, s, v) {
  var r, g, b;
  var i = Math.floor(h * 6);
  var f = h * 6 - i;
  var p = v * (1 - s);
  var q = v * (1 - f * s);
  var t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return [r, g, b, 1];
}

function hexToRgb(hex) {
  hex = hex.replace('#','');
  return [
    parseInt(hex.substr(0,2),16)/255,
    parseInt(hex.substr(2,2),16)/255,
    parseInt(hex.substr(4,2),16)/255,
    1
  ];
}

function blendModeFromString(s) {
  var m = {
    'normal':   BlendingMode.NORMAL,
    'screen':   BlendingMode.SCREEN,
    'add':      BlendingMode.ADD,
    'overlay':  BlendingMode.OVERLAY,
    'multiply': BlendingMode.MULTIPLY,
    'lighten':  BlendingMode.LIGHTEN,
    'darken':   BlendingMode.DARKEN
  };
  return m[s] || BlendingMode.SCREEN;
}
