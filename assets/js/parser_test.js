var str_sp_remove = function(str) {
  'use strict';
  return str.replace(/\s/g, "");
};

//split a prototxt layer string to array
var layer2arr = function(str) {
  'use strict';
  var arr = str.split('\n');
  var arr0 = [];
  var i = 0;
  for (i = 0; i < arr.length; i += 1) {
    arr[i] = str_sp_remove(arr[i]);
    if (arr[i].match(/^[^:]*{.*$/)) {
      arr0.push(arr[i].split("{")[0] + "{");

      //handle single line { }
      var rest = arr[i].split("{")[1];
      if (rest && rest.match(/\}/)) {
        arr0.push(rest.split("}")[0]);
        arr0.push("}");
      }

    } else if (arr[i].match(/^[^:]*:.*/)) {
      arr0.push(arr[i]);
    } else if (arr[i].match(/\}/)) {
      arr0.push('}');
    }
  }

  if (arr0[0] !== "layer{") {
    return "error";
  }
  return arr0;
};

//parse array of layer string to [key, value, next] start from :start
// when meet same key , will turn the value to array
var parse = function(arr, start) {
  'use strict';
  if (!arr[start].match(/\{/)) {
    return "error";
  }
  var i = start + 1;
  var key = arr[start].split("{")[0];
  var value = {};
  var kv;
  while (arr[i] != "}") {
    if (arr[i].match(/^[^:]*:.*$/)) {
      kv = line2kv(arr[i]);
      i += 1;
    } else if (arr[i].match(/^[^\{]*\{/)) {
      kv = parse(arr, i);
      i = kv[2];
    }
    if (value[kv[0]]) {
      if (!(value[kv[0]] instanceof Array)) {
        value[kv[0]] = [value[kv[0]]];
      }
      value[kv[0]].push(kv[1]);
    } else {
      value[kv[0]] = kv[1];
    }
  }
  return [key, value, i + 1];
};

var line2kv = function(line) {
  'use strict';
  var kv = line.split(":");
  if (!kv[1].match(/".*"/)) {
    if (!isNaN(parseFloat(kv[1]))) {
      kv[1] = parseFloat(kv[1]);
    } else if (kv[1] == 'true') {
      kv[1] = true;
    } else if (kv[1] == 'false') {
      kv[1] = false;
    }
  } else {
    kv[1] = /"(.*)"/.exec(kv[1])[1];
  }
  return kv;
};

var layer_split = function(net) {
  'use strict';
  var arr = net.split('\n');
  var res = [];
  var s = [];
  var i = 0;
  for (i = 0; i < arr.length; i += 1) {
    if (arr[i].match(/layer \{/)) {
      s.push(i);
    }
  }
  s.push(arr.length);
  for (i = 0; i < s.length - 1; i += 1) {
    var layer = arr.slice(s[i], s[i + 1]).join('\n');
    res.push(layer);
  }
  return res;
};

var generate_link = function(nodes) {
  'use strict';
  var blobs = {};
  var i, j, k;
  for (i = 0; i < nodes.length; i += 1) {
    if (nodes[i].type == 'ReLU' && nodes[i].top == nodes[i].bottom) {
      continue;
    }
    if (nodes[i].top && (nodes[i].top instanceof Array)) {
      // 2 or more tops
      for (j = 0; j < nodes[i].top.length; j += 1) {
        if (!blobs[nodes[i].top[j]]) {
          blobs[nodes[i].top[j]] = {
            "from": [nodes[i].key],
            "to": []
          };
        } else {
          blobs[nodes[i].top[j]].from.push(nodes[i].key);
        }
      }
    } else if (nodes[i].top) {
      if (!blobs[nodes[i].top]) {
        blobs[nodes[i].top] = {
          "from": [nodes[i].key],
          "to": []
        };
      } else {
        blobs[nodes[i].top].from.push(nodes[i].key);
      }
    }
  }
  // every blob is like {from:[bottom layers], to: [top layers]}
  for (i = 0; i < nodes.length; i += 1) {
    if (nodes[i].type == 'ReLU' && nodes[i].top == nodes[i].bottom) {
      continue;
    }
    if (nodes[i].bottom && (nodes[i].bottom instanceof Array)) {
      for (j = 0; j < nodes[i].bottom.length; j += 1) {
        if (blobs[nodes[i].bottom[j]]) {
          blobs[nodes[i].bottom[j]].to.push(nodes[i].key);
        }
      }
    } else if (nodes[i].top) {
      if (blobs[nodes[i].bottom]) {
        blobs[nodes[i].bottom].to.push(nodes[i].key);
      }
    }
  }
  for (i = 0; i < nodes.length; i += 1) {
    if (nodes[i].type == 'ReLU' && nodes[i].top == nodes[i].bottom) {
      if (blobs[nodes[i].top]) {
        blobs[nodes[i].top].text = "ReLU";
      }
    }
  }
  var links = [];
  for (var key in blobs) {
    var blob = blobs[key];
    for (i = 0; i < blob.to.length; i += 1) {
      for (j = 0; j < blob.from.length; j += 1) {
        var newLink = {
          from: blob.from[j],
          to: blob.to[i],
          fromPort: 'T',
          toPort: 'B'
        };
        if (blob.text) {
          newLink.text = blob.text;
          newLink.visible = true;
        }
        links.push(newLink);
      }
    }
  }
  return links;

};

function wrap_model(nodes) {
  'use strict';
  var i, j, k;
  var res = [];

  for (i = 0; i < nodes.length; i += 1) {
    var new_node = {
      json: nodes[i],
      name: nodes[i].name
    };
    if(nodes[i].top){
      new_node.top = nodes[i].top;
    }
    if(nodes[i].bottom){
      new_node.bottom = nodes[i].bottom;
    }
    if(nodes[i].type){
      new_node.type = nodes[i].type;
    }
    if (nodes[i].include) {
      new_node.key = nodes[i].name + '_' + nodes[i].include.phase;
    } else {
      new_node.key = nodes[i].name;
    }
    res.push(new_node);
  }
  return res;
}
var removeReluLayer = function(nodes) {
  'use strict';
  var res = [];
  var i;
  for (i = 0; i < nodes.length; i += 1) {
    if (nodes[i].type == 'ReLU' && nodes[i].top == nodes[i].bottom) {
      continue;
    }
    res.push(nodes[i]);
  }
  return res;
};

function gen_model_from_prototxt() {
  'use strict';
  var prototxt = document.getElementById("prototxt").value;
  // var block_tree = get_block_tree(prototxt);
  // var proto_tree = get_proto_tree(block_tree, prototxt);
  // var layers = get_layers(proto_tree);
  // var nodeDataArray = get_node_data_array(layers);
  // var linkDataArray = get_link_data_array(layers);
  // console.log(proto_tree);
  // console.log(layers);
  // console.log(nodeDataArray);
  //
  var layers_arr = layer_split(prototxt);
  // console.log(layers_arr);
  var nodeDataArray = [];
  var linkDataArray = [];
  var jsonArray = [];
  var i;
  for (i = 0; i < layers_arr.length; i += 1) {
    var layer = parse(layer2arr(layers_arr[i]), 0)[1];
    jsonArray.push(layer);
  }
  nodeDataArray = wrap_model(jsonArray);
  console.log(nodeDataArray);
  linkDataArray = generate_link(nodeDataArray);
  nodeDataArray = removeReluLayer(nodeDataArray);
  var _struct_json = {};
  _struct_json["class"] = "go.GraphLinksModel";
  _struct_json["linkFromPortIdProperty"] = "fromPort";
  _struct_json["linkToPortIdProperty"] = "toPort";
  _struct_json["nodeDataArray"] = nodeDataArray;
  _struct_json["linkDataArray"] = linkDataArray;

  var _model = go.Model.fromJson(_struct_json);
  document.getElementById("mySavedModel").value = gen_loc_from_layers(_model[
    "nodeDataArray"], _model["linkDataArray"], _model);
  load();
}
