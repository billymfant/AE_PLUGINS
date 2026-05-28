var PresetsIO = (function() {

  function _getDir(pluginId) {
    var base = new Folder(Folder.userData.fsName + '/AE Plugin Suite/presets/' + pluginId);
    if (!base.exists) base.create();
    return base;
  }

  function _safeName(name) {
    return name.replace(/[^a-zA-Z0-9_\-\s]/g, '_').replace(/\s+/g, '_');
  }

  function save(params) {
    try {
      var dir  = _getDir(params.pluginId);
      var file = new File(dir.fsName + '/' + _safeName(params.name) + '.json');
      file.encoding = 'UTF-8';
      file.open('w');
      file.write(params.data);
      file.close();
      return { success: true };
    } catch(e) {
      return { error: e.toString() };
    }
  }

  function list(params) {
    try {
      var dir   = _getDir(params.pluginId);
      var files = dir.getFiles('*.json');
      var names = [];
      for (var i = 0; i < files.length; i++) {
        names.push(files[i].displayName.replace(/\.json$/i, '').replace(/_/g, ' '));
      }
      return { presets: names };
    } catch(e) {
      return { error: e.toString() };
    }
  }

  function get(params) {
    try {
      var dir  = _getDir(params.pluginId);
      var file = new File(dir.fsName + '/' + _safeName(params.name) + '.json');
      if (!file.exists) return { error: 'Preset not found: ' + params.name };
      file.encoding = 'UTF-8';
      file.open('r');
      var data = file.read();
      file.close();
      return JSON.parse(data);
    } catch(e) {
      return { error: e.toString() };
    }
  }

  function del(params) {
    try {
      var dir  = _getDir(params.pluginId);
      var file = new File(dir.fsName + '/' + _safeName(params.name) + '.json');
      if (file.exists) file.remove();
      return { success: true };
    } catch(e) {
      return { error: e.toString() };
    }
  }

  return { save: save, list: list, get: get, 'delete': del };
})();
