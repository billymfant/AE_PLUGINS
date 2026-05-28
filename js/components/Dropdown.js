'use strict';

function Dropdown(config) {
  this.label    = config.label    || '';
  this.options  = config.options  || [];   // [{value, label}] or ['value']
  this.value    = config.value    !== undefined ? config.value : (this.options[0] ? (this.options[0].value !== undefined ? this.options[0].value : this.options[0]) : '');
  this.tooltip  = config.tooltip  || '';
  this.onChange = config.onChange || function() {};
  this.el = this._build();
}

Dropdown.prototype._build = function() {
  var self = this;
  var wrap = Utils.el('div', { class: 'component-dropdown' });

  if (this.label) {
    wrap.appendChild(Utils.el('span', { class: 'dropdown-label' }, this.label));
  }

  var sel = document.createElement('select');
  this._select = sel;
  this._populate();

  sel.addEventListener('change', function() {
    self.value = sel.value;
    self.onChange(sel.value);
  });

  wrap.appendChild(sel);
  if (this.tooltip) wrap.setAttribute('data-tooltip', this.tooltip);
  return wrap;
};

Dropdown.prototype._populate = function() {
  var self = this;
  this._select.innerHTML = '';
  this.options.forEach(function(opt) {
    var value = (opt.value !== undefined) ? opt.value : opt;
    var label = (opt.label !== undefined) ? opt.label : opt;
    var option = Utils.el('option', { value: value }, label);
    if (String(value) === String(self.value)) option.selected = true;
    self._select.appendChild(option);
  });
};

Dropdown.prototype.setValue = function(val) {
  this.value = val;
  this._select.value = val;
};

Dropdown.prototype.setOptions = function(options) {
  this.options = options;
  this._populate();
};
