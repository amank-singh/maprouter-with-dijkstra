// graph.js START
var Graph = (function(undefined) {

  var extractKeys = function(obj) {
    var keys = [],
      key;
    for (key in obj) {
      Object.prototype.hasOwnProperty.call(obj, key) && keys.push(key);
    }
    return keys;
  }

  var sorter = function(a, b) {
    return parseFloat(a) - parseFloat(b);
  }

  var findPaths = function(map, start, end, infinity) {
    infinity = infinity || Infinity;

    var costs = {},
      open = {
        '0': [start]
      },
      predecessors = {},
      keys;

    var addToOpen = function(cost, vertex) {
      var key = "" + cost;
      if (!open[key]) open[key] = [];
      open[key].push(vertex);
    }

    costs[start] = 0;

    while (open) {
      if (!(keys = extractKeys(open)).length) break;

      keys.sort(sorter);

      var key = keys[0],
        bucket = open[key],
        node = bucket.shift(),
        currentCost = parseFloat(key),
        adjacentNodes = map[node] || {};

      if (!bucket.length) delete open[key];

      for (var vertex in adjacentNodes) {
        if (Object.prototype.hasOwnProperty.call(adjacentNodes, vertex)) {
          var cost = adjacentNodes[vertex],
            totalCost = cost + currentCost,
            vertexCost = costs[vertex];

          if ((vertexCost === undefined) || (vertexCost > totalCost)) {
            costs[vertex] = totalCost;
            addToOpen(totalCost, vertex);
            predecessors[vertex] = node;
          }
        }
      }
    }

    if (costs[end] === undefined) {
      return null;
    } else {
      return predecessors;
    }

  }

  var extractShortest = function(predecessors, end) {
    var nodes = [],
      u = end;

    while (u) {
      nodes.push(u);
      u = predecessors[u];
    }

    nodes.reverse();
    return nodes;
  }

  var findShortestPath = function(map, nodes) {
    var start = nodes.shift(),
      end,
      predecessors,
      path = [],
      shortest;

    while (nodes.length) {
      end = nodes.shift();
      predecessors = findPaths(map, start, end);

      if (predecessors) {
        shortest = extractShortest(predecessors, end);
        if (nodes.length) {
          path.push.apply(path, shortest.slice(0, -1));
        } else {
          return path.concat(shortest);
        }
      } else {
        return null;
      }

      start = end;
    }
  }

  var toArray = function(list, offset) {
    try {
      return Array.prototype.slice.call(list, offset);
    } catch (e) {
      var a = [];
      for (var i = offset || 0, l = list.length; i < l; ++i) {
        a.push(list[i]);
      }
      return a;
    }
  }

  var Graph = function(map) {
    this.map = map;
  }

  Graph.prototype.findShortestPath = function(start, end) {
    if (Object.prototype.toString.call(start) === '[object Array]') {
      return findShortestPath(this.map, start);
    } else if (arguments.length === 2) {
      return findShortestPath(this.map, [start, end]);
    } else {
      return findShortestPath(this.map, toArray(arguments));
    }
  }

  Graph.findShortestPath = function(map, start, end) {
    if (Object.prototype.toString.call(start) === '[object Array]') {
      return findShortestPath(map, start);
    } else if (arguments.length === 3) {
      return findShortestPath(map, [start, end]);
    } else {
      return findShortestPath(map, toArray(arguments, 1));
    }
  }

  return Graph;

})();
// graph.js END

var svgOffset = $("#mapper svg").offset();
var lastCircle = undefined;
var vertexes = {};
var circles = {};
var names = {};
var id = 0;

function reset() {
  $("#result").html("");
  $(".label").remove();
  $("#mapper svg").html("");
  lastCircle = undefined;
  vertexes = {};
  circles = {};
  names = {};
  id = 0;
}

function handleFileSelect(evt) {
  var file = evt.target.files[0];
  if (file.type.match('image.*')) {
    var reader = new FileReader();
    reader.onload = (function(theFile) {
      return function(e) {
        reset();
        $("#map").html("<img src='" + e.target.result + "' title='" + escape(theFile.name) + "' />");
        $("#mapper").width($("#map").width());
        $("#mapper").height($("#map").height());
      };
    })(file);
    reader.readAsDataURL(file);
    $("#road-mapper").show();
    svgOffset = $("#mapper svg").offset();
  }
}

function handleFileImport() {
  var files = document.getElementById('import-file').files;
  if (!files.length) {
    return;
  }
  var file = files[0];
  var reader = new FileReader();
  reader.onloadend = function(evt) {
    if (evt.target.readyState == FileReader.DONE) {
      var importedJson = JSON.parse(evt.target.result);
      doImport(importedJson);
    }
  };
  reader.readAsBinaryString(file);
}

function createSvgElement(element, eldict) {
  var svgElement = $(document.createElementNS('http://www.w3.org/2000/svg', element));
  svgElement.attr(eldict);
  return svgElement;
}

function addPath(from, to) {
  var id1 = from.data("node-id");
  var x1 = Number(from.position().left) -230;
  var y1 = Number(from.position().top) + Number(from.attr("r")) - 8;
  var id2 = to.data("node-id");
  var x2 = Number(to.position().left) -230;
  var y2 = Number(to.position().top) + Number(to.attr("r")) - 8;
  var distance = Math.abs(Math.sqrt((x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2)));
  var pathId = id1 + "-" + id2;
  var line = createSvgElement('line', {
    x1: x1,
    y1: y1,
    x2: x2,
    y2: y2,
    id: pathId
  });
  $("#mapper svg").prepend(line);
  vertexes[id1][String(id2)] = distance;
  vertexes[id2][String(id1)] = distance;
}

function drawPath(vertexes) {
  $("line").css("stroke", "");
  for (var i = 0; i < vertexes.length - 1; i++) {
    $("#" + vertexes[i] + "-" + vertexes[i + 1]).css("stroke", "red");
    $("line#" + vertexes[i + 1] + "-" + vertexes[i]).css("stroke", "red");
  }
}

function outputResult(vertexes) {
  $("#result").html("");
  var scale = Number($("#scale-number").val());
  var scaleUnit = $("#scale-unit").val();
  var resultList = $("<ul></ul>");
  var intermediateDistance = 0;
  var intermediateFrom = undefined;
  var totalDistance = 0;
  for (var i = 0; i < vertexes.length - 1; i++) {
    var from = vertexes[i];
    var fromName = names[from]
    var to = vertexes[i + 1];
    var toName = names[to]
    var distance = Number(this.vertexes[from][to]) * scale;
    if (fromName !== undefined && toName !== undefined) {
      totalDistance += distance;
      var subResult = "<li><b>" + fromName + " -> " + toName + ":</b>" + distance.toFixed(2)  + scaleUnit + "</li>";
      resultList.append(subResult);
    } else if (fromName !== undefined && toName === undefined) {
      intermediateFrom = fromName;
      intermediateDistance = distance;
    } else if (fromName === undefined && toName === undefined) {
      intermediateDistance += distance;
    } else if (fromName === undefined && toName !== undefined && intermediateFrom !== undefined) {
      intermediateDistance += distance;
      totalDistance += intermediateDistance;
      var subResult = "<li><b>" + intermediateFrom + " -> " + toName + ":</b> " + intermediateDistance.toFixed(2)  + scaleUnit + "</li>";
      resultList.append(subResult);
      intermediateFrom = undefined;
      intermediateDistance = 0;
    }
  }
  var totalResult = "<li><b>total:</b> " + totalDistance.toFixed(2)  + scaleUnit + "</li>";
  resultList.append(totalResult);
  $("#result").append(resultList);
}

function writeLabel(nodeId, name, top, left) {
  var label = $("<div id='label-" + nodeId + "' class='label'>" + name + "</div>");
  label.css("top", top - 8).css("left", Number(left) + 14);
  $("#mapper").append(label);
  addNameOptions();
}

function addNameOptions() {
  var nameList = $("#name-list");
  var fromList = $("#from");
  var toList = $("#to");
  nameList.html("");
  fromList.html("");
  toList.html("");
  $.each(names, function(key, value) {
    var keyID = key.substring(key.indexOf("-") + 1, key.length);
    nameList.append("<option value='" + key + "'>" + value + "</option>");
    fromList.append("<option value='" + keyID + "'>" + value + "</option>");
    toList.append("<option value='" + keyID + "'>" + value + "</option>");
  });
}

function exportJson() {
  var exportJson = {};
  exportJson["circles"] = circles;
  exportJson["vertexes"] = vertexes;
  exportJson["names"] = names;

  var jsonString = JSON.stringify(exportJson);
  var data = "text/json;charset=utf-8," + encodeURIComponent(jsonString);
  var downloadButton = $("<a id='downloadJson'>download</a>");
  downloadButton.hide();
  downloadButton.attr("download", "routes.json");
  downloadButton.attr("href", "data:" + data);
  $("body").append(downloadButton);
  document.getElementById("downloadJson").click();
  downloadButton.remove();
}

function doImport(importedJson) {
  reset();
  circles = importedJson["circles"];
  vertexes = importedJson["vertexes"];
  names = importedJson["names"];
  id = Object.keys(circles).length - 1;

  $.each(circles, function(key, value) {
    var circle = createSvgElement('circle', value);
    $("#mapper svg").append(circle);
    circle.click(circleClickEvent);
    if (value['data-is-valid-target']) {
      writeLabel(key, names[key], value.cy, value.cx);
    }
  });

  var currentId = 0;
  $.each(vertexes, function(key, value) {
    var fromKey = key;
    currentId = key.substring(key.indexOf("-") + 1);
    $.each(value, function(key, value) {
      var valueId = key.substring(key.indexOf("-") + 1);
      if (valueId <= currentId) {
        addPath($("#" + fromKey), $("#" + key));
      }
    });
  });
}

function circleClickEvent(event) {
  if (lastCircle == undefined) {
    $(this).addClass("selected");
    lastCircle = $(this);
  } else {
    addPath(lastCircle, $(this));
    lastCircle.removeClass("selected");
    lastCircle = undefined;
  }
  event.stopPropagation();
}

$("#mapper svg").click(function(event) {
  var nodeId = "node-" + String(id++);
  var left = event.pageX - svgOffset.left;
  var top = event.pageY - svgOffset.top;
  var circle;
  if (lastCircle == undefined) {
    var circleAttributes = {
      id: nodeId,
      cx: left,
      cy: top,
      r: 6,
      'data-node-id': nodeId,
      'data-is-valid-target': true
    };
    circle = createSvgElement('circle', circleAttributes);
    vertexes[nodeId] = {};
    circles[nodeId] = circleAttributes;
    names[nodeId] = nodeId.toUpperCase();
    $(this).append(circle);
    writeLabel(nodeId, names[nodeId], top, left);
  } else {
    var circleAttributes = {
      id: nodeId,
      cx: left,
      cy: top,
      r: 3,
      'data-node-id': nodeId,
      'data-is-valid-target': false
    };
    circle = createSvgElement('circle', circleAttributes);
    vertexes[nodeId] = {};
    circles[nodeId] = circleAttributes;
    $(this).append(circle);
    addPath(lastCircle, circle);
    lastCircle.removeClass("selected");
    circle.addClass("selected");
    lastCircle = circle;
  }

  $(circle).click(circleClickEvent);
});

$("button#calculate-path").click(function(event) {
  var graph = new Graph(vertexes);
  var from = "node-" + $("#from").val();
  var to = "node-" + $("#to").val();
  var shortestPath = graph.findShortestPath(from, to);
  drawPath(shortestPath);
  outputResult(shortestPath);
});

$("#map-file").change(handleFileSelect);

$("#import-file").change(handleFileImport);
$("#export").click(exportJson);

$(".menu-item-head").click(function() {
  var thisContent = $(this).parent().find(".menu-item-content");
  var hasOpen = thisContent.hasClass("open");
  $(".menu-item-content").removeClass("open");
  if (!hasOpen) {
    thisContent.addClass("open");
  }
});

$("#rename-button").click(function() {
  var nodeId = $("#name-list").val();
  var newName = $("#name-field").val();
  if (newName) {
    names[nodeId] = newName;
    var oldLabel = $("#label-" + nodeId);
    var top = Number(oldLabel.css("top").replace("px", ""));
    var left = Number(oldLabel.css("left").replace("px", ""));
    oldLabel.remove();
    writeLabel(nodeId, newName, top + 8, left - 14)
  }
});
