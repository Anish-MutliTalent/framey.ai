// ─────────────────────────────────────────────────────────────────────────
// Framey AI — After Effects ExtendScript driver
//
// Load this in After Effects:  File > Scripts > Run Script File…  and pick
// ae/driver.jsx. It connects to the Framey host app over a local TCP socket
// (default 127.0.0.1:49321), receives AECommand objects, executes them through
// After Effects' scripting DOM, returns AEResult objects, and pushes the full
// CompState after every change so the host's timeline preview stays live.
//
// ExtendScript is ES3: no const/let, no arrow functions, no template literals.
// JSON is available in modern AE (json2 is bundled).
// ─────────────────────────────────────────────────────────────────────────

$.global.framey = (function () {
  var PORT = 49321
  var sock = null
  var buffer = ''
  var comps = {} // compId -> CompItem
  var cpSeq = 0
  var logFile = new File(Folder.desktop.absoluteURI + '/framey-driver.log')

  function log(msg) {
    try {
      logFile.encoding = 'UTF-8'
      logFile.open('a')
      logFile.writeln(new Date().toTimeString() + '  ' + msg)
      logFile.close()
    } catch (e) {}
  }

  function newId() {
    return 'ae_' + new Date().getTime().toString(36) + Math.floor(Math.random() * 1e6).toString(36)
  }

  function send(obj) {
    if (sock && sock.connected) {
      try {
        sock.write(JSON.stringify(obj) + '\n')
      } catch (e) {
        log('send error: ' + e)
      }
    }
  }

  function connect() {
    try {
      if (sock) {
        try { sock.close() } catch (e) {}
      }
      sock = new Socket()
      sock.timeout = 5
      if (sock.open('127.0.0.1:' + PORT, 'text')) {
        sock.timeout = 0.1
        send({ type: 'hello', version: '1' })
        log('connected to Framey on port ' + PORT)
        pushComp()
        app.scheduleTask('framey.poll()', 150, true)
      } else {
        log('connect failed; retrying in 3s')
        app.scheduleTask('framey.connect()', 3000, false)
      }
    } catch (e) {
      log('connect error: ' + e)
      app.scheduleTask('framey.connect()', 3000, false)
    }
  }

  function poll() {
    try {
      if (!sock || !sock.connected) {
        app.scheduleTask('framey.connect()', 3000, false)
        return
      }
      var chunk = sock.read(4096)
      if (chunk && chunk.length > 0) {
        buffer += chunk
        var nl = buffer.indexOf('\n')
        while (nl >= 0) {
          var line = buffer.substring(0, nl)
          buffer = buffer.substring(nl + 1)
          if (line.length > 0) handleLine(line)
          nl = buffer.indexOf('\n')
        }
      }
    } catch (e) {
      log('poll error: ' + e)
    }
  }

  function handleLine(line) {
    var req
    try {
      req = JSON.parse(line)
    } catch (e) {
      return
    }
    if (!req || !req.id || !req.cmd) return
    var label = 'Framey: ' + req.cmd.type
    app.beginUndoGroup(label)
    var result
    try {
      result = dispatch(req.cmd)
    } catch (e) {
      result = { ok: false, summary: 'error: ' + e.toString(), error: e.toString() }
      log('dispatch error (' + req.cmd.type + '): ' + e)
    }
    app.endUndoGroup()
    send({ id: req.id, result: result })
    pushComp()
  }

  // ── result helpers ───────────────────────────────────────────────────────
  function ok(summary, data) { return { ok: true, summary: summary, data: data } }
  function fail(err) { return { ok: false, summary: 'failed: ' + err, error: err } }

  function resolveProp(layer, path) {
    var parts = path.split('.')
    var p = layer
    for (var i = 0; i < parts.length; i++) p = p.property(parts[i])
    return p
  }

  function getComp(compId) {
    if (!compId) return app.project.activeItem
    if (comps[compId]) return comps[compId]
    for (var k in comps) {
      if (comps[k].name === compId) return comps[k]
    }
    return null
  }

  function findLayer(comp, name) {
    for (var i = 1; i <= comp.numLayers; i++) {
      if (comp.layer(i).name === name) return comp.layer(i)
    }
    return null
  }

  // ── command dispatch ─────────────────────────────────────────────────────
  function dispatch(cmd) {
    switch (cmd.type) {
      case 'new_project':
        app.newProject()
        comps = {}
        return ok('new project created')

      case 'open_project':
        app.open(new File(cmd.path))
        return ok('opened project ' + cmd.path)

      case 'create_composition': {
        var c = app.project.items.addComp(cmd.name, cmd.width, cmd.height, cmd.frameRate, cmd.durationSeconds, 1)
        if (cmd.bgColor) c.bgColor = cmd.bgColor
        var id = newId()
        comps[id] = c
        return ok('composition "' + cmd.name + '" created (compId=' + id + ')', { compId: id })
      }

      case 'add_solid_layer': {
        var comp = getComp(cmd.compId)
        if (!comp) return fail('composition not found')
        var w = cmd.width || comp.width
        var h = cmd.height || comp.height
        var solid = comp.layers.addSolid(cmd.color, cmd.name, w, h, 1, comp.duration)
        solid.property('Transform').property('Position').setValue([comp.width / 2, comp.height / 2])
        return ok('solid layer "' + cmd.name + '" added', { layerId: solid.id })
      }

      case 'add_text_layer': {
        var comp = getComp(cmd.compId)
        if (!comp) return fail('composition not found')
        var tl = comp.layers.addText(cmd.text)
        tl.name = cmd.name
        var src = tl.property('Source Text')
        var td = src.value
        if (cmd.fontSize) td.fontSize = cmd.fontSize
        if (cmd.fontFamily) td.font = cmd.fontFamily
        if (cmd.fillColor) td.fillColor = cmd.fillColor
        src.setValue(td)
        var pos = cmd.position || [comp.width / 2, comp.height / 2]
        tl.property('Transform').property('Position').setValue(pos)
        return ok('text layer "' + cmd.name + '" added', { layerId: tl.id })
      }

      case 'add_rectangle_shape': {
        var comp = getComp(cmd.compId)
        if (!comp) return fail('composition not found')
        var shape = comp.layers.addShape()
        shape.name = cmd.name
        var group = shape.property('Contents').addProperty('ADBE Vector Group')
        var rect = group.property('Contents').addProperty('ADBE Vector Shape - Rect')
        rect.property('Size').setValue(cmd.size)
        rect.property('Position').setValue([0, 0])
        if (cmd.fillColor) {
          var fill = group.property('Contents').addProperty('ADBE Vector Graphic - Fill')
          fill.property('Color').setValue(cmd.fillColor)
          if (cmd.strokeColor) {
            var stroke = group.property('Contents').addProperty('ADBE Vector Graphic - Stroke')
            stroke.property('Color').setValue(cmd.strokeColor)
            if (cmd.strokeWidth) stroke.property('Stroke Width').setValue(cmd.strokeWidth)
          }
        }
        group.property('Transform').property('Position').setValue(cmd.position)
        return ok('rectangle "' + cmd.name + '" added', { layerId: shape.id })
      }

      case 'add_footage_layer': {
        var comp = getComp(cmd.compId)
        if (!comp) return fail('composition not found')
        var io = new ImportOptions(new File(cmd.filePath))
        if (!io.canImportWithDialog ? false : !app.project.importFile) {}
        app.project.importFile(io)
        var foot = app.project.item(app.project.numItems)
        var fl = comp.layers.add(foot)
        if (cmd.name) fl.name = cmd.name
        fl.property('Transform').property('Position').setValue([comp.width / 2, comp.height / 2])
        return ok('footage layer "' + (cmd.name || cmd.filePath) + '" added', { layerId: fl.id })
      }

      case 'add_audio_layer': {
        var comp = getComp(cmd.compId)
        if (!comp) return fail('composition not found')
        var io = new ImportOptions(new File(cmd.filePath))
        app.project.importFile(io)
        var foot = app.project.item(app.project.numItems)
        var al = comp.layers.add(foot)
        if (cmd.name) al.name = cmd.name
        if (cmd.startTime) al.startTime = cmd.startTime
        return ok('audio layer "' + (cmd.name || cmd.filePath) + '" added', { layerId: al.id })
      }

      case 'add_null_layer': {
        var comp = getComp(cmd.compId)
        if (!comp) return fail('composition not found')
        var nl = comp.layers.addNull(comp.duration)
        nl.name = cmd.name
        return ok('null layer "' + cmd.name + '" added', { layerId: nl.id })
      }

      case 'set_property': {
        var comp = getComp(cmd.compId)
        if (!comp) return fail('no active composition')
        var layer = findLayer(comp, cmd.layerName)
        if (!layer) return fail('layer "' + cmd.layerName + '" not found')
        if (cmd.propertyPath === 'Source Text') {
          var td2 = new TextDocument(String(cmd.value))
          layer.property('Source Text').setValue(td2)
        } else {
          resolveProp(layer, cmd.propertyPath).setValue(cmd.value)
        }
        return ok('set ' + cmd.propertyPath + ' on "' + cmd.layerName + '"')
      }

      case 'set_keyframes': {
        var comp = getComp(cmd.compId)
        if (!comp) return fail('no active composition')
        var layer = findLayer(comp, cmd.layerName)
        if (!layer) return fail('layer "' + cmd.layerName + '" not found')
        var prop = resolveProp(layer, cmd.propertyPath)
        for (var i = 0; i < cmd.keyframes.length; i++) {
          prop.setValueAtTime(cmd.keyframes[i].time, cmd.keyframes[i].value)
        }
        return ok('animated ' + cmd.propertyPath + ' on "' + cmd.layerName + '" (' + cmd.keyframes.length + ' keyframes)')
      }

      case 'set_layer_timing': {
        var comp = getComp(cmd.compId)
        if (!comp) return fail('no active composition')
        var layer = findLayer(comp, cmd.layerName)
        if (!layer) return fail('layer "' + cmd.layerName + '" not found')
        layer.inPoint = cmd.inPoint
        layer.outPoint = cmd.outPoint
        return ok('"' + cmd.layerName + '" timing ' + cmd.inPoint + 's -> ' + cmd.outPoint + 's')
      }

      case 'apply_effect': {
        var comp = getComp(cmd.compId)
        if (!comp) return fail('no active composition')
        var layer = findLayer(comp, cmd.layerName)
        if (!layer) return fail('layer "' + cmd.layerName + '" not found')
        var fx
        try {
          fx = layer.property('Effects').addProperty(cmd.effectName)
        } catch (e) {
          return fail('effect "' + cmd.effectName + '" not found (use the AE match name, e.g. "ADBE Gaussian Blur 2")')
        }
        if (cmd.properties) {
          var keys = Object.keys(cmd.properties)
          for (var k = 0; k < keys.length; k++) {
            try { fx.property(keys[k]).setValue(cmd.properties[keys[k]]) } catch (e2) {}
          }
        }
        return ok('effect "' + cmd.effectName + '" applied to "' + cmd.layerName + '"')
      }

      case 'add_marker': {
        var comp = getComp(cmd.compId)
        if (!comp) return fail('no active composition')
        var mv = new MarkerValue(cmd.label)
        if (cmd.comment) mv.comment = cmd.comment
        comp.markerProperty.setValueAtTime(cmd.time, mv)
        return ok('marker "' + cmd.label + '" @ ' + cmd.time + 's')
      }

      case 'set_work_area': {
        var comp = getComp(cmd.compId)
        if (!comp) return fail('no active composition')
        comp.workAreaStart = cmd.start
        comp.workAreaDuration = cmd.end - cmd.start
        return ok('work area ' + cmd.start + 's -> ' + cmd.end + 's')
      }

      case 'precompose': {
        var comp = getComp(cmd.compId)
        if (!comp) return fail('no active composition')
        var indices = []
        for (var i = 0; i < cmd.layerNames.length; i++) {
          var lyr = findLayer(comp, cmd.layerNames[i])
          if (lyr) indices.push(lyr.index)
        }
        if (indices.length === 0) return fail('no matching layers to precompose')
        var pre = comp.layers.precompose(indices, cmd.name, false)
        var preId = newId()
        comps[preId] = pre
        return ok('precomposed ' + indices.length + ' layer(s) into "' + cmd.name + '" (compId=' + preId + ')', { compId: preId })
      }

      case 'save_project':
        app.project.save(new File(cmd.path))
        return ok('project saved to ' + cmd.path)

      case 'add_to_render_queue': {
        var comp = getComp(cmd.compId)
        if (!comp) return fail('composition not found')
        var rqi = app.project.renderQueue.items.add(comp)
        var om = rqi.outputModule(1)
        if (cmd.outputModule) {
          try { om.applyTemplate(cmd.outputModule) } catch (e) {}
        }
        if (cmd.outputPath) om.file = new File(cmd.outputPath)
        return ok('"' + comp.name + '" added to render queue')
      }

      case 'render':
        app.project.renderQueue.render()
        return ok('render queue started')

      case 'get_comp_state': {
        var comp = getComp(cmd.compId)
        if (!comp) return fail('no active composition')
        return ok('comp state: ' + comp.numLayers + ' layer(s)', serializeComp(comp))
      }

      case 'run_extendscript': {
        try {
          eval(cmd.code)
          return ok('script executed')
        } catch (e) {
          return fail('script error: ' + e.toString())
        }
      }

      case 'checkpoint': {
        var mainFile = app.project.file
        if (!mainFile) {
          var tmpPath = Folder.temp.fsName + '/framey-unsaved-' + new Date().getTime() + '.aep'
          app.project.save(new File(tmpPath))
          mainFile = app.project.file
        }
        var cpFolderPath = mainFile.parent.fsName + '/_framey_checkpoints'
        var cpFolder = new Folder(cpFolderPath)
        if (!cpFolder.exists) cpFolder.create()
        var label = cmd.label || ('cp-' + (++cpSeq))
        var cpFile = new File(cpFolderPath + '/' + label + '.aep')
        app.project.save(cpFile)
        return ok('checkpoint "' + label + '" saved', { label: label })
      }

      case 'revert_checkpoint': {
        var mainFile = app.project.file
        if (!mainFile) return fail('no project file to revert from')
        var cpFolderPath = mainFile.parent.fsName + '/_framey_checkpoints'
        var cpFolder = new Folder(cpFolderPath)
        if (!cpFolder.exists) return fail('no checkpoints folder')
        var cpFile
        if (cmd.label) {
          cpFile = new File(cpFolderPath + '/' + cmd.label + '.aep')
          if (!cpFile.exists) return fail('checkpoint "' + cmd.label + '" not found')
        } else {
          var files = cpFolder.getFiles('*.aep')
          if (!files || files.length === 0) return fail('no checkpoints to revert to')
          cpFile = files[files.length - 1]
        }
        app.open(cpFile)
        comps = {}
        var newActiveId = ''
        for (var ri = 1; ri <= app.project.numItems; ri++) {
          var item = app.project.item(ri)
          if (item instanceof CompItem) {
            var rid = newId()
            comps[rid] = item
            if (!newActiveId && app.project.activeItem && app.project.activeItem.id === item.id) newActiveId = rid
          }
        }
        if (!newActiveId) {
          for (var k in comps) { newActiveId = k; break }
        }
        return ok('reverted to checkpoint (active compId=' + newActiveId + ')', { compId: newActiveId })
      }

      default:
        return fail('unknown command: ' + cmd.type)
    }
  }

  // ── comp serialization → CompState ───────────────────────────────────────
  function layerType(layer) {
    if (layer instanceof TextLayer) return 'text'
    if (layer instanceof ShapeLayer) return 'shape'
    if (layer.nullLayer) return 'null'
    if (layer.source && layer.source.mainSource instanceof SolidSource) return 'solid'
    if (layer.hasAudio && !layer.hasVideo) return 'audio'
    return 'footage'
  }

  function readPropKeyframes(prop) {
    var kfs = []
    if (prop.numKeys > 0) {
      for (var k = 1; k <= prop.numKeys; k++) {
        kfs.push({ time: prop.keyTime(k), value: prop.keyValue(k) })
      }
    }
    return kfs
  }

  function serializeLayer(layer, comp) {
    var type = layerType(layer)
    var obj = {
      id: 'ae_' + layer.index,
      index: layer.index - 1,
      name: layer.name,
      type: type,
      enabled: layer.enabled,
      inPoint: layer.inPoint,
      outPoint: layer.outPoint,
      animatedProperties: {},
      effects: []
    }
    var tr = layer.property('Transform')
    var paths = ['Position', 'Scale', 'Opacity', 'Rotation']
    for (var i = 0; i < paths.length; i++) {
      var prop = tr.property(paths[i])
      var full = 'Transform.' + paths[i]
      var kfs = readPropKeyframes(prop)
      if (kfs.length > 0) {
        obj.animatedProperties[full] = kfs
      } else {
        var v = prop.value
        if (paths[i] === 'Position') obj.position = [v[0], v[1]]
        else if (paths[i] === 'Scale') obj.scale = [v[0], v[1]]
        else if (paths[i] === 'Opacity') obj.opacity = v
        else if (paths[i] === 'Rotation') obj.rotation = v
      }
    }
    // expressions on transform properties
    obj.expressions = {}
    for (var pi2 = 0; pi2 < paths.length; pi2++) {
      try {
        var exprProp = tr.property(paths[pi2])
        var exprTxt = exprProp.expression
        if (exprTxt && String(exprTxt).length > 0) obj.expressions['Transform.' + paths[pi2]] = String(exprTxt)
      } catch (e) {}
    }
    if (Object.keys(obj.expressions).length === 0) delete obj.expressions
    // masks
    obj.masks = []
    try {
      var maskParade = layer.property('ADBE Mask Parade')
      if (maskParade) {
        for (var mi = 1; mi <= maskParade.numProperties; mi++) {
          try { obj.masks.push(maskParade.property(mi).name) } catch (e) {}
        }
      }
    } catch (e) {}
    if (obj.masks.length === 0) delete obj.masks

    if (type === 'text') {
      try {
        var td = layer.property('Source Text').value
        obj.text = td.text
        obj.fontSize = td.fontSize
        obj.fillColor = td.fillColor
      } catch (e) {}
    }
    if (type === 'solid' || type === 'shape') {
      try { obj.color = layer.source.mainSource.color } catch (e) {}
    }
    // effects (with their property values, like AEKnowledgeExtractorV2)
    try {
      var fx = layer.property('Effects')
      for (var f = 1; f <= fx.numProperties; f++) {
        var effect = fx.property(f)
        var props = {}
        try {
          for (var epI = 1; epI <= effect.numProperties; epI++) {
            var ep = effect.property(epI)
            try { props[ep.name] = ep.value } catch (e2) {}
          }
        } catch (e3) {}
        obj.effects.push({ name: effect.name, properties: props, enabled: effect.enabled })
      }
    } catch (e) {}
    return obj
  }

  function serializeComp(comp) {
    var layers = []
    for (var i = 1; i <= comp.numLayers; i++) layers.push(serializeLayer(comp.layer(i), comp))
    var markers = []
    try {
      var mp = comp.markerProperty
      for (var m = 1; m <= mp.numKeys; m++) {
        var mv = mp.keyValue(m)
        markers.push({ time: mp.keyTime(m), label: mv.comment || ('marker ' + m), comment: mv.comment, type: 'chapter' })
      }
    } catch (e) {}
    var rq = []
    for (var r = 1; r <= app.project.renderQueue.numItems; r++) {
      var item = app.project.renderQueue.item(r)
      if (item.comp.id === comp.id) {
        rq.push({ compId: '', outputModule: item.outputModule(1).name, outputPath: item.outputModule(1).file ? item.outputModule(1).file.fsName : '', status: 'queued' })
      }
    }
    return {
      id: comp.id,
      name: comp.name,
      width: comp.width,
      height: comp.height,
      frameRate: comp.frameRate,
      durationSeconds: comp.duration,
      bgColor: comp.bgColor,
      layers: layers,
      markers: markers,
      renderQueue: rq,
      savedPath: app.project.file ? app.project.file.fsName : undefined
    }
  }

  function pushComp() {
    var comp = app.project.activeItem
    if (comp && comp instanceof CompItem) send({ type: 'comp', comp: serializeComp(comp) })
  }

  return { connect: connect, poll: poll }
})()

framey.connect()
