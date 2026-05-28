function withUndo(name, fn) {
  app.beginUndoGroup(name);
  var result;
  try {
    result = fn();
  } catch(e) {
    app.endUndoGroup();
    throw e;
  }
  app.endUndoGroup();
  return result;
}
