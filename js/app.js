'use strict';

(function () {
  var _tabs = ['slides', 'grids', 'glow', 'sorter', 'dist',
               'colorlab', 'gradient', 'patterns', 'physics', 'particles'];

  var _pluginNames = {
    slides:    'Slides Generator',
    grids:     'Grids Pro',
    glow:      'Deep Glow',
    sorter:    'Pixel Sorter',
    dist:      'Distortions Suite',
    colorlab:  'Color Lab',
    gradient:  'Gradient Studio',
    patterns:  'Pattern Pro',
    physics:   'Physics Rig',
    particles: 'Particle Engine'
  };

  var _UIs = {
    slides:    window.SlidesUI,
    grids:     window.GridsUI,
    glow:      window.GlowUI,
    sorter:    window.SorterUI,
    dist:      window.DistortionsUI,
    colorlab:  window.ColorLabUI,
    gradient:  window.GradientUI,
    patterns:  window.PatternsUI,
    physics:   window.PhysicsUI,
    particles: window.ParticlesUI
  };

  // pluginId used for preset file namespacing
  var _pluginIds = {
    slides:    'slides',
    grids:     'grids',
    glow:      'glow',
    sorter:    'sorter',
    dist:      'distortions',
    colorlab:  'colorlab',
    gradient:  'gradient',
    patterns:  'patterns',
    physics:   'physics',
    particles: 'particles'
  };

  function init() {
    Tooltip.init();
    _initTabStrip();
    _initPlugins();
    _checkAEVersion();
  }

  var _pluginBarName = document.getElementById('plugin-bar-name');
  var _pluginBar     = document.getElementById('plugin-bar');

  function _setActiveTab(tab) {
    var btns  = document.querySelectorAll('.tab-btn');
    var panes = document.querySelectorAll('.tab-pane');
    btns.forEach(function (b) {
      var isActive = b.getAttribute('data-tab') === tab;
      b.classList.toggle('active', isActive);
      b.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    panes.forEach(function (p) {
      p.classList.toggle('active', p.id === 'pane-' + tab);
    });
    if (_pluginBarName) _pluginBarName.textContent = _pluginNames[tab] || tab;
    // Sync --tab-color from the active pane up to the plugin-bar
    if (_pluginBar) {
      var pane = document.getElementById('pane-' + tab);
      var style = pane ? window.getComputedStyle(pane).getPropertyValue('--tab-color').trim() : '';
      _pluginBar.style.setProperty('--tab-color', style || '');
    }
  }

  function _initTabStrip() {
    var btns = document.querySelectorAll('.tab-btn');
    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        _setActiveTab(btn.getAttribute('data-tab'));
      });
    });
    // Initialise with first active tab
    var firstActive = document.querySelector('.tab-btn.active');
    if (firstActive) _setActiveTab(firstActive.getAttribute('data-tab'));
  }

  function _initPlugins() {
    _tabs.forEach(function (tab) {
      var ui       = _UIs[tab];
      var pluginId = _pluginIds[tab];
      var controls = document.getElementById('controls-' + tab);
      var pane     = document.getElementById('pane-' + tab);

      if (!ui || !controls || !pane) return;

      ui.init(controls);

      var bar = new PresetBar({
        pluginId: pluginId,
        getParams: (function (u) {
          return function () { return u.getParams(); };
        }(ui)),
        onLoad: (function (u) {
          return function (params) { u.applyPreset(params); };
        }(ui))
      });

      pane.appendChild(bar.el);
    });
  }

  function _checkAEVersion() {
    Bridge.getAEVersion().then(function (v) {
      var footer = document.getElementById('footer-version');
      if (footer && v) footer.textContent = 'AE ' + v;
    }).catch(function () {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
