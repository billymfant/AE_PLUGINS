'use strict';

function PresetBar(config) {
  this.pluginId    = config.pluginId;
  this.onLoad      = config.onLoad    || function() {};
  this.getParams   = config.getParams || function() { return {}; };
  this._factory    = [];
  this._user       = [];
  this.el = this._build();
  this._refresh();
}

PresetBar.prototype._build = function() {
  var self = this;
  var bar  = Utils.el('div', { class: 'preset-bar' });

  var wrap = Utils.el('div', { class: 'preset-select-wrap' });
  var sel  = document.createElement('select');
  sel.addEventListener('change', function() {
    if (sel.value) self._load(sel.value);
  });
  wrap.appendChild(sel);
  this._select = sel;

  var saveBtn = this._iconBtn(
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 13H3V3l3-1h5l2 2v9z"/><rect x="5" y="8" width="6" height="5" rx="0.5"/><rect x="5" y="2" width="4" height="3" rx="0.5"/></svg>',
    'Save preset'
  );
  saveBtn.addEventListener('click', function() { self._save(); });

  var delBtn = this._iconBtn(
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 4h10M6 4V3h4v1M5 4v8h6V4"/><line x1="7" y1="7" x2="7" y2="10"/><line x1="9" y1="7" x2="9" y2="10"/></svg>',
    'Delete preset'
  );
  delBtn.addEventListener('click', function() { self._delete(); });
  this._delBtn = delBtn;

  bar.appendChild(wrap);
  bar.appendChild(saveBtn);
  bar.appendChild(delBtn);
  return bar;
};

PresetBar.prototype._iconBtn = function(svgHtml, title) {
  var btn = Utils.el('button', { class: 'icon-btn', title: title });
  btn.innerHTML = svgHtml;
  return btn;
};

PresetBar.prototype._refresh = function() {
  var self = this;
  Presets.list(this.pluginId).then(function(result) {
    self._factory = (result && result.presets)     ? result.presets     : [];
    self._user    = (result && result.userPresets) ? result.userPresets : [];
    self._renderOptions();
  }).catch(function() {
    self._renderOptions();
  });
};

PresetBar.prototype._renderOptions = function() {
  var self   = this;
  var prev   = this._select.value;
  this._select.innerHTML = '';

  if (this._factory.length > 0) {
    var factoryGroup = document.createElement('optgroup');
    factoryGroup.label = 'Built-in';
    this._factory.forEach(function(name) {
      factoryGroup.appendChild(Utils.el('option', { value: name }, name));
    });
    this._select.appendChild(factoryGroup);
  }

  if (this._user.length > 0) {
    var userGroup = document.createElement('optgroup');
    userGroup.label = 'My Presets';
    this._user.forEach(function(name) {
      userGroup.appendChild(Utils.el('option', { value: name }, name));
    });
    this._select.appendChild(userGroup);
  }

  if (prev) this._select.value = prev;
  this._updateDeleteBtn();
};

PresetBar.prototype._updateDeleteBtn = function() {
  var name      = this._select.value;
  var isFactory = name && Presets.isFactory(this.pluginId, name);
  this._delBtn.style.opacity      = isFactory ? '0.3' : '';
  this._delBtn.style.pointerEvents = isFactory ? 'none' : '';
};

PresetBar.prototype._load = function(name) {
  var self = this;
  this._updateDeleteBtn();
  Presets.get(this.pluginId, name).then(function(preset) {
    if (preset && preset.params) self.onLoad(preset.params);
  });
};

PresetBar.prototype._save = function() {
  var name = window.prompt('Preset name:', 'My Preset');
  if (!name) return;
  var params = this.getParams();
  var self   = this;
  Presets.save(this.pluginId, name, params).then(function() {
    self._refresh();
    setTimeout(function() { self._select.value = name; }, 200);
  });
};

PresetBar.prototype._delete = function() {
  var name = this._select.value;
  if (!name) return;
  if (Presets.isFactory(this.pluginId, name)) return;
  if (!window.confirm('Delete preset "' + name + '"?')) return;
  var self = this;
  Presets['delete'](this.pluginId, name).then(function() { self._refresh(); });
};
