'use strict';

function Toggle(config) {
  this.label    = config.label    || '';
  this.value    = config.value    !== undefined ? !!config.value : false;
  this.tooltip  = config.tooltip  || '';
  this.onChange = config.onChange || function() {};
  this.el = this._build();
}

Toggle.prototype._build = function() {
  var self  = this;
  var wrap  = Utils.el('label', { class: 'component-toggle' });
  var label = Utils.el('span',  { class: 'toggle-label' }, this.label);

  var sw    = Utils.el('span', { class: 'toggle-switch' });
  var input = document.createElement('input');
  input.type    = 'checkbox';
  input.checked = this.value;

  var track = Utils.el('span', { class: 'toggle-track' });

  sw.appendChild(input);
  sw.appendChild(track);

  wrap.appendChild(label);
  wrap.appendChild(sw);

  input.addEventListener('change', function() {
    self.value = input.checked;
    self.onChange(input.checked);
  });

  this._input = input;
  if (this.tooltip) wrap.setAttribute('data-tooltip', this.tooltip);
  return wrap;
};

Toggle.prototype.setValue = function(val) {
  this.value        = !!val;
  this._input.checked = this.value;
};
