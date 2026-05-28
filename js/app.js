'use strict';

(function () {
  var _tabs = ['slides', 'grids', 'glow', 'sorter', 'dist',
               'colorlab', 'gradient', 'patterns', 'physics', 'particles'];

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

  function _initTabStrip() {
    var btns  = document.querySelectorAll('.tab-btn');
    var panes = document.querySelectorAll('.tab-pane');

    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tab = btn.getAttribute('data-tab');

        btns.forEach(function (b) {
          var isActive = b.getAttribute('data-tab') === tab;
          b.classList.toggle('active', isActive);
          b.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        panes.forEach(function (p) {
          p.classList.toggle('active', p.id === 'pane-' + tab);
        });
      });
    });
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
