# After Effects Rigged Comp Grid Builder — Product & Technical Spec

## Purpose

Build an After Effects extension/script for creating responsive, rigged systems of layers and comps. The tool should combine three capabilities:

1. Dynamic grid and slideshow layout creation.
2. Flex-style responsive line/grid rigs where layers react to neighboring sizes.
3. Template automation: precomping, placeholder replacement, masks, frames, delays, and bulk updates.

The goal is not to copy existing tools. Build an original tool inspired by common layout-rig concepts: grid creation, responsive rows/columns, precomp placeholders, and controller-driven animation.

---

## Core Product Idea

Create a tool called something like:

**Responsive Layout Rig Builder for After Effects**

It should allow a user to select layers or comps, click one button, and generate a live rig with controller sliders. After creation, the user should still be able to adjust rows, columns, gaps, margins, item fitting, animation delay, masks, strokes, backgrounds, and responsive column/row behavior.

The system should create a reusable rig, not just place layers once.

---

## Primary User Workflow

1. User selects multiple layers or precomps in an After Effects composition.
2. User opens the extension panel.
3. User chooses a layout mode:
   - Static Grid
   - Animated Grid
   - Responsive Grid Rig
   - Line Rig
   - Bento / Hero Grid
   - Precomp Placeholder Grid
4. User sets rows, columns, gap, margins, fit mode, and optional frame/matte settings.
5. User clicks **Create Rig**.
6. Tool creates:
   - A controller null or shape layer.
   - Expression controls on the controller.
   - Optional cell/frame layers.
   - Optional mattes/masks.
   - Expressions on selected layers.
7. User can later change the controller values and the whole layout updates automatically.

---

## Main Modes

### 1. Static Grid

Creates a regular grid from selected layers.

Controls:

- Rows
- Columns
- Gap X
- Gap Y
- Margin X
- Margin Y
- Grid Width
- Grid Height
- Fit to Comp
- Anchor Point / Grid Origin
- Distribution order
- Alternate row offset
- Alternate column offset

Layer order options:

- Left to right
- Right to left
- Top to bottom
- Bottom to top
- Snake order
- Random order
- Selected layer order

---

### 2. Animated Grid

Same as Static Grid, but includes delay and transform animation controls.

Controls:

- Delay by index
- Delay by row
- Delay by column
- Delay from center
- Delay from custom point
- Random delay
- Start scale
- End scale
- Position offset
- Rotation offset
- Opacity fade
- Ease amount
- Random seed

The generated rig should allow staggered reveals, slideshow grids, product grids, social post layouts, and ad-style animations.

---

### 3. Responsive Grid Rig

A live grid where rows and columns can resize based on weights.

Instead of every cell having equal size, each column and row can have a weight.

Example:

```text
Column 1 weight: 1
Column 2 weight: 2
Column 3 weight: 1
```

Available width is split proportionally:

```text
totalWeight = 1 + 2 + 1 = 4
col1 = availableWidth * 1/4
col2 = availableWidth * 2/4
col3 = availableWidth * 1/4
```

Required responsive controls:

- Column weight controls
- Row weight controls
- Minimum cell width
- Minimum cell height
- Maximum cell width
- Maximum cell height
- Row span
- Column span
- Hero cell mode
- Push neighboring cells
- Auto-fit remaining cells
- Lock aspect ratio

This mode is essential for bento layouts and responsive comp systems.

---

### 4. Line Rig

Creates a horizontal or vertical chain of layers where each layer can affect the next.

Controls:

- Direction: horizontal / vertical
- Gap
- Alignment: start / center / end
- Auto-size from sourceRect
- Fit to available width
- Push neighbors
- Reverse order
- Scale selected item
- Recalculate neighbors

Use cases:

- Dynamic text + icon rows
- Product cards
- Title systems
- UI rows
- Lower thirds
- Logo strips

---

### 5. Bento / Hero Layout

Creates editorial layouts where some cells span multiple rows/columns.

Controls:

- Cell row
- Cell column
- Row span
- Column span
- Hero item scale
- Fit mode per cell
- Background per cell
- Rounded corners
- Stroke
- Mask

Example layout:

```text
[ small ][ hero hero ][ small ]
[ wide wide wide   ][ small ]
[ small ][ small   ][ small ]
```

---

### 6. Precomp Placeholder Grid

Creates precomps for each item or cell so users can replace content easily.

Options:

- Precomp selected layers individually
- Precomp every grid cell
- Precomp entire grid
- Create placeholder comps
- Create image/video drop zones
- Set comp size from source
- Set comp size from cell
- Set comp size manually
- Add background solid
- Add mask/matte
- Set duration
- Set frame rate
- Update existing precomps

---

### 7. Bulk Template Filler

Allows users to replace content across many comps.

Features:

- Select multiple comps
- Find placeholder layers by name
- Find by index
- Find by label color
- Find by marker
- Replace image/video layers
- Add new item
- Remove item
- Toggle visibility
- Repeat assets if fewer assets than placeholders
- Distribute imported assets across selected comps
- Auto-fit replacements to placeholder frames

Example:

```text
User imports 20 product images.
Tool finds every layer named PRODUCT_PLACEHOLDER.
Tool replaces placeholders across 20 selected comps.
Tool fits each product image to its frame.
```

---

## Generated Layer Structure

Recommended structure inside the active comp:

```text
GRID_CONTROL
CELL_001_FRAME
CELL_001_MATTE
CELL_001_CONTENT
CELL_002_FRAME
CELL_002_MATTE
CELL_002_CONTENT
CELL_003_FRAME
CELL_003_MATTE
CELL_003_CONTENT
```

Alternative simpler structure:

```text
GRID_CONTROL
Selected Layer 01
Selected Layer 02
Selected Layer 03
```

For MVP, do not require individual nulls for every item unless needed. Use expressions on selected layers that read from one controller.

---

## Controller Layer

Create a controller layer named:

```text
GRID_CONTROL
```

Add expression controls:

### Grid Controls

- Slider: Rows
- Slider: Columns
- Slider: Gap X
- Slider: Gap Y
- Slider: Margin X
- Slider: Margin Y
- Slider: Grid Width
- Slider: Grid Height
- Checkbox: Fit to Comp
- Dropdown: Layout Direction
- Dropdown: Order Mode
- Slider: Offset X
- Slider: Offset Y
- Slider: Alternate Row Offset
- Slider: Alternate Column Offset
- Slider: Progressive Shift X
- Slider: Progressive Shift Y

### Item Controls

- Dropdown: Fit Mode
- Slider: Item Scale
- Slider: Scale X
- Slider: Scale Y
- Slider: Rotation
- Slider: Opacity
- Checkbox: Use Masks
- Checkbox: Use Background
- Checkbox: Use Stroke
- Slider: Roundness
- Slider: Stroke Width
- Color: Stroke Color
- Color: Background Color

### Animation Controls

- Slider: Delay Frames
- Dropdown: Delay Mode
- Slider: Delay Center X
- Slider: Delay Center Y
- Slider: Random Delay
- Slider: Random Seed
- Slider: Start Scale
- Slider: End Scale
- Slider: Start Offset X
- Slider: Start Offset Y
- Slider: Start Rotation
- Slider: Start Opacity
- Slider: Animation Duration

### Responsive Controls

- Slider: Column 1 Weight
- Slider: Column 2 Weight
- Slider: Column 3 Weight
- Slider: Column 4 Weight
- Slider: Column 5 Weight
- Slider: Column 6 Weight
- Slider: Row 1 Weight
- Slider: Row 2 Weight
- Slider: Row 3 Weight
- Slider: Row 4 Weight
- Slider: Row 5 Weight
- Slider: Row 6 Weight
- Slider: Min Cell Width
- Slider: Min Cell Height
- Checkbox: Lock Aspect Ratio
- Checkbox: Push Neighbors

---

## Fit Modes

The tool should support these content fitting modes:

1. None
2. Fill cell
3. Fit width
4. Fit height
5. Fit best
6. Stretch
7. Crop with matte
8. Preserve original scale
9. Scale by cell width
10. Scale by cell height

Scale formulas:

```js
fitWidthScale  = cellWidth / sourceWidth * 100;
fitHeightScale = cellHeight / sourceHeight * 100;
fitBest        = Math.min(fitWidthScale, fitHeightScale);
fill           = Math.max(fitWidthScale, fitHeightScale);
stretchX       = cellWidth / sourceWidth * 100;
stretchY       = cellHeight / sourceHeight * 100;
```

For image/video/precomp layers, use source width/height where possible. For text/shape layers, use `sourceRectAtTime()`.

---

## Position Expression Logic

Each item needs to know:

- Its index in the rig
- Row
- Column
- Cell width
- Cell height
- Gap X
- Gap Y
- Margin X
- Margin Y
- Grid origin
- Alternate offset
- Progressive shift

Basic formula:

```js
index = itemIndex;
columns = controller.effect("Columns")("Slider");
col = index % columns;
row = Math.floor(index / columns);

x = startX + col * (cellWidth + gapX);
y = startY + row * (cellHeight + gapY);
```

The actual implementation should generate a custom expression for each layer with a baked item index, for example:

```js
var itemIndex = 0; // generated per layer
```

This avoids depending on AE timeline layer index, which changes when users reorder layers.

---

## Suggested Position Expression Template

Use this as a starting point. The builder script should inject the item index for every selected layer.

```js
var ctrl = thisComp.layer("GRID_CONTROL");
var itemIndex = 0; // replace per layer

var cols = Math.max(1, Math.round(ctrl.effect("Columns")("Slider")));
var gapX = ctrl.effect("Gap X")("Slider");
var gapY = ctrl.effect("Gap Y")("Slider");
var marginX = ctrl.effect("Margin X")("Slider");
var marginY = ctrl.effect("Margin Y")("Slider");
var gridW = ctrl.effect("Grid Width")("Slider");
var gridH = ctrl.effect("Grid Height")("Slider");
var offX = ctrl.effect("Offset X")("Slider");
var offY = ctrl.effect("Offset Y")("Slider");
var altRow = ctrl.effect("Alternate Row Offset")("Slider");
var altCol = ctrl.effect("Alternate Column Offset")("Slider");
var progX = ctrl.effect("Progressive Shift X")("Slider");
var progY = ctrl.effect("Progressive Shift Y")("Slider");

var rows = Math.ceil(ctrl.effect("Item Count")("Slider") / cols);
var cellW = (gridW - marginX * 2 - gapX * (cols - 1)) / cols;
var cellH = (gridH - marginY * 2 - gapY * (rows - 1)) / rows;

var col = itemIndex % cols;
var row = Math.floor(itemIndex / cols);

var startX = (thisComp.width - gridW) / 2 + marginX + cellW / 2;
var startY = (thisComp.height - gridH) / 2 + marginY + cellH / 2;

var x = startX + col * (cellW + gapX) + offX;
var y = startY + row * (cellH + gapY) + offY;

x += row % 2 == 1 ? altRow : 0;
y += col % 2 == 1 ? altCol : 0;

x += row * progX;
y += col * progY;

[x, y];
```

---

## Suggested Scale Expression Template

```js
var ctrl = thisComp.layer("GRID_CONTROL");
var fitMode = Math.round(ctrl.effect("Fit Mode")("Menu"));
var itemScale = ctrl.effect("Item Scale")("Slider") / 100;

var cols = Math.max(1, Math.round(ctrl.effect("Columns")("Slider")));
var gapX = ctrl.effect("Gap X")("Slider");
var gapY = ctrl.effect("Gap Y")("Slider");
var marginX = ctrl.effect("Margin X")("Slider");
var marginY = ctrl.effect("Margin Y")("Slider");
var gridW = ctrl.effect("Grid Width")("Slider");
var gridH = ctrl.effect("Grid Height")("Slider");
var itemCount = Math.max(1, Math.round(ctrl.effect("Item Count")("Slider")));
var rows = Math.ceil(itemCount / cols);

var cellW = (gridW - marginX * 2 - gapX * (cols - 1)) / cols;
var cellH = (gridH - marginY * 2 - gapY * (rows - 1)) / rows;

function getLayerSize() {
  try {
    var r = sourceRectAtTime(time, false);
    return [Math.max(1, r.width), Math.max(1, r.height)];
  } catch (err) {
    return [thisLayer.width, thisLayer.height];
  }
}

var s = getLayerSize();
var sourceW = s[0];
var sourceH = s[1];

var fitW = cellW / sourceW * 100;
var fitH = cellH / sourceH * 100;
var result;

// Menu values depend on the dropdown order created by the script.
// 1 None, 2 Fill, 3 Fit Width, 4 Fit Height, 5 Fit Best, 6 Stretch
if (fitMode == 1) {
  result = value;
} else if (fitMode == 2) {
  var f = Math.max(fitW, fitH) * itemScale;
  result = [f, f];
} else if (fitMode == 3) {
  var f = fitW * itemScale;
  result = [f, f];
} else if (fitMode == 4) {
  var f = fitH * itemScale;
  result = [f, f];
} else if (fitMode == 5) {
  var f = Math.min(fitW, fitH) * itemScale;
  result = [f, f];
} else if (fitMode == 6) {
  result = [fitW * itemScale, fitH * itemScale];
} else {
  result = value;
}

result;
```

---

## Simple Smooth Position Float Expression

This is useful as a built-in optional micro motion preset.

```js
amp = 0.8;
speed = 0.9;

x = Math.sin(time * speed * Math.PI * 2) * amp;
y = Math.cos(time * speed * Math.PI * 2) * amp * 0.5;

value + [x, y];
```

---

## Simple Slow Rotation Expression

Useful as a subtle product motion preset.

```js
amp = 1.2;
speed = 0.6;

value + Math.sin(time * speed * Math.PI * 2) * amp;
```

---

## Script Architecture

Recommended implementation:

```text
/src
  /ui
    panel.jsx or panel.html/js
  /core
    createController.jsx
    createGridRig.jsx
    createLineRig.jsx
    createFrames.jsx
    createMattes.jsx
    createPrecomps.jsx
    bulkReplace.jsx
    expressions.jsx
    utils.jsx
  /presets
    gridPresets.json
    bentoPresets.json
    animationPresets.json
```

If building CEP/UXP:

```text
extension root
  CSXS/manifest.xml
  index.html
  main.js
  jsx/host.jsx
  css/style.css
```

If building a simple ExtendScript MVP:

```text
RiggedGridBuilder.jsx
```

---

## MVP Build Requirements

Start with a simple ExtendScript panel or script that does this:

1. Requires an active comp.
2. Requires at least one selected layer.
3. Creates `GRID_CONTROL` null.
4. Adds these controls:
   - Columns
   - Gap X
   - Gap Y
   - Margin X
   - Margin Y
   - Grid Width
   - Grid Height
   - Item Count
   - Fit Mode
   - Item Scale
   - Offset X
   - Offset Y
   - Alternate Row Offset
   - Alternate Column Offset
   - Progressive Shift X
   - Progressive Shift Y
5. Applies position expression to every selected layer.
6. Applies scale expression to every selected layer.
7. Bakes each layer's item index into the expression.
8. Sets default grid width to comp width.
9. Sets default grid height to comp height.
10. Sets item count to selected layer count.

Do not make the MVP too complicated. Get live grid positioning and fitting working first.

---

## Important After Effects Notes

- AE expressions are JavaScript-like, not CSS.
- Do not paste CSS syntax into AE property expressions.
- Position expressions go on Transform > Position.
- Rotation expressions go on Transform > Rotation.
- Scale expressions go on Transform > Scale.
- If a layer already has keyframes, expression should either add to value or override intentionally.
- Do not depend on layer index for permanent rig identity because users may reorder layers.
- Generate a fixed `itemIndex` number into each expression.
- Use `sourceRectAtTime()` for text and shape layers where possible.
- Use layer width/height for footage or precomp layers.

---

## UI Panel Sections

### Create Tab

- Create Grid Rig
- Create Line Rig
- Create Bento Rig
- Create Placeholder Grid

### Controls Tab

- Rows / Columns
- Gap / Margin
- Fit Mode
- Offset
- Responsive Weights

### Frames Tab

- Add Mask
- Add Background
- Add Stroke
- Roundness
- Update Frames

### Animation Tab

- Delay Mode
- Delay Amount
- Random Seed
- Start Scale
- Start Position Offset
- Start Rotation
- Opacity Fade

### Utilities Tab

- Bake Grid
- Unbake Grid
- Convert to 3D
- Reset Transform
- Replace Content
- Bulk Update Comps
- Release Rig

---

## Data Model

Use a data model like this internally:

```json
{
  "rig": {
    "name": "Rigged Grid",
    "type": "grid",
    "rows": 3,
    "columns": 4,
    "gapX": 24,
    "gapY": 24,
    "marginX": 60,
    "marginY": 60,
    "fitToComp": true,
    "cellMode": "weighted",
    "animationMode": "delayByIndex"
  },
  "columns": [
    { "index": 0, "weight": 1, "minWidth": 100 },
    { "index": 1, "weight": 2, "minWidth": 100 },
    { "index": 2, "weight": 1, "minWidth": 100 }
  ],
  "rows": [
    { "index": 0, "weight": 1, "minHeight": 100 },
    { "index": 1, "weight": 1.5, "minHeight": 100 }
  ],
  "items": [
    {
      "layerName": "Product_01",
      "row": 0,
      "column": 0,
      "rowSpan": 1,
      "columnSpan": 1,
      "fitMode": "fill",
      "useMatte": true
    }
  ]
}
```

---

## Future Advanced Features

Add after MVP:

1. Weighted responsive columns and rows.
2. Bento presets.
3. Per-cell row span / column span.
4. Frame and matte generation.
5. Precomp generation.
6. Bulk replacement across comps.
7. Delay animation presets.
8. Bake expressions to keyframes.
9. Save/load layout presets.
10. Export/import rig JSON.
11. Auto-create essential graphics controls.
12. Compatibility with MOGRT workflows.
13. Duplicate rig with new media.
14. Add randomization controls.
15. Add responsive typography support.

---

## Claude Build Prompt

Use the following as a direct prompt to Claude:

```text
Build an Adobe After Effects ExtendScript/CEP tool named Responsive Layout Rig Builder.

The MVP should work as a single ExtendScript .jsx file first.

Requirements:
- It must run in After Effects.
- It must require an active comp and selected layers.
- It must create a controller null named GRID_CONTROL.
- It must add expression controls to GRID_CONTROL: Columns, Gap X, Gap Y, Margin X, Margin Y, Grid Width, Grid Height, Item Count, Fit Mode, Item Scale, Offset X, Offset Y, Alternate Row Offset, Alternate Column Offset, Progressive Shift X, Progressive Shift Y.
- It must apply a generated Position expression to each selected layer.
- It must apply a generated Scale expression to each selected layer.
- Each expression must include a baked itemIndex number so the rig does not depend on timeline layer order.
- Position expression should arrange selected layers into a live grid based on the controller controls.
- Scale expression should support fit modes: None, Fill, Fit Width, Fit Height, Fit Best, Stretch.
- The tool should not create one null per object in the MVP.
- It should be simple, stable, and readable.
- Use app.beginUndoGroup and app.endUndoGroup.
- Include error handling for no active comp or no selected layers.
- Keep all helper functions in the same file for MVP.

After MVP, architecture should allow adding responsive weighted columns/rows, bento layouts, precomp placeholders, mattes, frames, animation delays, bulk replacement, and bake/unbake utilities.
```

---

## Key Design Principle

The strongest version of this tool is not a one-click layout placer.

It is a live rig generator.

The user should be able to create a layout once, then keep adjusting the entire system from one controller layer.
