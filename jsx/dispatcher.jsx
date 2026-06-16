// Main ExtendScript entry point loaded by the CEP manifest.
// Routes dispatch("action", "{...json...}") calls from the JS panel
// to the correct plugin module.

//@include "core/utils.jsx"
//@include "core/undo.jsx"
//@include "presets_io.jsx"
//@include "glow.jsx"
//@include "distortions.jsx"
//@include "distortflow.jsx"
//@include "colorlab.jsx"

function dispatch(action, paramsJSON) {
    var params;
    try {
        params = JSON.parse(paramsJSON);
    } catch (e) {
        return JSON.stringify({ error: 'JSON parse error: ' + e.toString() });
    }

    try {
        var result;
        if      (action === 'glow.apply')          result = Glow.apply(params);
        else if (action === 'distortions.apply')   result = Distortions.apply(params);
        else if (action === 'distortflow.apply')   result = DistortFlow.apply(params);
        else if (action === 'colorlab.apply')      result = ColorLab.apply(params);
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
