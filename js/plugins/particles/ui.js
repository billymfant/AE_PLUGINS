'use strict';

window.ParticlesUI = (function () {
  var _state = {
    emitterType:       'point',
    emitterX:          50, emitterY: 80,
    emitterSizeX:      100, emitterSizeY: 100,
    rate:              8,
    maxParticles:      100,
    life:              1.5,
    lifeVariance:      0.3,
    direction:         -90,
    spread:            30,
    velocity:          200,
    velocityVariance:  0.4,
    gravityX:          0,
    gravityY:          200,
    wind:              0,
    turbulence:        0,
    drag:              0.02,
    sizeStart:         10, sizeEnd:      2,
    opacityStart:      100, opacityEnd:  0,
    color:             '#ffffff',
    duration:          3
  };

  function getParams()    { return Utils.deepClone(_state); }
  function applyPreset(p) {
    Object.assign(_state, p);
    _emitterGroup.setValue(p.emitterType);
    _sliders.emitterX.setValue(p.emitterX);       _sliders.emitterY.setValue(p.emitterY);
    _sliders.emitterSizeX.setValue(p.emitterSizeX); _sliders.emitterSizeY.setValue(p.emitterSizeY);
    _sliders.rate.setValue(p.rate);
    _sliders.maxParticles.setValue(p.maxParticles);
    _sliders.life.setValue(p.life);
    _sliders.lifeVariance.setValue(p.lifeVariance * 100);
    _sliders.direction.setValue(p.direction);
    _sliders.spread.setValue(p.spread);
    _sliders.velocity.setValue(p.velocity);
    _sliders.velocityVariance.setValue(p.velocityVariance * 100);
    _sliders.gravityX.setValue(p.gravityX);       _sliders.gravityY.setValue(p.gravityY);
    _sliders.wind.setValue(p.wind);               _sliders.turbulence.setValue(p.turbulence);
    _sliders.drag.setValue(p.drag * 100);
    _sliders.sizeStart.setValue(p.sizeStart);     _sliders.sizeEnd.setValue(p.sizeEnd);
    _sliders.opacityStart.setValue(p.opacityStart); _sliders.opacityEnd.setValue(p.opacityEnd);
    _color.setValue(p.color);
    _sliders.duration.setValue(p.duration);
  }

  var _sliders = {};
  var _emitterGroup, _color, _status;

  function init(container) {
    // ── Emitter ───────────────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Emitter'));
    _emitterGroup = new ButtonGroup({
      options: [{ value:'point',label:'Point' },{ value:'box',label:'Box' },{ value:'ring',label:'Ring' }],
      value: 'point',
      tooltip: 'Point: single origin, Box: rectangular area, Ring: circular ring',
      onChange: function(v){ _state.emitterType=v; }
    });
    container.appendChild(_emitterGroup.el);

    var emPosRow = Utils.el('div', { class: 'row-2' });
    _sliders.emitterX = new Slider({ label: 'Emitter X %', min:0, max:100, value:50, step:1, defaultValue:50, onChange:function(v){_state.emitterX=v;} });
    _sliders.emitterY = new Slider({ label: 'Emitter Y %', min:0, max:100, value:80, step:1, defaultValue:80, onChange:function(v){_state.emitterY=v;} });
    emPosRow.appendChild(_sliders.emitterX.el);
    emPosRow.appendChild(_sliders.emitterY.el);
    container.appendChild(emPosRow);

    var emSizeRow = Utils.el('div', { class: 'row-2' });
    _sliders.emitterSizeX = new Slider({ label: 'Width px', min:0, max:1000, value:100, step:10, defaultValue:100, tooltip:'Emitter width — Box and Ring types', onChange:function(v){_state.emitterSizeX=v;} });
    _sliders.emitterSizeY = new Slider({ label: 'Height px', min:0, max:1000, value:100, step:10, defaultValue:100, tooltip:'Emitter height — Box type only', onChange:function(v){_state.emitterSizeY=v;} });
    emSizeRow.appendChild(_sliders.emitterSizeX.el);
    emSizeRow.appendChild(_sliders.emitterSizeY.el);
    container.appendChild(emSizeRow);

    // ── Emission ──────────────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Emission'));
    var rateRow = Utils.el('div', { class: 'row-2' });
    _sliders.rate         = new Slider({ label: 'Rate /frame',    min:1, max:30,  value:8,   step:1,   defaultValue:8,   tooltip:'Particles spawned per frame', onChange:function(v){_state.rate=v;} });
    _sliders.maxParticles = new Slider({ label: 'Max particles',  min:10,max:200, value:100, step:10,  defaultValue:100, tooltip:'Pool cap — higher = richer but slower to bake', onChange:function(v){_state.maxParticles=v;} });
    rateRow.appendChild(_sliders.rate.el);
    rateRow.appendChild(_sliders.maxParticles.el);
    container.appendChild(rateRow);

    var lifeRow = Utils.el('div', { class: 'row-2' });
    _sliders.life         = new Slider({ label: 'Life (s)',   min:0.2, max:8,   value:1.5, step:0.1, decimals:1, defaultValue:1.5, onChange:function(v){_state.life=v;} });
    _sliders.lifeVariance = new Slider({ label: 'Life Var %', min:0,   max:100, value:30,  step:1,   defaultValue:30, tooltip:'Random life variation per particle — 0 = uniform', onChange:function(v){_state.lifeVariance=v/100;} });
    lifeRow.appendChild(_sliders.life.el);
    lifeRow.appendChild(_sliders.lifeVariance.el);
    container.appendChild(lifeRow);

    // ── Direction ─────────────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Direction'));
    _sliders.direction = new Slider({ label: 'Direction °', min:-180, max:180, value:-90, step:1, defaultValue:-90, tooltip:'-90 = up, 0 = right, 90 = down', onChange:function(v){_state.direction=v;} });
    _sliders.spread    = new Slider({ label: 'Spread °',    min:0, max:360, value:30, step:1, defaultValue:30, tooltip:'0 = laser, 360 = omnidirectional burst', onChange:function(v){_state.spread=v;} });
    container.appendChild(_sliders.direction.el);
    container.appendChild(_sliders.spread.el);

    var velRow = Utils.el('div', { class: 'row-2' });
    _sliders.velocity         = new Slider({ label: 'Velocity px/s', min:0, max:2000, value:200, step:10, defaultValue:200, onChange:function(v){_state.velocity=v;} });
    _sliders.velocityVariance = new Slider({ label: 'Vel Var %',     min:0, max:100,  value:40,  step:1,  defaultValue:40, onChange:function(v){_state.velocityVariance=v/100;} });
    velRow.appendChild(_sliders.velocity.el);
    velRow.appendChild(_sliders.velocityVariance.el);
    container.appendChild(velRow);

    // ── Physics ───────────────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Physics'));
    var gravRow = Utils.el('div', { class: 'row-2' });
    _sliders.gravityX = new Slider({ label: 'Gravity X', min:-1000, max:1000, value:0,   step:10, defaultValue:0,   onChange:function(v){_state.gravityX=v;} });
    _sliders.gravityY = new Slider({ label: 'Gravity Y', min:-1000, max:1000, value:200, step:10, defaultValue:200, onChange:function(v){_state.gravityY=v;} });
    gravRow.appendChild(_sliders.gravityX.el);
    gravRow.appendChild(_sliders.gravityY.el);
    container.appendChild(gravRow);

    var airRow = Utils.el('div', { class: 'row-3' });
    _sliders.wind       = new Slider({ label: 'Wind',   min:-500, max:500, value:0, step:10, defaultValue:0, onChange:function(v){_state.wind=v;} });
    _sliders.turbulence = new Slider({ label: 'Turb',   min:0, max:500, value:0, step:10, defaultValue:0, tooltip:'Random per-frame force — creates organic movement', onChange:function(v){_state.turbulence=v;} });
    _sliders.drag       = new Slider({ label: 'Drag %', min:0, max:20, value:2, step:0.5, decimals:1, defaultValue:2, tooltip:'Velocity damping per frame — simulates air resistance', onChange:function(v){_state.drag=v/100;} });
    airRow.appendChild(_sliders.wind.el);
    airRow.appendChild(_sliders.turbulence.el);
    airRow.appendChild(_sliders.drag.el);
    container.appendChild(airRow);

    // ── Appearance ────────────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Appearance'));
    _color = new ColorPicker({ label: 'Color', value: '#ffffff', onChange:function(v){_state.color=v;} });
    container.appendChild(_color.el);

    var sizeRow = Utils.el('div', { class: 'row-2' });
    _sliders.sizeStart = new Slider({ label: 'Size Born px', min:1, max:100, value:10, step:1, defaultValue:10, onChange:function(v){_state.sizeStart=v;} });
    _sliders.sizeEnd   = new Slider({ label: 'Size Die px',  min:0, max:100, value:2,  step:1, defaultValue:2,  onChange:function(v){_state.sizeEnd=v;} });
    sizeRow.appendChild(_sliders.sizeStart.el);
    sizeRow.appendChild(_sliders.sizeEnd.el);
    container.appendChild(sizeRow);

    var opRow = Utils.el('div', { class: 'row-2' });
    _sliders.opacityStart = new Slider({ label: 'Opacity Born %', min:0, max:100, value:100, step:1, defaultValue:100, onChange:function(v){_state.opacityStart=v;} });
    _sliders.opacityEnd   = new Slider({ label: 'Opacity Die %',  min:0, max:100, value:0,   step:1, defaultValue:0,   onChange:function(v){_state.opacityEnd=v;} });
    opRow.appendChild(_sliders.opacityStart.el);
    opRow.appendChild(_sliders.opacityEnd.el);
    container.appendChild(opRow);

    // ── Output ────────────────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Output'));
    _sliders.duration = new Slider({ label: 'Duration (s)', min:0.5, max:10, value:3, step:0.5, decimals:1, defaultValue:3, tooltip:'Seconds of simulation to bake as keyframes', onChange:function(v){_state.duration=v;} });
    container.appendChild(_sliders.duration.el);

    var applyBtn = Utils.el('button', { class: 'action-btn' }, 'Generate Particles');
    _status = Utils.el('div', { class: 'status-bar' }, '');
    applyBtn.addEventListener('click', function () { _apply(applyBtn); });
    container.appendChild(applyBtn);
    container.appendChild(_status);
  }

  function _apply(btn) {
    btn.disabled = true; btn.textContent = 'Simulating…';
    _status.className = 'status-bar'; _status.textContent = '';
    Bridge.call('particles.generate', getParams()).then(function(r){
      btn.disabled = false; btn.textContent = 'Generate Particles';
      if (r.error) { _status.className = 'status-bar error'; _status.textContent = r.error; }
      else { _status.className = 'status-bar success'; _status.textContent = r.particles + ' particles × ' + r.frames + ' frames baked.'; }
    }).catch(function(e){
      btn.disabled = false; btn.textContent = 'Generate Particles';
      _status.className = 'status-bar error'; _status.textContent = e.message;
    });
  }

  return { init: init, getParams: getParams, applyPreset: applyPreset };
}());
