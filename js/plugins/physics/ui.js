'use strict';

window.PhysicsUI = (function () {
  var _state = {
    duration:          3,
    gravityX:          0,
    gravityY:          980,
    gravityScale:      1,
    bounce:            0.55,
    friction:          0.01,
    groundFriction:    0.15,
    groundY:           -1,
    mass:              1,
    initialVelX:       0,
    initialVelY:       -200,
    wallBounce:        true,
    simulateRotation:  true,
    magnetism:         false,
    magnetismType:     'attract',
    magnetismStrength: 200,
    magnetismRange:    400,
    exportContacts:    false,
    constraints:       []
  };

  function getParams() { return Utils.deepClone(_state); }

  function applyPreset(p) {
    Object.assign(_state, p);
    _sliders.duration.setValue(p.duration);
    _sliders.gravityX.setValue(p.gravityX);
    _sliders.gravityY.setValue(p.gravityY);
    _sliders.gravityScale.setValue(p.gravityScale);
    _sliders.bounce.setValue(p.bounce * 100);
    _sliders.friction.setValue(p.friction * 100);
    _sliders.groundFriction.setValue(p.groundFriction * 100);
    _sliders.mass.setValue(p.mass);
    _sliders.initialVelX.setValue(p.initialVelX);
    _sliders.initialVelY.setValue(p.initialVelY);
    _wallBounceToggle.setValue(p.wallBounce);
    _rotationToggle.setValue(p.simulateRotation);
    _magnetismToggle.setValue(p.magnetism);
    _magTypeGroup.setValue(p.magnetismType);
    _sliders.magnetismStrength.setValue(p.magnetismStrength);
    _sliders.magnetismRange.setValue(p.magnetismRange);
    _exportContactsToggle.setValue(p.exportContacts);
  }

  var _sliders = {};
  var _wallBounceToggle, _rotationToggle, _magnetismToggle, _magTypeGroup;
  var _exportContactsToggle, _magSection, _status;

  function init(container) {
    // ── Body Type help ─────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Body Types'));
    container.appendChild(Utils.el('div', { class: 'help-text' },
      'Prefix layer name with [static], [kinematic], or [dormant] to set body type. ' +
      'Add layer comment like "density:2,friction:0.3,bounce:0.8" for per-layer overrides.'
    ));

    // ── Gravity ────────────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Gravity'));
    var gravRow = Utils.el('div', { class: 'row-2' });
    _sliders.gravityX = new Slider({ label: 'X px/s²', min: -2000, max: 2000, value: 0, step: 10, defaultValue: 0, tooltip: 'Horizontal gravity — positive = rightward', onChange: function(v){_state.gravityX=v;} });
    _sliders.gravityY = new Slider({ label: 'Y px/s²', min: -2000, max: 2000, value: 980, step: 10, defaultValue: 980, tooltip: '980 = Earth-like gravity. Negative = upward.', onChange: function(v){_state.gravityY=v;} });
    gravRow.appendChild(_sliders.gravityX.el);
    gravRow.appendChild(_sliders.gravityY.el);
    container.appendChild(gravRow);
    _sliders.gravityScale = new Slider({ label: 'Gravity Scale', min: -3, max: 5, value: 1, step: 0.1, decimals: 1, defaultValue: 1, tooltip: 'Global gravity multiplier — 0 = weightless, negative = anti-gravity', onChange: function(v){_state.gravityScale=v;} });
    container.appendChild(_sliders.gravityScale.el);

    // ── Material ───────────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Material (Global Defaults)'));
    _sliders.bounce = new Slider({ label: 'Bounce %', min: 0, max: 100, value: 55, step: 1, defaultValue: 55, tooltip: 'Coefficient of restitution — 0 = dead stop, 100 = perfect bounce', onChange: function(v){_state.bounce=v/100;} });
    _sliders.friction = new Slider({ label: 'Air Friction %', min: 0, max: 20, value: 1, step: 0.5, decimals: 1, defaultValue: 1, tooltip: 'Velocity damping per frame from air resistance', onChange: function(v){_state.friction=v/100;} });
    _sliders.groundFriction = new Slider({ label: 'Ground Friction %', min: 0, max: 80, value: 15, step: 1, defaultValue: 15, tooltip: 'Extra horizontal damping applied on ground contact', onChange: function(v){_state.groundFriction=v/100;} });
    _sliders.mass = new Slider({ label: 'Default Density', min: 0.1, max: 10, value: 1, step: 0.1, decimals: 1, defaultValue: 1, tooltip: 'Relative mass — affects collision response. Override per layer via comment.', onChange: function(v){_state.mass=v;} });
    container.appendChild(_sliders.bounce.el);
    container.appendChild(_sliders.friction.el);
    container.appendChild(_sliders.groundFriction.el);
    container.appendChild(_sliders.mass.el);

    // ── Initial Velocity ───────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Initial Velocity'));
    var velRow = Utils.el('div', { class: 'row-2' });
    _sliders.initialVelX = new Slider({ label: 'Vel X px/s', min: -2000, max: 2000, value: 0, step: 10, defaultValue: 0, onChange: function(v){_state.initialVelX=v;} });
    _sliders.initialVelY = new Slider({ label: 'Vel Y px/s', min: -2000, max: 2000, value: -200, step: 10, defaultValue: -200, tooltip: 'Negative = upward launch', onChange: function(v){_state.initialVelY=v;} });
    velRow.appendChild(_sliders.initialVelX.el);
    velRow.appendChild(_sliders.initialVelY.el);
    container.appendChild(velRow);

    // ── Magnetism ──────────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Magnetism'));
    _magnetismToggle = new Toggle({ label: 'Enable magnetism', value: false, tooltip: 'Apply attract or repulse force between all simulated bodies', onChange: function(v){_state.magnetism=v; _magSection.style.display=v?'':'none';} });
    container.appendChild(_magnetismToggle.el);

    _magSection = Utils.el('div', {});
    _magSection.style.display = 'none';
    _magTypeGroup = new ButtonGroup({
      options: [{ value: 'attract', label: 'Attract' }, { value: 'repulse', label: 'Repulse' }],
      value: 'attract',
      tooltip: 'Attract: bodies pull toward each other. Repulse: push apart.',
      onChange: function(v){_state.magnetismType=v;}
    });
    _sliders.magnetismStrength = new Slider({ label: 'Strength', min: 10, max: 2000, value: 200, step: 10, defaultValue: 200, tooltip: 'Inverse-square force magnitude', onChange: function(v){_state.magnetismStrength=v;} });
    _sliders.magnetismRange    = new Slider({ label: 'Range px', min: 50, max: 2000, value: 400, step: 10, defaultValue: 400, tooltip: 'Maximum distance at which magnetism is active', onChange: function(v){_state.magnetismRange=v;} });
    _magSection.appendChild(_magTypeGroup.el);
    _magSection.appendChild(_sliders.magnetismStrength.el);
    _magSection.appendChild(_sliders.magnetismRange.el);
    container.appendChild(_magSection);

    // ── Simulation ─────────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Simulation'));
    _sliders.duration = new Slider({ label: 'Duration (s)', min: 0.5, max: 10, value: 3, step: 0.5, decimals: 1, defaultValue: 3, tooltip: 'Seconds of physics to bake as keyframes', onChange: function(v){_state.duration=v;} });
    _wallBounceToggle = new Toggle({ label: 'Bounce off walls', value: true, tooltip: 'Layers bounce off left/right/top edges of comp', onChange: function(v){_state.wallBounce=v;} });
    _rotationToggle   = new Toggle({ label: 'Simulate rotation', value: true, tooltip: 'Bakes rotation keyframes based on angular momentum', onChange: function(v){_state.simulateRotation=v;} });
    _exportContactsToggle = new Toggle({ label: 'Export contact markers', value: false, tooltip: 'Writes an AE layer marker at every collision frame — use with expressions to trigger events', onChange: function(v){_state.exportContacts=v;} });
    container.appendChild(_sliders.duration.el);
    container.appendChild(_wallBounceToggle.el);
    container.appendChild(_rotationToggle.el);
    container.appendChild(_exportContactsToggle.el);

    container.appendChild(Utils.el('div', { class: 'help-text' }, 'Select the layers you want to simulate, then click Simulate.'));

    var applyBtn = Utils.el('button', { class: 'action-btn' }, 'Simulate Physics');
    _status = Utils.el('div', { class: 'status-bar' }, '');
    applyBtn.addEventListener('click', function () { _apply(applyBtn); });
    container.appendChild(applyBtn);
    container.appendChild(_status);
  }

  function _apply(btn) {
    btn.disabled = true; btn.textContent = 'Simulating…';
    _status.className = 'status-bar'; _status.textContent = '';
    Bridge.call('physics.simulate', getParams()).then(function(r){
      btn.disabled = false; btn.textContent = 'Simulate Physics';
      if (r.error) { _status.className = 'status-bar error'; _status.textContent = r.error; }
      else { _status.className = 'status-bar success'; _status.textContent = 'Baked ' + r.frames + ' frames on ' + r.layers + ' layer(s).'; }
    }).catch(function(e){
      btn.disabled = false; btn.textContent = 'Simulate Physics';
      _status.className = 'status-bar error'; _status.textContent = e.message;
    });
  }

  return { init: init, getParams: getParams, applyPreset: applyPreset };
}());
