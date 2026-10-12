// Yokai Delivery 旅路地圖座標；請從本機可視化編輯器調整。
(function(root){
  'use strict';
  const layout = {
    "version": 1,
    "background": {
      "x": 2.4,
      "y": 1.6,
      "width": 3000
    },
    "nodes": {
      "gate": {
        "route": {
          "x": 180,
          "y": 1210
        }
      },
      "night-town": {
        "route": {
          "x": 462.3,
          "y": 985.7
        },
        "art": {
          "x": 456.6,
          "y": 981,
          "scale": 1
        },
        "label": {
          "x": 455.9,
          "y": 1023.2,
          "width": 208
        }
      },
      "cross-west": {
        "route": {
          "x": 623.5,
          "y": 1140.4
        }
      },
      "rain-port": {
        "route": {
          "x": 945.2,
          "y": 1246.2
        },
        "art": {
          "x": 945.3,
          "y": 1248.7,
          "scale": 1
        },
        "label": {
          "x": 951.8,
          "y": 1289.3,
          "width": 208
        }
      },
      "port-rise": {
        "route": {
          "x": 1490.9,
          "y": 1003.7
        }
      },
      "sakura-pass": {
        "route": {
          "x": 924.5,
          "y": 709.3
        },
        "art": {
          "x": 926.2,
          "y": 705.2,
          "scale": 1
        },
        "label": {
          "x": 924.6,
          "y": 736.9,
          "width": 208
        }
      },
      "cross-east": {
        "route": {
          "x": 1055.1,
          "y": 366.9
        }
      },
      "bamboo-maze": {
        "route": {
          "x": 1398,
          "y": 399
        },
        "art": {
          "x": 1400.4,
          "y": 397.4,
          "scale": 1
        },
        "label": {
          "x": 1399.5,
          "y": 429.1,
          "width": 208
        }
      },
      "bamboo-exit": {
        "route": {
          "x": 1533,
          "y": 640.2
        }
      },
      "hyakki-kyoto": {
        "route": {
          "x": 1776.7,
          "y": 887.6
        },
        "art": {
          "x": 1781.6,
          "y": 884.3,
          "scale": 1
        },
        "label": {
          "x": 1781.6,
          "y": 917.5,
          "width": 208
        }
      },
      "lookout": {
        "route": {
          "x": 2177.8,
          "y": 771.1
        }
      },
      "snow-temple": {
        "route": {
          "x": 2328.6,
          "y": 388.4
        },
        "art": {
          "x": 2327.8,
          "y": 386.8,
          "scale": 1
        },
        "label": {
          "x": 2329.4,
          "y": 421.7,
          "width": 208
        }
      },
      "snow-pass": {
        "route": {
          "x": 2415.1,
          "y": 769.3
        }
      },
      "spirit-ferry": {
        "route": {
          "x": 2515.3,
          "y": 1162.7
        },
        "art": {
          "x": 2516.2,
          "y": 1166.8,
          "scale": 1
        },
        "label": {
          "x": 2516.2,
          "y": 1197.5,
          "width": 208
        }
      },
      "yomi-ford": {
        "route": {
          "x": 2713.4,
          "y": 876.5
        }
      },
      "yomi-ascent": {
        "route": {
          "x": 2777.4,
          "y": 636
        }
      },
      "yomi": {
        "route": {
          "x": 2770,
          "y": 375
        },
        "art": {
          "x": 2770,
          "y": 375,
          "scale": 1
        },
        "label": {
          "x": 2770,
          "y": 418,
          "width": 208
        }
      }
    }
  };
  root.OVERWORLD_LAYOUT = layout;
  if (typeof module !== 'undefined' && module.exports) module.exports = layout;
})(typeof window !== 'undefined' ? window : globalThis);
