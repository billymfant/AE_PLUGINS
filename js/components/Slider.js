'use strict';

function Slider(config) {
  this.label        = config.label        || '';
  this.min          = config.min          !== undefined ? config.min   : 0;
  this.max          = config.max          !== undefined ? config.max   : 100;
  this.value        = config.value        !== undefined ? config.value : this.min;
  this.step         = config.step         || 1;
  this.decimals     = config.decimals     !== undefined ? config.decimals : 0;
  this.unit         = config.unit         || '';
  this.defaultValue = config.defaultValue !== undefined ? config.defaultValue : undefined;
  this.tooltip      = config.tooltip      || '';
  this.onChange     = config.onChange     || function() {};
  this.el = this._build();
}

Slider.prototype._fillTrack = function(track) {
  var pct = ((track.value - track.min) / (track.max - track.min) * 100).toFixed(1);
  track.style.setProperty('--track-fill', pct + '%');
};

Slider.prototype._build = function() {
  var self  = this;
  var wrap  = Utils.el('div', { class: 'component-slider' });
  var hdr   = Utils.el('div', { class: 'slider-header' });
  var label = Utils.el('span', { class: 'slider-label' }, this.label);

  var input = document.createElement('input');
  input.type      = 'number';
  input.className = 'slider-input';
  input.min       = this.min;
  input.max       = this.max;
  input.step      = this.step;
  input.value     = this.value;

  var track = document.createElement('input');
  track.type      = 'range';
  track.className = 'slider-track';
  track.min       = this.min;
  track.max       = this.max;
  track.step      = this.step;
  track.value     = this.value;

  hdr.appendChild(label);
  hdr.appendChild(input);

  if (this.defaultValue !== undefined) {
    var resetBtn = document.createElement('button');
    resetBtn.className   = 'slider-reset';
    resetBtn.title       = 'Reset to ' + this.defaultValue;
    resetBtn.textContent = '↺';
    resetBtn.addEventListener('click', function(e) {
      e.preventDefault();
      self.setValue(self.defaultValue);
      self.onChange(self.defaultValue);
    });
    hdr.appendChild(resetBtn);
  }

  wrap.appendChild(hdr);
  wrap.appendChild(track);

  if (this.tooltip) wrap.setAttribute('data-tooltip', this.tooltip);

  self._fillTrack(track);

  var debounced = Utils.debounce(function(v) { self.onChange(v); }, 120);

  track.addEventListener('input', function() {
    var v = parseFloat(track.value);
    input.value = Utils.round(v, self.decimals);
    self.value  = v;
    self._fillTrack(track);
    debounced(v);
  });

  input.addEventListener('change', function() {
    var v = Utils.clamp(parseFloat(input.value) || 0, self.min, self.max);
    v = Utils.round(v, self.decimals);
    input.value = v;
    track.value = v;
    self.value  = v;
    self._fillTrack(track);
    self.onChange(v);
  });

  this._track = track;
  this._input = input;
  return wrap;
};

Slider.prototype.setValue = function(val) {
  var v = Utils.clamp(val, this.min, this.max);
  this.value        = v;
  this._track.value = v;
  this._input.value = Utils.round(v, this.decimals);
  this._fillTrack(this._track);
};

Slider.prototype.setEnabled = function(enabled) {
  this._track.disabled = !enabled;
  this._input.disabled = !enabled;
  this.el.style.opacity = enabled ? '' : '0.35';
};
