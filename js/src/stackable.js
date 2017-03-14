import * as d3 from "d3";
var uniqueId = (function() {
  if (window.uniqueId) { console.warn('uniqueId function might have issues.'); }
  var i = 0;
  return function() {
    return "sanity-unique-id-" + i++;
  };
})();

// d3 uses the size of the entire <svg/> node to determine the zoom extent. This
// causes it to incorrectly handle the translateExtent if you're catching zoom
// events with a rect that's smaller than the SVG. But d3 lets you specify your
// own extent function, so there's a solution!
function svgRectExtent() {
  var e = this, w, h;

  return [[0, 0],
          [e.width.baseVal.value,
           e.height.baseVal.value]];
}

//
// SHARED CHART CODE
//

function layeredTimeSeries() {
  var colorScale,
      x,
      y;

  function stretch(selection) {
    selection.each(function(data) {
      var pixelsPerTimestep =
        (x.range()[1] - x.range()[0]) /
        (x.domain()[1] - x.domain()[0]);
      d3.select(this).selectAll('.stretchMe')
        .attr('transform', 'scale(' + pixelsPerTimestep +
              ',1)translate(' + (-x.domain()[0]) + ',0)');
    });
  }

  var chart = function (selection) {
    selection.each(function(data) {
      var stretchMe = d3.select(this).selectAll('.stretchMe')
          .data([data]);

      stretchMe.exit()
        .remove();

      stretchMe = stretchMe.enter()
        .append('g')
          .attr('class', 'stretchMe')
        .merge(stretchMe);

      var layer = stretchMe.selectAll('.layer')
          .data(function (d) {return d;});

      layer.exit()
        .remove();

      layer = layer.enter()
        .append('path')
          .attr('class', 'layer')
          .attr('stroke', 'none')
        .merge(layer);

      layer.attr('fill', function(d, i) { return colorScale(d.key); })
        .attr('d', function (data) {
          var ds = data.values;
          return ds.map(function(d) {
            var x0 = d.x0,
                x1 = d.x1,
                y0 = y(d.y0 + d.y),
                y1 = y(d.y0);
            return ['M', x0, y0,
                    'L', x1, y0,
                    'L', x1, y1,
                    'L', x0, y1,
                    'Z'].join(' ');
          }).join(' ');
        });
    }).call(stretch);
  };

  chart.stretch = stretch;

  chart.colorScale = function(_) {
    if (!arguments.length) return colorScale;
    colorScale = _;
    return chart;
  };

  chart.x = function(_) {
    if (!arguments.length) return x;
    x = _;
    return chart;
  };

  chart.y = function(_) {
    if (!arguments.length) return y;
    y = _;
    return chart;
  };

  return chart;
}

//
// SPECIFIC CHARTS
//


function columnStatesPlot() {
  var margin = {top: 4, right: 350, bottom: 4, left: 0},
      height = 60 - margin.top - margin.bottom,
      stackOrder = [{key: 'n-unpredicted-active-columns',
                     color: 'hsl(0,100%,50%)',
                     activeText: 'active',
                     predictedText: 'not predicted'},
                    {key: 'n-predicted-active-columns',
                     color: 'hsl(270,100%,40%)',
                     activeText: 'active',
                     predictedText: 'predicted'},
                    {key: 'n-predicted-inactive-columns',
                     color: 'hsla(210,100%,50%,0.5)',
                     activeText: 'not active',
                     predictedText: 'predicted'}],
  layeredTimeSeriesChart = layeredTimeSeries()
    .colorScale(d3.scaleOrdinal()
                .domain(stackOrder.map(function(d) { return d.key; }))
                .range(stackOrder.map(function(d) { return d.color; }))),
  chartWidth,
  xSamples;

  function stretch(selection) {
    selection.each(function(timesteps) {
      d3.select(this)
        .select('.chartViewport')
        .call(layeredTimeSeriesChart.stretch);
    });
  }

  function render(selection) {
    selection.each(function(timesteps) {
      var y0s = new Array(timesteps.length).fill(0);

      var layers = [];
      stackOrder.forEach(function(o) {
        var values = xSamples.map(function(data) {
          var y = timesteps[data.x][o.key] || 0;

          var y0 = y0s[data.x];
          y0s[data.x] += y;

          return {x: data.x, x0: data.x0, x1: data.x1, y: y, y0: y0};
        });
        layers.push({
          key: o.key,
          values: values
        });
      });

      // TODO use the new d3 stack
      // var stack = d3.stack()
      //         .values(function(d) { return d.values; });
      // stack(layers); // inserts y0 values
      d3.select(this)
        .select('.chartViewport')
        .datum(layers)
        .call(layeredTimeSeriesChart);
    });
  }

  var chart = function (selection) {
    selection.each(function(timesteps) {
      var clipId = uniqueId();

      var svg = d3.select(this).selectAll('.columnStatesPlot')
          .data([timesteps]);

      svg.exit()
        .remove();

      svg = svg.enter()
        .append('svg')
        .attr('class', 'columnStatesPlot')
        .attr('width', chartWidth + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .call(entering => {

          entering.append('defs')
            .append('clipPath')
            .attr('id', clipId)
            .append('rect')
            .attr('width', chartWidth)
            .attr('height', height);

          entering.append('g')
            .attr('transform',
                  'translate(' + margin.left + ',' + margin.top + ')')
            .call(function(chartAndAxis) {
              chartAndAxis.append('g')
                .attr('class', 'chartViewport')
                .style('clip-path', 'url(#' + clipId + ')');

              chartAndAxis.append('g')
                .attr('transform', 'translate(' + chartWidth + ', 0)')
                .attr('class', 'y axis');
            });

          entering.append('g')
            .attr('transform', 'translate(' + (chartWidth+50) + ',10)')
            .call(function(help) {
              // Title
              help.append('text')
                .attr('class', 'noselect')
                .attr('text-anchor', 'right')
                .attr('x', 5)
                .attr('y', 0)
                .text('active and predicted columns, stacked by:');

              // Legend
              var unitWidth = 80;
              help.append('g')
                .attr('class', 'noselect')
                .attr('transform', 'translate(24, 20)')
                .selectAll('g')
                .data(stackOrder)
                .enter()
                .append('g')
                .attr('transform', function(d, i) {
                  return 'translate(' + i * unitWidth + ',0)';
                })
                .call(function(color) {
                  color.append('rect')
                    .attr('width', unitWidth)
                    .attr('height', 4)
                    .attr('fill', function(d, i) { return d.color; });
                  color.append('text')
                    .attr('x', unitWidth/2)
                    .attr('dy', '-0.24em')
                    .attr('text-anchor', 'middle')
                    .text(function(d, i) { return d.activeText; });
                  color.append('text')
                    .attr('x', unitWidth/2)
                    .attr('y', 14)
                    .attr('text-anchor', 'middle')
                    .text(function(d, i) { return d.predictedText; });
                });
            });

          entering
            .append('rect')
            .attr('class', 'zoomCatcher')
            .attr('x', margin.left)
            .attr('y', margin.top)
            .attr('width', chartWidth)
            .attr('height', height)
            .attr('fill', 'transparent')
            .attr('stroke', 'none');
        })
        .merge(svg);

      var ymax = d3.max(timesteps,
                        function(d) {
                          return stackOrder.reduce(function(sum, o) {
                            return sum + d[o.key];
                          }, 0);
                        }),
      y = d3.scaleLinear()
        .domain([0, ymax])
        .range([height, 0]);

      layeredTimeSeriesChart.y(y);
      svg.select('.y.axis')
        .call(d3.axisRight()
              .scale(y)
              .ticks(4)
              .tickPadding(2)
              .tickSize(4)
              .tickSizeOuter(0));
    });

    render(selection);
  };

  chart.stretch = stretch;

  chart.render = render;

  chart.x = function(_) {
    if (!arguments.length) return layeredTimeSeriesChart.x();
    layeredTimeSeriesChart.x(_);
    return chart;
  };

  chart.xSamples = function(_) {
    if (!arguments.length) return xSamples;
    xSamples = _;
    return chart;
  };

  chart.chartWidth = function (_) {
    if (!arguments.length) return chartWidth;
    chartWidth = _;
    return chart;
  };

  return chart;
}

function zoomableTimeSeries(node, nTimesteps) {
  var chartWidth = 600;

  var state = {
    chartWidth: chartWidth,
    chartLeft: 40,
    k: 1,
    x: d3.scaleLinear()
      .range([0, chartWidth]),
    onxscalechanged: [], // callbacks
    onxsampleschanged: [], // callbacks
    charts: null,
    xSamples: [],
    onTimestepCountKnown: null
  };

  var onZoomScaleExtentChanged = [], // callbacks
      timestepCount,
      containerDiv = d3.select(node)
      .append('div')
    .attr('class', 'zoomableTimeSeries')
      .style('position', 'relative')
      .style('font', '10px sans-serif');

  state.zoom = d3.zoom()
    .extent(svgRectExtent)
    .translateExtent(
      [[0, 0],
       [chartWidth, 0]]
    )
    .on('zoom', function() {
      let scaledX = d3.event.transform.rescaleX(state.x);
      state.k = d3.event.transform.k;
      state.onxscalechanged.forEach(function(f) { f(scaledX,
                                                    d3.event.transform.k,
                                                    true); });
    });

  //
  // SHARED X AXIS: TOP
  //
  (function() {
    var xAxis = d3.axisTop()
      .scale(state.x)
      .tickPadding(3)
      .tickSize(0)
      .tickSizeOuter(0)
      .tickFormat(d3.format('d')),
    marginLeft = 3,
    svg = containerDiv.append('svg')
      .attr('width', chartWidth + 10)
      .attr('height', 30)
      .style('position', 'relative')
      .style('left', (state.chartLeft-marginLeft) + 'px'),
    xAxisNode = svg.append('g')
      .attr('class', 'x axis noselect')
      .attr('transform', 'translate(' + marginLeft + ',30)')
      .append('g');

    svg.append('text')
      .attr('class', 'x noselect')
      .attr('x', marginLeft)
      .attr('y', 10)
      .text('timestep');

    state.onxscalechanged.push(function (transformedX, k) {
      var extent = transformedX.domain(),
          domainWidth = extent[1] - extent[0],
          pixelsPerTimestep = chartWidth / domainWidth,
          tickShift = pixelsPerTimestep / 2;
      xAxis
        .scale(transformedX)
        .ticks(Math.min(domainWidth, 15));
      xAxisNode.call(xAxis);
      xAxisNode.attr('transform', 'translate(' + tickShift + ',' + '0)');
    });
  })();

  state.charts = containerDiv.append('div');

  var xSamplesDomain = [null, null]; // callbacks

  state.onTimestepCountKnown = function (count) {
    if (!timestepCount || count > timestepCount) {
      timestepCount = count;
      state.x.domain([0, count]);

      state.zoom
        .scaleExtent([1, 40]);

      state.onxscalechanged.forEach(function(f) { f(state.x); });
      onZoomScaleExtentChanged.forEach(function(f) { f(); });
    }
  };

  //
  // SHARED X AXIS + ZOOM WIDGET
  //
  (function() {
    var xAxis = d3.axisBottom()
      .scale(state.x)
      .tickPadding(3)
      .tickSize(0)
      .tickSizeOuter(0)
      .tickFormat(d3.format('d')),
    marginLeft = 3,
    svg = containerDiv.append('svg')
      .attr('width', chartWidth + 10)
      .attr('height', 40)
      .style('position', 'relative')
      .style('left', (state.chartLeft-marginLeft) + 'px'),
    xAxisNode = svg.append('g')
      .attr('class', 'x axis noselect')
      .attr('transform', 'translate(' + marginLeft + ',0)')
      .append('g');
    state.onxscalechanged.push(function (transformedX, k) {
      var extent = transformedX.domain(),
          domainWidth = extent[1] - extent[0],
          pixelsPerTimestep = chartWidth / domainWidth,
          tickShift = pixelsPerTimestep / 2;
      xAxis.ticks(Math.min(domainWidth, 15));
      xAxisNode.call(xAxis);
      xAxisNode.attr('transform', 'translate(' + tickShift + ',' + '0)');
    });

    svg.append('text')
      .attr('class', 'x noselect')
      .attr('x', marginLeft)
      .attr('y', 25)
      .text('timestep');

    //
    // ZOOM WIDGET
    //
    (function() {
      var grooveWidth = 100,
          zoomer = svg
          .append('g')
        .attr('class', 'zoomer')
        .attr('transform', 'translate(' + (chartWidth-(grooveWidth+40)+marginLeft) + ',17)'),
      knobWidth = 4,
      knobHeight = 20,
      groove = zoomer.append('g')
        .attr('transform', 'translate(20, 0)'),
      grooveX = d3.scaleLog()
        .domain([1, 5]) // default while waiting for csv
        .range([0, grooveWidth - knobWidth]);
      onZoomScaleExtentChanged.push(function() {
        grooveX.domain(state.zoom.scaleExtent());
        placeKnob();
      });
      groove.append('rect')
        .attr('x', 0)
        .attr('y', 8)
        .attr('width', grooveWidth)
        .attr('height', 3)
        .attr('stroke', 'lightgray')
        .attr('fill', 'none');
      groove.append('rect')
        .attr('class', 'clickable')
        .attr('width', grooveWidth)
        .attr('height', 20)
        .attr('stroke', 'none')
        .attr('fill', 'transparent')
        .on('click', function () {
          var x = d3.event.clientX - d3.event.target.getBoundingClientRect().left;
          state.zoom.scaleTo(state.charts.selectAll('rect.zoomCatcher'),
                             grooveX.invert(x));
        });

      [{text: '+',
        translateX: grooveWidth + 20,
        onclick: function() {
          var x = Math.min(grooveWidth - knobWidth, grooveX(state.k) + 5);
          state.zoom.scaleTo(
            state.charts.selectAll('rect.zoomCatcher')
              .transition(250).ease(d3.easeLinear),
            grooveX.invert(x));
        }},
       {text: '-',
        translateX: 0,
        onclick: function() {
          var x = Math.max(0, grooveX(state.k) - 5);
          state.zoom.scaleTo(
            state.charts.selectAll('rect.zoomCatcher')
              .transition(250).ease(d3.easeLinear),
            grooveX.invert(x));
        }}]
        .forEach(function(spec) {
          var button = zoomer.append('g')
            .attr('transform', 'translate(' +
                  spec.translateX + ',0)');
          button.append('text')
            .attr('class', 'noselect')
            .attr('x', 10)
            .attr('y', 10)
            .attr('dy', '.26em')
            .attr('text-anchor', 'middle')
            .style('font', '15px sans-serif')
            .style('font-weight', 'bold')
            .style('fill', 'gray')
            .text(spec.text);
          button.append('rect')
            .attr('width', 20)
            .attr('height', 20)
            .attr('stroke-width', 1)
            .attr('stroke', 'gray')
            .attr('fill', 'transparent')
            .attr('class', 'clickable')
            .on('click', spec.onclick);
        });

      var knob = groove.append('g')
        .attr('class', 'draggable')
        .attr('transform', function(d) {
          return 'translate(' + grooveX(d) + ',0)';
        }),
      knobBackground = knob.append('rect')
        .attr('width', knobWidth)
        .attr('height', knobHeight)
        .attr('fill', 'white')
        .attr('stroke', 'none'),
      knobProgress = knob.append('rect')
        .attr('width', knobWidth)
        .attr('fill', 'black')
        .attr('stroke', 'none'),
      knobTitle = knob.append('title');
      knob.append('rect')
        .attr('width', knobWidth)
        .attr('height', knobHeight)
        .attr('fill', 'transparent')
        .attr('stroke', 'gray')
        .call(d3.drag()
              .on('start', function() {
                zoomer.classed('dragging', true);
              })
              .on('drag', function() {
                var x = d3.event.sourceEvent.clientX -
                    groove.node().getBoundingClientRect().left;
                x = Math.max(0, x);
                x = Math.min(grooveWidth - knobWidth, x);
                state.zoom.scaleTo(state.charts.selectAll('rect.zoomCatcher'),
                                   grooveX.invert(x));
              })
              .on('end', function() {
                zoomer.classed('dragging', false);
              }));

      function placeKnob(transformedX, k) {
        var sampleRate = Math.min(k, 1);
        knob.attr('transform', 'translate(' + grooveX(k) + ',0)');
        var progressHeight = knobHeight * sampleRate;
        knobProgress
          .attr('height', progressHeight)
          .attr('y', knobHeight - progressHeight);
        knobTitle.text(sampleRate == 1 ?
                       "Displaying every timestep in this interval." :
                       ("Due to limited pixels, only " +
                        Math.round(sampleRate*100) +
                        "% of timesteps in this interval are shown."));
      }

      state.onxscalechanged.push(placeKnob);
    })();
  })();

  //
  // Resample logic
  //
  (function() {
    var queuedX = null;
    var drawTimeout = null;

    function xResample(transformedX) {
      transformedX = transformedX || queuedX;

      if (drawTimeout) {
        clearTimeout(drawTimeout);
        drawTimeout = null;
        queuedX = null;
      }

      var extent = transformedX.domain();
      if (xSamplesDomain[0] == extent[0] && xSamplesDomain[1] == extent[1]) {
        // No need to resample.
        return;
      }

      var xSamplesNew;
      if (extent[1] - extent[0] > chartWidth) {
        var bucketWidth = (extent[1] - extent[0]) / chartWidth,
        iPrevious = 0;
        xSamplesNew = d3.range(extent[0], extent[1], bucketWidth)
          .slice(0, chartWidth) // Floating point math can cause an extra.
          .map(function(x) {
            var data = {x0: x,
                        x1: Math.min(x + bucketWidth, extent[1])};
            while (iPrevious < state.xSamples.length &&
                   state.xSamples[iPrevious].x < data.x0) {
              iPrevious++;
            }

            if (iPrevious < state.xSamples.length &&
                state.xSamples[iPrevious].x < data.x1) {
              // When zooming / panning, the behavior is less
              // jarring if we reuse samples rather than
              // grabbing a new random sample.
              data.x = state.xSamples[iPrevious].x;
            }
            else {
              // Choose randomly from the interval.
              // Otherwise with repeating patterns we'll have aliasing.
              data.x = Math.random() * (data.x1 - data.x0) + data.x0;
              data.x = Math.round(data.x);
              if (data.x < data.x0) {
                data.x++;
              }
              else if (data.x >= data.x1) {
                data.x--;
              }
            }

            return data;
          });
      }
      else {
        // No sampling needed.
        xSamplesNew = d3.range(Math.floor(extent[0]), extent[1])
          .map(function(x) { return {x0: x, x: x, x1: x + 1 };});
      }
      state.xSamples = xSamplesNew;
      xSamplesDomain = [extent[0], extent[1]];
      state.onxsampleschanged.forEach(function(f) { f(); });
    }

    state.onxscalechanged.push(function(transformedX, k, maybeCoalesce) {
      queuedX = transformedX;

      if (!drawTimeout) {
        drawTimeout = setTimeout(xResample, maybeCoalesce ? 250 : 1000/60);
      }
    });
  })();

  return state;
}


function segmentLifetimesPlot() {
  var x,
      xExtent,
      y,
      ySamples,
      chartWidth,
      chartHeight;

  var chart = function(selection) {
    selection.each(function(allSegments) {
      var lifespanHeight = Math.max(4,
                                    (chartHeight / (y.domain()[1] - y.domain()[0]))
                                    - 16),
          badMatchColor = 'lightgreen',
          goodMatchColor = 'green',
          badActiveColor = 'lightskyblue',
          goodActiveColor = 'hsl(270,100%,40%)',
          match = {
            width: Math.max(1, chartWidth / (x.domain()[1] - x.domain()[0])),
            height: lifespanHeight,
            halfHeight: lifespanHeight / 2
          };

      var layerMap = {};

      var segments = ySamples.map(function(data) {
        var segment = allSegments[data.y];

        // Precedence
        var pixelColors = {};
        if (segment.incorrectMatches) {
          segment.incorrectMatches.forEach(function(timestep) {
            pixelColors[Math.floor(x(timestep))] = badMatchColor;
          });
        }
        if (segment.correctMatches) {
          segment.correctMatches.forEach(function(timestep) {
            pixelColors[Math.floor(x(timestep))] = goodMatchColor;
          });
        }
        if (segment.incorrectActivations) {
          segment.incorrectActivations.forEach(function(timestep) {
            pixelColors[Math.floor(x(timestep))] = badActiveColor;
          });
        }
        if (segment.correctActivations) {
          segment.correctActivations.forEach(function(timestep) {
            pixelColors[Math.floor(x(timestep))] = goodActiveColor;
          });
        }

        for (var xPixel in pixelColors)
        {
          xPixel = parseInt(xPixel);
          if (xPixel >= 0 && xPixel < chartWidth) {
            var color = pixelColors[xPixel];
            if (!layerMap[color]) {
              layerMap[color] = [];
            }

            layerMap[color].push({
              x: xPixel,
              y: y(data.ymid)
            });
          }
        }

        if (segment.y0) {
          console.log('WTF');
        }

        return {
          birthstep: segment.birthstep,
          deathstep: segment.deathstep,
          y0: data.y0,
          y1: data.y1,
          ymid: data.ymid
        };
      });

      var layers = [];
      for (var color in layerMap) {
        layers.push({
          color: color,
          occurrences: layerMap[color]
        });
      }

      var svg = d3.select(this).selectAll('.segmentLifetimesPlot')
          .data([segments]);

      svg.exit()
        .remove();

      svg = svg.enter()
        .append('svg')
        .attr('class', 'segmentLifetimesPlot')
        .attr('width', chartWidth + 400)
        .attr('height', chartHeight + 20 // not meaningful
             )
        .call(entering => {
          var clipId = uniqueId();

          entering.append('defs')
            .append('clipPath')
            .attr('id', clipId)
            .append('rect')
            .attr('width', chartWidth)
            .attr('height', chartHeight + 20);

          entering.append('g')
            .call(function(chartAndAxis) {
              var chartViewport = chartAndAxis.append('g')
                  .style('clip-path', 'url(#' + clipId + ')')
                  .append('g')
                  .attr('class', 'chartViewport')
                  .attr('transform',
                        'translate(0,' + 20 + ')');

              chartViewport.append('g')
                .attr('class', 'segmentLifetimes')
                .attr('stroke', 'none')
                .attr('fill', 'gainsboro');

              chartViewport.append('g')
                .attr('class', 'segmentActivity')
                .attr('stroke', 'none');

              chartAndAxis.append('g')
                .attr('transform', 'translate(' + chartWidth + ', 20)')
                .attr('class', 'y axis');

              chartViewport.append('rect')
                .attr('class', 'zoomCatcher')
                .attr('width', chartWidth)
                .attr('height', chartHeight)
                .attr('fill', 'transparent')
                .attr('stroke', 'none');
            });

          entering.append('g')
            .attr('transform', 'translate(' + (chartWidth+50) + ',25)')
            .call(function(help) {
              // Title
              help.append('text')
                .attr('class', 'noselect')
                .attr('text-anchor', 'right')
                .attr('x', 5)
                .attr('y', 0)
                .text('dendrite segment lifetimes');

              help.append('text')
                .attr('class', 'noselect')
                .attr('text-anchor', 'right')
                .attr('x', 24)
                .attr('y', 30)
                .text('sorted by birth step');

              // TODO this won't update if the number of segments updates.
              help.append('text')
                .attr('class', 'noselect')
                .attr('text-anchor', 'right')
                .attr('x', 24)
                .attr('y', 60);
              // .text('sampling ' + d3.format("0,000")(allSegments.length) + ' segments');

              help.append('text')
                .attr('class', 'noselect')
                .attr('text-anchor', 'right')
                .attr('x', 24)
                .attr('y', 90)
                .text('showing events:');

              // Legend
              var unitWidth = 20;
              var legendData = [{color: badMatchColor,
                                 text: 'segment match'},
                                {color: goodMatchColor,
                                 text: 'segment match, cell active'},
                                {color: badActiveColor,
                                 text: 'segment active'},
                                {color: goodActiveColor,
                                 text: 'segment active, cell active'}];
              help.append('g')
                .attr('class', 'noselect')
                .attr('transform', 'translate(0, 106)')
                .selectAll('g')
                .data(legendData)
                .enter()
                .append('g')
                .attr('transform', function(d, i) {
                  return 'translate(24,' + i * 16 + ')';
                })
                .call(function(color) {
                  color.append('rect')
                    .attr('width', unitWidth)
                    .attr('height', 6)
                    .attr('fill', function(d, i) { return d.color; });
                  color.append('text')
                    .attr('x', unitWidth + 5)
                    .attr('dy', '0.55em')
                    .text(function(d, i) { return d.text; });
                });
            });
        })
        .merge(svg);

      var chartViewport = svg.select('.chartViewport');

      var allLifetimes = chartViewport.select('.segmentLifetimes')
          .selectAll('.allLifetimes')
          .data([segments]);

      allLifetimes.exit()
        .remove();

      allLifetimes = allLifetimes.enter()
        .append('path')
        .attr('class', 'allLifetimes')
        .merge(allLifetimes);

      allLifetimes.attr('d', function(segments, i) {
          return segments.map(function(segment) {
            var x0 = x(segment.birthstep);
            var x1 = x(segment.deathstep || xExtent[1]);
            var y0 = y(segment.ymid) - match.halfHeight;
            var y1 = y(segment.ymid) + match.halfHeight;
            return ['M', x0, y0,
                    'L', x1, y0,
                    'L', x1, y1,
                    'L', x0, y1,
                    'Z'].join(' ');
          }).join(' ');
        });

      var activityColor = chartViewport.select('.segmentActivity').selectAll('.activityColor')
          .data(layers);

      activityColor.exit()
        .remove();

      activityColor = activityColor.enter()
        .append('path')
        .attr('class', 'activityColor')
        .attr('stroke', 'none')
        .merge(activityColor);

      activityColor.attr('fill', function(layer, i) { return layer.color; })
        .attr('d', function(layer, i) {
          return layer.occurrences.map(function(d) {
            return ['M', d.x, d.y - match.halfHeight,
                    'l', match.width, 0,
                    'l', 0, match.height,
                    'l', -match.width, 0,
                    'Z'].join(' ');
          }).join(' ');
        });

      svg.select('.y.axis')
        .call(d3.axisRight()
              .scale(y)
              .tickPadding(2)
              .tickSize(4)
              .tickSizeOuter(0));
    });
  };

  chart.xExtent = function(_) {
    if (!arguments.length) return xExtent;
    xExtent = _;
    return chart;
  };

  chart.x = function(_) {
    if (!arguments.length) return x;
    x = _;
    return chart;
  };

  chart.y = function(_) {
    if (!arguments.length) return y;
    y = _;
    return chart;
  };

  chart.ySamples = function(_) {
    if (!arguments.length) return ySamples;
    ySamples = _;
    return chart;
  };

  chart.chartWidth = function(_) {
    if (!arguments.length) return chartWidth;
    chartWidth = _;
    return chart;
  };

  chart.chartHeight = function(_) {
    if (!arguments.length) return chartHeight;
    chartHeight = _;
    return chart;
  };

  return chart;
}

function fetchAndInsertColumnStatesAndSegmentLifetimes(node, logUrl) {
  var container = zoomableTimeSeries(node);

  container.charts
      .append('div')
    .attr('class', 'loadingMsg')
    .style('position', 'absolute')
    .style('height', '100%')
    .style('width', '100%')
    .style('padding-top', '20px')
    .style('background-color', 'rgba(0,0,0,0.8)')
    .style('z-index', 1001)
    .style('color', 'white')
    .style('text-align', 'center')
    .style('letter-spacing', '1ex')
    .style('font-size', '48px')
    .style('font-weight', 'bold')
    .style('font-family', 'monospace')
    .text('fetching data...');

  d3.text(logUrl, function(error, contents) {
    insertColumnStatesAndSegmentLifetimes2(
      container, contents);

    container.charts.select('.loadingMsg')
      .remove();
  });
}

function insertColumnStatesAndSegmentLifetimes(
  node, logContents) {
  var container = zoomableTimeSeries(node);
  insertColumnStatesAndSegmentLifetimes2(container, logContents);
}

function insertColumnStatesAndSegmentLifetimes2(
  container, logContents) {

  var timesteps = [];
  var segments = [];

  (function() {
    var currentSegments = {};
    var currentTimestep = -1;

    d3.csvParseRows(logContents).forEach(row => {
      switch(row[0]) {
      case 't':
        currentTimestep = parseInt(row[1]);
        break;
      case 'columnActivity':
        timesteps.push({
          'n-predicted-active-columns': parseInt(row[1]),
          'n-unpredicted-active-columns': parseInt(row[2]),
          'n-predicted-inactive-columns': parseInt(row[3])
        });
        break;
      case 'createSegment':
        currentSegments[row[1]] = {
          'birthstep': currentTimestep,
          'correctActivations': [],
          'incorrectActivations': [],
          'correctMatches': [],
          'incorrectMatches': []
        };
        break;
      case 'destroySegment':
        var segment = currentSegments[row[1]];
        delete currentSegments[row[1]];

        segment['deathstep'] = currentTimestep;
        segments.push(segment);
        break;
      case 'correctActiveSegments':
        for (var i = 1; i < row.length; i++) {
          currentSegments[row[i]]['correctActivations'].push(currentTimestep);
        }
        break;
      case 'incorrectActiveSegments':
        for (var i = 1; i < row.length; i++) {
          currentSegments[row[i]]['incorrectActivations'].push(currentTimestep);
        }
        break;
      case 'correctMatchingSegments':
        for (var i = 1; i < row.length; i++) {
          currentSegments[row[i]]['correctMatches'].push(currentTimestep);
        }
        break;
      case 'incorrectMatchingSegments':
        for (var i = 1; i < row.length; i++) {
          currentSegments[row[i]]['incorrectMatches'].push(currentTimestep);
        }
        break;
      }
    });

    for (let k in currentSegments) {
      segments.push(currentSegments[k]);
    }
  })();

  container.onTimestepCountKnown(timesteps.length);

  // COLUMN STATES CHART
  (function() {
    var chartDiv = container.charts.append('div')
      .style('margin-left', container.chartLeft + "px");

    var chart = columnStatesPlot()
      .chartWidth(container.chartWidth)
      .x(container.x.copy())
        .xSamples(container.xSamples);

    container.onxscalechanged.push(function(transformedX, k) {
      chart.x(transformedX);
      chartDiv.call(chart.stretch);
    });

    container.onxsampleschanged.push(function() {
      chart.xSamples(container.xSamples);
      chartDiv.call(chart.render);
    });

    chartDiv.datum(timesteps)
      .call(chart);

    chartDiv.select('.zoomCatcher')
      .call(container.zoom);
  })();

  // SEGMENT LIFETIMES CHART
  (function() {
    var chartHeight = 550,
        sampleHeight = 7,
        k = 1,
        y = d3.scaleLinear()
        .domain([0, segments.length])
        .range([0, chartHeight]),
        onyscalechanged = [], // callbacks
        onysampleschanged = [], // callbacks
        ySamples = [],
        onTimestepCountKnown = null,
        // onZoomScaleExtentChanged = [], // callbacks
        zoom = d3.zoom()
        .extent(svgRectExtent)
        .scaleExtent([1, sampleHeight * 16])
        .translateExtent([[0, 0], [600, 550]])
        .on('zoom', function() {
          let scaledY = d3.event.transform.rescaleY(y);
          k = d3.event.transform.k;
          onyscalechanged.forEach(function(f) { f(scaledY,
                                                  d3.event.transform.k,
                                                  true); });
        }),
        chartAndChrome = container.charts.append('div')
        .style('position', 'relative'),
        chartDiv = chartAndChrome.append('div')
        .style('margin-left', container.chartLeft + "px"),
        ySamplesDomain = [null, null];

    //
    // Resample logic
    //
    (function() {
      var drawTimeout = null;

      function yResample(transformedY) {
        if (drawTimeout) {
          clearTimeout(drawTimeout);
          drawTimeout = null;
        }

        var extent = transformedY.domain();
        if (ySamplesDomain[0] == extent[0] && ySamplesDomain[1] == extent[1]) {
          // No need to resample.
          return;
        }

        var maxSamples = Math.floor(chartHeight / sampleHeight);

        var ySamplesNew;
        if (extent[1] - extent[0] > maxSamples) {
          var bucketWidth = (extent[1] - extent[0]) / maxSamples,
              firstBucketStart = transformedY.domain()[0],
              lastBucketStart = transformedY.domain()[1],
              nBuckets = (lastBucketStart - firstBucketStart)/bucketWidth,
              shift = firstBucketStart - transformedY.domain()[0],
              iPrevious = 0;
          ySamplesNew =
            d3.range(nBuckets)
            .map(function(iBucket) {
              var y = firstBucketStart + iBucket*bucketWidth,
              data = {y0: Math.max(y - bucketWidth, 0),
                      ymid: y + bucketWidth/2,
                      y1: Math.min(y + 2*bucketWidth, segments.length)};
              while (iPrevious < ySamples.length &&
                     ySamples[iPrevious].y < data.y0) {
                iPrevious++;
              }

              if (iPrevious < ySamples.length &&
                  ySamples[iPrevious].y < data.y1) {
                // When zooming / panning, the behavior is less
                // jarring if we reuse samples rather than
                // grabbing a new random sample.
                data.y = ySamples[iPrevious].y;
                iPrevious++;
              }
              else {
                var y0 = y;
                var y1 = (Math.min, segments.length, y+bucketWidth);
                // Choose randomly from the interval.
                // Otherwise with repeating patterns we'll have aliasing.
                data.y = Math.random() * (y1 - y0) + y0;
                data.y = Math.round(data.y);
                if (data.y < y0) {
                  data.y++;
                }
                else if (data.y >= y1) {
                  data.y--;
                }
              }

              return data;
            })
            .sort(function(a, b) {
              return a.y - b.y;
            });
        }
        else {
          // No sampling needed.
          ySamplesNew = d3.range(Math.floor(extent[0]), extent[1])
            .map(function(y) { return {y0: y, ymid: y, y: y, y1: y + 1 };});
        }
        ySamples = ySamplesNew;
        ySamplesDomain = [extent[0], extent[1]];
        onysampleschanged.forEach(function(f) { f(); });
      }

      onyscalechanged.push(function(transformedY, k, maybeCoalesce) {
        // if (maybeCoalesce) {
        // if (!drawTimeout) {
        //   drawTimeout = setTimeout(() => yResample(transformedY), maybeCoalesce ? 250 : 1000/60);
        // }
        // } else {
        yResample(transformedY);
        // }
      });
    })();

    //
    // ZOOM WIDGET
    //
    (function() {
      var zoomer = chartAndChrome.append('svg')
        .attr('width', 22)
        .attr('height', 102)
        .style('position', 'absolute')
        .style('top', '20px')
        .style('left', 0)
        .append('g')
        .attr('transform', 'translate(1,1)'),
      grooveHeight = 60,
      knobWidth = 20,
      knobHeight = 4,
      groove = zoomer.append('g')
        .attr('transform', 'translate(0, 20)'),
      grooveY = d3.scaleLog()
        .domain([1, 5]) // default while waiting for csv
        .range([grooveHeight - knobHeight, 0]);
      // onZoomScaleExtentChanged.push(function() {
      //   grooveY.domain(zoom.scaleExtent());
      //   placeKnob();
      // });
      groove.append('rect')
        .attr('x', 8)
        .attr('y', 0)
        .attr('width', 3)
        .attr('height', 60)
        .attr('stroke', 'lightgray')
        .attr('fill', 'none');
      groove.append('rect')
        .attr('class', 'clickable')
        .attr('width', 20)
        .attr('height', 60)
        .attr('stroke', 'none')
        .attr('fill', 'transparent')
        .on('click', function () {
          var y = d3.event.clientY - d3.event.target.getBoundingClientRect().top;
          zoom.scaleTo(chartDiv.selectAll('rect.zoomCatcher'),
                       grooveY.invert(y));
        });

      [{text: '+',
        translateY: 0,
        onclick: function() {
          var y = Math.max(0, grooveY(k) - 5);
          zoom.scaleTo(
            chartDiv.selectAll('rect.zoomCatcher')
              .transition(250).ease(d3.easeLinear),
            grooveY.invert(y));
        }},
       {text: '-',
        translateY: grooveHeight + 20,
        onclick: function() {
          var y = Math.min(grooveHeight - knobHeight, grooveY(k) + 5);
          zoom.scaleTo(
            chartDiv.selectAll('rect.zoomCatcher')
              .transition(250).ease(d3.easeLinear),
            grooveY.invert(y));
        }}]
        .forEach(function(spec) {
          var button = zoomer.append('g')
            .attr('transform', 'translate(0,' +
                  spec.translateY + ')');
          button.append('text')
            .attr('class', 'noselect')
            .attr('x', 10)
            .attr('y', 10)
            .attr('dy', '.26em')
            .attr('text-anchor', 'middle')
            .style('font', '15px sans-serif')
            .style('font-weight', 'bold')
            .style('fill', 'gray')
            .text(spec.text);
          button.append('rect')
            .attr('width', 20)
            .attr('height', 20)
            .attr('stroke-width', 1)
            .attr('stroke', 'gray')
            .attr('fill', 'transparent')
            .attr('class', 'clickable')
            .on('click', spec.onclick);
        });

      var knob = groove.append('g')
          .attr('class', 'draggable')
          .attr('transform', function(d) {
            return 'translate(0,' + grooveY(d) + ')';
          }),
          knobBackground = knob.append('rect')
        .attr('width', knobWidth)
        .attr('height', knobHeight)
        .attr('fill', 'white')
        .attr('stroke', 'none'),
          knobProgress = knob.append('rect')
        .attr('height', knobHeight)
        .attr('fill', 'black')
        .attr('stroke', 'none'),
      knobTitle = knob.append('title');
      knob.append('rect')
        .attr('width', knobWidth)
        .attr('height', knobHeight)
        .attr('fill', 'transparent')
        .attr('stroke', 'gray')
        .call(d3.drag()
              .on('start', function() {
                zoomer.classed('dragging', true);
              })
              .on('drag', function() {
                var y = d3.event.sourceEvent.clientY -
                  groove.node().getBoundingClientRect().top;
                y = Math.max(0, y);
                y = Math.min(grooveHeight - knobHeight, y);
                zoom.scaleTo(chartDiv.selectAll('rect.zoomCatcher'),
                             grooveY.invert(y));
              })
              .on('end', function() {
                zoomer.classed('dragging', false);
              }));

      function placeKnob(transformedY, k) {
        var scale = k,
        sampleRate = Math.min(scale / sampleHeight, 1);
        knob.attr('transform', 'translate(0,' + grooveY(scale) + ')');
        knobProgress.attr('width', knobWidth * sampleRate);
        knobTitle.text(sampleRate == 1 ?
                       "Displaying every segment in this interval." :
                       ("Due to limited pixels, only " +
                        Math.round(sampleRate*100) +
                        "% of segments in this interval are shown."));
      }

      onyscalechanged.push(placeKnob);

      grooveY.domain(zoom.scaleExtent());
      placeKnob();
      onyscalechanged.forEach(function(f) { f(y, 1); });
    })();

    var chart = segmentLifetimesPlot()
      .chartWidth(container.chartWidth)
      .chartHeight(chartHeight)
      .xExtent([0, timesteps.length])
      .ySamples(ySamples)
      .x(container.x.copy())
      .y(y.copy());

    container.onxscalechanged.push(function(transformedX, k) {
      chart.x(transformedX);
      chartDiv.call(chart);
    });

    onyscalechanged.push(function(transformedY, k) {
      chart.y(transformedY);
      chartDiv.call(chart);
    });

    onysampleschanged.push(function() {
      chart.ySamples(ySamples);
      chartDiv.call(chart);
    });

    chartDiv.datum(segments)
      .call(chart);

    chartDiv.select('.zoomCatcher')
      .call(zoom);
  })();
}

export { fetchAndInsertColumnStatesAndSegmentLifetimes,
         insertColumnStatesAndSegmentLifetimes };
