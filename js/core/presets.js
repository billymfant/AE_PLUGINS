'use strict';

window.Presets = (function() {
  var PRESET_VERSION = '1.0';

  function _factory(pluginId) {
    return (window.FactoryPresets && window.FactoryPresets[pluginId]) || {};
  }

  function save(pluginId, name, params) {
    var preset = {
      preset_name: name,
      version: PRESET_VERSION,
      plugin: pluginId,
      params: params,
      metadata: { created: new Date().toISOString() }
    };
    return Bridge.call('presets.save', {
      pluginId: pluginId,
      name: name,
      data: JSON.stringify(preset)
    });
  }

  function list(pluginId) {
    var factoryNames = Object.keys(_factory(pluginId));
    return Bridge.call('presets.list', { pluginId: pluginId }).then(function(result) {
      var user = (result && result.presets) ? result.presets : [];
      // Remove any user presets that clash with factory names
      var userFiltered = user.filter(function(n) { return factoryNames.indexOf(n) === -1; });
      return { presets: factoryNames, userPresets: userFiltered };
    }).catch(function() {
      return { presets: factoryNames, userPresets: [] };
    });
  }

  function get(pluginId, name) {
    var f = _factory(pluginId);
    if (f[name]) {
      return Promise.resolve({ params: f[name], preset_name: name, plugin: pluginId });
    }
    return Bridge.call('presets.get', { pluginId: pluginId, name: name });
  }

  function del(pluginId, name) {
    return Bridge.call('presets.delete', { pluginId: pluginId, name: name });
  }

  function isFactory(pluginId, name) {
    return !!_factory(pluginId)[name];
  }

  return { save: save, list: list, get: get, 'delete': del, isFactory: isFactory };
})();
