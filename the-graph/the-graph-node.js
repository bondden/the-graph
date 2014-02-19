(function (context) {
  "use strict";

  var TheGraph = context.TheGraph;

  // Polymer monkeypatch
  window.PointerGestures.dispatcher.recognizers.hold.HOLD_DELAY = 500;


  // Node view
  TheGraph.Node = React.createClass({
    mixins: [
      TheGraph.mixins.Tooltip,
      TheGraph.mixins.SavePointer
    ],
    componentDidMount: function () {
      // Dragging
      this.getDOMNode().addEventListener("trackstart", this.onTrackStart);

      // Hover/tap when edge preview is active
      this.getDOMNode().addEventListener("mouseenter", this.edgeConnectOffer);

      // Context menu
      this.getDOMNode().addEventListener("pointerdown", this.stopPropagation);
      this.getDOMNode().addEventListener("pointerup", this.stopPropagation);
      this.getDOMNode().addEventListener("contextmenu", this.showContext);
      this.getDOMNode().addEventListener("hold", this.showContext);
    },
    onTrackStart: function (event) {
      // Don't drag graph
      event.stopPropagation();

      this.getDOMNode().addEventListener("track", this.onTrack);
      this.getDOMNode().addEventListener("trackend", this.onTrackEnd);
    },
    onTrack: function (event) {
      // Don't fire on graph
      event.stopPropagation();

      var scale = this.props.app.state.scale;
      var deltaX = Math.round( event.ddx / scale );
      var deltaY = Math.round( event.ddy / scale );

      // Fires a change event on noflo graph, which triggers redraw
      if (this.props.export) {
        var newPos = {
          x: this.props.export.metadata.x + deltaX,
          y: this.props.export.metadata.y + deltaY
        };
        if (this.props.isIn) {
          this.props.graph.setInportMetadata(this.props.exportKey, newPos);
        } else {
          this.props.graph.setOutportMetadata(this.props.exportKey, newPos);
        }
      } else {
        this.props.graph.setNodeMetadata(this.props.key, {
          x: this.props.node.metadata.x + deltaX,
          y: this.props.node.metadata.y + deltaY
        });
      }
    },
    onTrackEnd: function (event) {
      // Don't fire on graph
      event.stopPropagation();

      this.getDOMNode().removeEventListener("track", this.onTrack);
      this.getDOMNode().removeEventListener("trackend", this.onTrackEnd);
    },
    stopPropagation: function (event) {
      // HACK to keep context menu from cancelling preview edge
      if (event.buttons && event.buttons===2) {
        event.stopPropagation();
      }
    },
    showContext: function (event) {
      // Don't show native context menu
      event.preventDefault();

      // Don't tap graph on hold event
      event.stopPropagation();
      if (event.preventTap) { event.preventTap(); }

      // Get mouse position
      var x = event.clientX;
      var y = event.clientY;
      if (x === undefined) {
        x = this.pointerX;
        y = this.pointerY;
      }

      var contextEvent = new CustomEvent('the-graph-context-show', { 
        detail: {
          element: this,
          x: x,
          y: y
        },
        bubbles: true
      });
      this.getDOMNode().dispatchEvent(contextEvent);
    },
    getContext: function (x, y) {
      // If this node is an export
      if (this.props.export) {
        return TheGraph.ExportMenu({
          graph: this.props.graph,
          export: this.props.export,
          exportKey: this.props.exportKey,
          isIn: this.props.isIn,
          x: x,
          y: y
        });
      }

      // Absolute position of node
      var scale = this.props.app.state.scale;
      var appX = this.props.app.state.x;
      var appY = this.props.app.state.y;
      var nodeX = (this.props.x + TheGraph.nodeSize/2) * scale + appX;
      var nodeY = (this.props.y + TheGraph.nodeSize/2) * scale + appY;
      var deltaX = nodeX - x;
      var deltaY = nodeY - y;
      var ports = this.props.ports;
      var processKey = this.props.key;

      // If there is a preview edge started, only show connectable ports
      if (this.props.graphView.state.edgePreview) {
        if (this.props.graphView.state.edgePreview.isIn) {
          // Show outputs
          return TheGraph.NodeMenuPorts({
            ports: ports.outports,
            isIn: false,
            scale: scale,
            processKey: processKey,
            deltaX: deltaX,
            deltaY: deltaY,
            translateX: x,
            translateY: y
          });
        } else {
          // Show inputs
          return TheGraph.NodeMenuPorts({
            ports: ports.inports,
            isIn: true,
            scale: scale,
            processKey: processKey,
            deltaX: deltaX,
            deltaY: deltaY,
            translateX: x,
            translateY: y
          });
        }
      }

      // Default, show whole node menu
      return TheGraph.NodeMenu({
        key: "context." + this.props.key,
        modal: true,
        label: this.props.label,
        graph: this.props.graph,
        graphView: this.props.graphView,
        node: this,
        icon: this.props.icon,
        ports: ports,
        process: this.props.process,
        processKey: processKey,
        x: x,
        y: y,
        deltaX: deltaX,
        deltaY: deltaY
      });
    },
    getTooltipTrigger: function () {
      return this.getDOMNode();
    },
    shouldShowTooltip: function () {
      return (this.props.app.state.scale < TheGraph.zbpNormal);
    },
    dirty: false,
    shouldComponentUpdate: function (nextProps, nextState) {
      // Only rerender if moved
      return (
        this.dirty ||
        nextProps.icon !== this.props.icon ||
        nextProps.x !== this.props.x || 
        nextProps.y !== this.props.y
      );
    },
    render: function() {
      this.dirty = false;

      // var metadata = this.props.node.metadata;

      var label = this.props.label;
      var sublabel = this.props.sublabel;
      if (!sublabel || sublabel === label) {
        sublabel = "";
      }
      var x = this.props.x;
      var y = this.props.y;

      // Ports
      var keys, count, index;
      var processKey = this.props.key;
      var app = this.props.app;
      var graph = this.props.graph;
      var isExport = (this.props.export !== undefined);

      // Inports
      var inports = this.props.ports.inports;
      keys = Object.keys(inports);
      count = keys.length;
      index = 0;
      var inportViews = keys.map(function(key){
        var info = inports[key];
        info.graph = graph;
        info.isExport = isExport;
        // info.y = TheGraph.nodeRadius + (TheGraph.nodeSide / (count+1) * (index+1));
        info.y = TheGraph.nodeSize / (count+1) * (index+1);
        info.nodeX = x;
        info.nodeY = y;
        info.key = processKey + ".in." + info.label;
        info.processKey = processKey;
        info.app = app;
        info.r = Math.min(4, TheGraph.nodeSide/(count*2));
        info.isIn = true;
        index++;
        return TheGraph.Port(info);
      });

      // Outports
      var outports = this.props.ports.outports;
      keys = Object.keys(outports);
      count = keys.length;
      index = 0;
      var outportViews = keys.map(function(key){
        var info = outports[key];
        info.graph = graph;
        info.isExport = isExport;
        info.y = TheGraph.nodeSize / (count+1) * (index+1);
        info.nodeX = x;
        info.nodeY = y;
        info.key = processKey + ".out." + info.label;
        info.processKey = processKey;
        info.app = app;
        info.r = Math.min(4, TheGraph.nodeSide/(count*2));
        info.isIn = false;
        index++;
        return TheGraph.Port(info);
      });

      // Make sure icon exists
      var icon = TheGraph.FONT_AWESOME[ this.props.icon ];
      if (!icon) { 
        icon = TheGraph.FONT_AWESOME.cog;
      }

      return (
        React.DOM.g(
          {
            className: "node drag",
            name: this.props.key,
            key: this.props.key,
            title: label,
            transform: "translate("+x+","+y+")"
          },
          React.DOM.rect({
            className: "node-bg", // HACK to make the whole g draggable
            width: TheGraph.nodeSize,
            height: TheGraph.nodeSize + 35
          }),
          React.DOM.rect({
            className: "node-rect drag",
            width: TheGraph.nodeSize,
            height: TheGraph.nodeSize,
            rx: TheGraph.nodeRadius,
            ry: TheGraph.nodeRadius
          }),
          React.DOM.text({
            ref: "icon",
            className: "icon node-icon drag",
            x: TheGraph.nodeSize/2,
            y: TheGraph.nodeSize/2,
            children: icon
          }),
          React.DOM.g({
            className: "inports",
            children: inportViews
          }),
          React.DOM.g({
            className: "outports",
            children: outportViews
          }),
          TheGraph.TextBG({
            className: "node-label-bg",
            textClassName: "node-label",
            height: 14,
            halign: "center",
            x: TheGraph.nodeSize/2,
            y: TheGraph.nodeSize + 15,
            text: label
          }),
          TheGraph.TextBG({
            className: "node-sublabel-bg",
            textClassName: "node-sublabel",
            height: 9,
            halign: "center",
            x: TheGraph.nodeSize/2,
            y: TheGraph.nodeSize + 30,
            text: sublabel
          })
        )
      );
    }
  });


})(this);