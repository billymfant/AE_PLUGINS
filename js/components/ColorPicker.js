'use strict';

function ColorPicker(config) {
  this.label    = config.label    || '';
  this.value    = config.value    || '#ffffff';  // hex string
  this.tooltip  = config.tooltip  || '';
  this.onChange = config.onChange || function() {};
  this.el = this._build();
}

ColorPicker.prototype._build = function() {
  var self  = this;
  var wrap  = Utils.el('div', { class: 'component-color' });

  if (this.label) {
    wrap.appendChild(Utils.el('span', { class: 'color-label' }, this.label));
  }

  var row    = Utils.el('div', { class: 'color-row' });
  var swatch = Utils.el('div', { class: 'color-swatch' });
  var native = document.createElement('input');
  native.type  = 'color';
  native.value = this.value;
  swatch.style.background = this.value;
  swatch.appendChild(native);

  var hex = document.createElement('input');
  hex.type      = 'text';
  hex.className = 'color-hex';
  hex.value     = this.value;
  hex.maxLength = 7;
  hex.placeholder = '#rrggbb';

  function update(color) {
    swatch.style.background = color;
    native.value = color;
    hex.value    = color;
    self.value   = color;
    self.onChange(color);
  }

  native.addEventListener('input', function() {
    update(native.value);
  });

  hex.addEventListener('change', function() {
    var v = hex.value.trim();
    if (!v.startsWith('#')) v = '#' + v;
    if (/^#[0-9a-f]{6}$/i.test(v)) update(v);
    else hex.value = self.value;
  });

  row.appendChild(swatch);
  row.appendChild(hex);
  wrap.appendChild(row);

  this._native = native;
  this._hex    = hex;
  this._swatch = swatch;
  if (this.tooltip) wrap.setAttribute('data-tooltip', this.tooltip);
  return wrap;
};

ColorPicker.prototype.setValue = function(hex) {
  this.value           = hex;
  this._native.value   = hex;
  this._hex.value      = hex;
  this._swatch.style.background = hex;
};

ColorPicker.prototype.getRgb = function() {
  return Utils.hexToRgb(this.value);
};
