'use strict';

function ButtonGroup(config) {
  this.label    = config.label    || '';
  this.options  = config.options  || [];   // [{value, label}]
  this.value    = config.value    !== undefined ? config.value : (this.options[0] ? this.options[0].value : '');
  this.tooltip  = config.tooltip  || '';
  this.onChange = config.onChange || function() {};
  this.el = this._build();
}

ButtonGroup.prototype._build = function() {
  var self = this;
  var wrap = Utils.el('div', { class: 'component-btn-group' });

  if (this.label) {
    wrap.appendChild(Utils.el('span', { class: 'btn-group-label' }, this.label));
  }

  var row = Utils.el('div', { class: 'btn-group-buttons' });
  this._buttons = {};

  this.options.forEach(function(opt) {
    var btn = Utils.el('button', {}, opt.label || opt.value);
    if (String(opt.value) === String(self.value)) btn.classList.add('active');
    btn.addEventListener('click', function() {
      self._setActive(opt.value);
      self.onChange(opt.value);
    });
    self._buttons[opt.value] = btn;
    row.appendChild(btn);
  });

  wrap.appendChild(row);
  if (this.tooltip) wrap.setAttribute('data-tooltip', this.tooltip);
  return wrap;
};

ButtonGroup.prototype._setActive = function(val) {
  var self = this;
  this.value = val;
  Object.keys(this._buttons).forEach(function(k) {
    self._buttons[k].classList.toggle('active', String(k) === String(val));
  });
};

ButtonGroup.prototype.setValue = function(val) {
  this._setActive(val);
};
