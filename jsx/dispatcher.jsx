// Main ExtendScript entry point loaded by the CEP manifest.
// Routes dispatch("action", "{...json...}") calls from the JS panel
// to the correct plugin module.

//@include "core/utils.jsx"
//@include "core/undo.jsx"
//@include "presets_io.jsx"
//@include "slides.jsx"
//@include "grids.jsx"
//@include "glow.jsx"
//@include "sorter.jsx"
//@include "distortions.jsx"
//@include "colorlab.jsx"
//@include "gradient.jsx"
//@include "patterns.jsx"
//@include "physics.jsx"
//@include "particles.jsx"

function dispatch(action, paramsJSON) {
    var params;
    try {
        params = JSON.parse(paramsJSON);
    } catch (e) {
        return JSON.stringify({ error: 'JSON parse error: ' + e.toString() });
    }

    try {
        var result;
        if      (action === 'slides.generate')   result = Slides.generate(params);
        else if (action === 'grids.generate')    result = Grids.generate(params);
        else if (action === 'glow.apply')        result = Glow.apply(params);
        else if (action === 'sorter.apply')      result = Sorter.apply(params);
        else if (action === 'distortions.apply')   result = Distortions.apply(params);
        else if (action === 'colorlab.apply')      result = ColorLab.apply(params);
        else if (action === 'gradient.apply')      result = GradientStudio.apply(params);
        else if (action === 'patterns.generate')   result = Patterns.generate(params);
        else if (action === 'physics.simulate')    result = PhysicsRig.simulate(params);
        else if (action === 'particles.generate')  result = ParticleEngine.generate(params);
        else if (action === 'presets.save')      result = PresetsIO.save(params);
        else if (action === 'presets.list')      result = PresetsIO.list(params);
        else if (action === 'presets.get')       result = PresetsIO.get(params);
        else if (action === 'presets.delete')    result = PresetsIO['delete'](params);
        else result = { error: 'Unknown action: ' + action };
        return JSON.stringify(result);
    } catch (e) {
        return JSON.stringify({ error: e.toString() });
    }
}
