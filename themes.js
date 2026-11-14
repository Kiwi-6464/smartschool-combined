/**
 * Smartschool Combined — theme palettes.
 *
 * Palette data copied from inspiration/smpp (themes.json, 70 themes) and
 * converted to plain JS.
 *
 * KEYS ARE NAMESPACED ON PURPOSE. Smartschool defines its own `--color-base00`
 * / `--color-text` / `--color-accent` variables and its component framework
 * reads them; overwriting those throws "Unable to render component because
 * it is element is undefined" on pages like Resultaten. Every key below is
 * either `--ssc-*` or one of smpp's two unprefixed names, and they are read
 * by themes.css, which is smpp's stylesheet with `--color-` renamed.
 *
 * The nine keys are exactly the nine smpp's themes.json defines, so a theme
 * has the same palette here as it does in smpp:
 *   --ssc-base00 --ssc-base01 --ssc-base02 --ssc-base03
 *   --ssc-text --ssc-accent
 *   --ssc-homepage-sidebars-bg   (was --ssc-sidebars)
 *   --ssc-splashtext             (was --ssc-splash)
 *   --darken-background          (was --ssc-darken; smpp has no prefix on it)
 */
(function () {
  "use strict";

  // Sign-in pages: do nothing at all (see guard.js).
  if (window.sscSkipPage) return;

  var SSC_THEMES = {
  "911": {
    "name": "911",
    "css": {
      "--ssc-accent": "#e44042",
      "--ssc-base00": "#e5d6ca",
      "--ssc-base01": "#dacdc2",
      "--ssc-base02": "#d2c5bb",
      "--ssc-base03": "#b6c2c2",
      "--ssc-homepage-sidebars-bg": "#dbd4cf1a",
      "--ssc-splashtext": "#3d3333",
      "--ssc-text": "#3d3333",
      "--darken-background": "#dbd4cf66"
    }
  },
  "default": {
    "name": "Default Deluxe",
    "css": {
      "--ssc-accent": "#e8e8e8",
      "--ssc-text": "#adadad",
      "--ssc-base00": "#141414",
      "--ssc-base01": "#1f1f1f",
      "--ssc-base02": "#2c2c2c",
      "--ssc-base03": "#383838",
      "--ssc-homepage-sidebars-bg": "#0b0b0b1a",
      "--ssc-splashtext": "#e8e8e8",
      "--darken-background": "#0b0b0b4d"
    }
  },
  "white": {
    "name": "Off White",
    "css": {
      "--ssc-accent": "#4d5da2",
      "--ssc-base00": "#f5fefe",
      "--ssc-base01": "#eef7f7",
      "--ssc-base02": "#dde6e6",
      "--ssc-base03": "#cfd7d7",
      "--ssc-homepage-sidebars-bg": "#e1e5e51a",
      "--ssc-splashtext": "#1c1916",
      "--ssc-text": "#1c1916",
      "--darken-background": "#e1e5e566"
    }
  },
  "ldev": {
    "name": "Dark Sands",
    "css": {
      "--ssc-accent": "lch(88.37 27.48 70.54)",
      "--ssc-base00": "lch(4% 1 40)",
      "--ssc-base01": "lch(10% 1 40)",
      "--ssc-base02": "lch(20% 1 40)",
      "--ssc-base03": "#545251",
      "--ssc-homepage-sidebars-bg": "#0907071a",
      "--ssc-splashtext": "#ccccca",
      "--ssc-text": "#ccccca",
      "--darken-background": "#0907074d"
    }
  },
  "birb": {
    "name": "Midnight Sapphire",
    "css": {
      "--ssc-accent": "#6e81b1",
      "--ssc-base00": "#111117",
      "--ssc-base01": "#18191d",
      "--ssc-base02": "#232428",
      "--ssc-base03": "#3a3c44",
      "--ssc-homepage-sidebars-bg": "#09090e1a",
      "--ssc-splashtext": "#6e81b1",
      "--ssc-text": "#a8a9ab",
      "--darken-background": "#09090e4d"
    }
  },
  "stalker": {
    "name": "Ruby Eclipse",
    "css": {
      "--ssc-accent": "#d6574e",
      "--ssc-text": "#f8a99c",
      "--ssc-base00": "#1a1311",
      "--ssc-base01": "#371b19",
      "--ssc-base02": "#5c1c1a",
      "--ssc-base03": "#823530",
      "--ssc-homepage-sidebars-bg": "#100b091a",
      "--ssc-splashtext": "#f8a99c",
      "--darken-background": "#100b094d"
    }
  },
  "purple": {
    "name": "Neon Violet",
    "css": {
      "--ssc-accent": "#bd4fb3",
      "--ssc-base00": "#0b021d",
      "--ssc-base01": "#130332",
      "--ssc-base02": "#250654",
      "--ssc-base03": "#3f0a74",
      "--ssc-homepage-sidebars-bg": "#0601121a",
      "--ssc-splashtext": "#d9cdff",
      "--ssc-text": "#d9cdff",
      "--darken-background": "#0601124d"
    }
  },
  "chocolate": {
    "name": "Dark Mocha",
    "css": {
      "--ssc-accent": "#cdbcb4",
      "--ssc-base00": "#20181c",
      "--ssc-base01": "#2c2326",
      "--ssc-base02": "#3b2e2e",
      "--ssc-base03": "#4c3e3e",
      "--ssc-homepage-sidebars-bg": "#140f111a",
      "--ssc-splashtext": "#dcdad0",
      "--ssc-text": "#dcdad0",
      "--darken-background": "#140f114d"
    }
  },
  "fall": {
    "name": "Autumn Gloom",
    "css": {
      "--ssc-accent": "#f46908",
      "--ssc-base00": "#1d0a03",
      "--ssc-base01": "#4b1c0c",
      "--ssc-base02": "#7f361d",
      "--ssc-base03": "#af4623",
      "--ssc-homepage-sidebars-bg": "#1205011a",
      "--ssc-splashtext": "#f8d8b0",
      "--ssc-text": "#f8d8b0",
      "--darken-background": "#1205014d"
    }
  },
  "winter": {
    "name": "Arctic Azure",
    "css": {
      "--ssc-accent": "#8aadb6",
      "--ssc-base00": "#071b2c",
      "--ssc-base01": "#152f47",
      "--ssc-base02": "#345f7f",
      "--ssc-base03": "#5687b6",
      "--ssc-homepage-sidebars-bg": "#06101a1a",
      "--ssc-splashtext": "#c2bab2",
      "--ssc-text": "#c2bab2",
      "--darken-background": "#06101a4d"
    }
  },
  "matcha": {
    "name": "Matcha Green",
    "css": {
      "--ssc-accent": "#d1f8e7",
      "--ssc-base00": "#243926",
      "--ssc-base01": "#365138",
      "--ssc-base02": "#456046",
      "--ssc-base03": "#4f7a51",
      "--ssc-homepage-sidebars-bg": "#1620171a",
      "--ssc-splashtext": "#d1ebd2",
      "--ssc-text": "#d1ebd2",
      "--darken-background": "#1620174d"
    }
  },
  "mountain": {
    "name": "Stormy Peaks",
    "css": {
      "--ssc-accent": "#f1f8ff",
      "--ssc-base00": "#090c10",
      "--ssc-base01": "#1a2332",
      "--ssc-base02": "#2c3b53",
      "--ssc-base03": "#3e5374",
      "--ssc-homepage-sidebars-bg": "#0406091a",
      "--ssc-splashtext": "#c1cadc",
      "--ssc-text": "#c1cadc",
      "--darken-background": "#0406094d"
    }
  },
  "vax": {
    "name": "Star Wars",
    "css": {
      "--ssc-accent": "#7a1600",
      "--ssc-text": "#ffe4c4",
      "--ssc-base00": "#411900",
      "--ssc-base01": "#724021",
      "--ssc-base02": "#b9815d",
      "--ssc-base03": "#caa288",
      "--ssc-homepage-sidebars-bg": "#02020585",
      "--darken-background": "rgba(0,0,0,0.15)",
      "--ssc-splashtext": "#7a1600"
    }
  },
  "sand": {
    "name": "Sahara Oasis",
    "css": {
      "--ssc-accent": "#8097c5",
      "--ssc-base00": "#2e2526",
      "--ssc-base01": "#3d3434",
      "--ssc-base02": "#544848",
      "--ssc-base03": "#634f4e",
      "--ssc-homepage-sidebars-bg": "#1a16171a",
      "--ssc-splashtext": "#c1a49c",
      "--ssc-text": "#c1a49c",
      "--darken-background": "#1a16174d"
    }
  },
  "pizza": {
    "name": "Pizza",
    "css": {
      "--ssc-accent": "#af654b",
      "--ssc-base00": "#e4dbcb",
      "--ssc-base01": "#dcd0ba",
      "--ssc-base02": "#d3c4a9",
      "--ssc-base03": "#c2ad87",
      "--ssc-homepage-sidebars-bg": "#dcd4c61a",
      "--ssc-splashtext": "#573c28",
      "--ssc-text": "#573c28",
      "--darken-background": "#dcd4c666"
    }
  },
  "galaxy": {
    "name": "Fluorescent Galaxy",
    "css": {
      "--ssc-accent": "#ed0ff1",
      "--ssc-base00": "#0c0227",
      "--ssc-base01": "#140243",
      "--ssc-base02": "#220474",
      "--ssc-base03": "#3006a5",
      "--ssc-homepage-sidebars-bg": "#0701181a",
      "--ssc-splashtext": "#eaccff",
      "--ssc-text": "#eaccff",
      "--darken-background": "#0701184d"
    }
  },
  "pink": {
    "name": "Cherry Haze",
    "css": {
      "--ssc-accent": "#bf4183",
      "--ssc-base00": "#f7ccd5",
      "--ssc-base01": "#fbbecc",
      "--ssc-base02": "#f0a8c1",
      "--ssc-base03": "#ea8eb0",
      "--ssc-homepage-sidebars-bg": "#ebc6d21a",
      "--ssc-splashtext": "#6c1c48",
      "--ssc-text": "#6c1c48",
      "--darken-background": "#ebc6d266"
    }
  },
  "fairyblue": {
    "name": "Fairy Blue",
    "css": {
      "--ssc-accent": "lch(90% 23 260)",
      "--ssc-base00": "lch(68% 23 260)",
      "--ssc-base01": "lch(73% 23 260)",
      "--ssc-base02": "lch(78% 23 260)",
      "--ssc-base03": "lch(83% 23 260)",
      "--ssc-homepage-sidebars-bg": "#c6d4e81a",
      "--ssc-splashtext": "#e4ffff",
      "--ssc-text": "#e4ffff",
      "--darken-background": "#c6d4e866"
    }
  },
  "boringwhite": {
    "name": "Boring white",
    "css": {
      "--ssc-accent": "#9a9996",
      "--ssc-base00": "#ffffff",
      "--ssc-base01": "#f6f5f4",
      "--ssc-base02": "#deddda",
      "--ssc-base03": "#c0bfbc",
      "--ssc-homepage-sidebars-bg": "#e1e0df1a",
      "--ssc-splashtext": "#000000",
      "--ssc-text": "#000000",
      "--darken-background": "#e1e0df66"
    }
  },
  "tech": {
    "name": "Tech",
    "css": {
      "--ssc-accent": "#ff39ff",
      "--ssc-base00": "#010003",
      "--ssc-base01": "#19121f",
      "--ssc-base02": "#201826",
      "--ssc-base03": "#3e3545",
      "--ssc-homepage-sidebars-bg": "#0000011a",
      "--ssc-splashtext": "#00f0fe",
      "--ssc-text": "#00f0fe",
      "--darken-background": "#0000014d"
    }
  },
  "keith": {
    "name": "Keith",
    "css": {
      "--ssc-accent": "#9f6ca2",
      "--ssc-text": "#cdb4d4",
      "--ssc-base00": "#060504",
      "--ssc-base01": "#271d16",
      "--ssc-base02": "#483628",
      "--ssc-base03": "#694f3a",
      "--darken-background": "#0303024d",
      "--ssc-homepage-sidebars-bg": "#0605041a",
      "--ssc-splashtext": "#9f6ca2"
    }
  },
  "error": {
    "name": "Error",
    "css": {
      "--ssc-accent": "#ff0033",
      "--ssc-base00": "#0a0002",
      "--ssc-base01": "#150008",
      "--ssc-base02": "#2a0a15",
      "--ssc-base03": "#471a28",
      "--ssc-homepage-sidebars-bg": "#0500011a",
      "--ssc-splashtext": "#00fff7",
      "--ssc-text": "#00fff7",
      "--darken-background": "#0500014d"
    }
  },
  "smkerst": {
    "name": "Smartschool Kerst",
    "css": {
      "--ssc-accent": "#f6ed4f",
      "--ssc-base00": "#051e45",
      "--ssc-base01": "#124f96",
      "--ssc-base02": "#3071c9",
      "--ssc-base03": "#4b47c0",
      "--ssc-homepage-sidebars-bg": "#0c12251a",
      "--ssc-splashtext": "#dff1e1",
      "--ssc-text": "#dff1e1",
      "--darken-background": "#0c12254d"
    }
  },
  "japan": {
    "name": "Pink Japan",
    "css": {
      "--ssc-accent": "#97698b",
      "--ssc-base00": "#170d14",
      "--ssc-base01": "#37202f",
      "--ssc-base02": "#57334b",
      "--ssc-base03": "#774667",
      "--ssc-homepage-sidebars-bg": "#0e070b1a",
      "--ssc-splashtext": "#d4abb8",
      "--ssc-text": "#d4abb8",
      "--darken-background": "#0e070b4d"
    }
  },
  "summer": {
    "name": "Sunset Beach",
    "css": {
      "--ssc-accent": "#268e99",
      "--ssc-base00": "#efe9d3",
      "--ssc-base01": "#f2e8ca",
      "--ssc-base02": "#e2d4ac",
      "--ssc-base03": "#c4c8c7",
      "--ssc-homepage-sidebars-bg": "#e4dcc81a",
      "--ssc-splashtext": "#5b3d1b",
      "--ssc-text": "#5b3d1b",
      "--darken-background": "#e4dcc866"
    }
  },
  "ocean": {
    "name": "Ocean",
    "css": {
      "--ssc-accent": "#679bb5",
      "--ssc-base00": "#08171e",
      "--ssc-base01": "#122839",
      "--ssc-base02": "#17384f",
      "--ssc-base03": "#3f6981",
      "--ssc-homepage-sidebars-bg": "#040e131a",
      "--ssc-splashtext": "#b8c8d5",
      "--ssc-text": "#b8c8d5",
      "--darken-background": "#040e134d"
    }
  },
  "defaultCustom": {
    "name": "New theme",
    "css": {
      "--ssc-accent": "#4a9eff",
      "--ssc-base00": "#1a1a1a",
      "--ssc-base01": "#2a2a2a",
      "--ssc-base02": "#3a3a3a",
      "--ssc-base03": "#5a5a5a",
      "--ssc-homepage-sidebars-bg": "#1010101a",
      "--ssc-splashtext": "#e0e0e0",
      "--ssc-text": "#e0e0e0",
      "--darken-background": "#1010104d"
    }
  },
  "otters": {
    "name": "Sea Otters",
    "css": {
      "--ssc-accent": "#fcc464",
      "--ssc-base00": "#09181f",
      "--ssc-base01": "#0c3649",
      "--ssc-base02": "#135675",
      "--ssc-base03": "#1a76a1",
      "--ssc-homepage-sidebars-bg": "#050e131a",
      "--ssc-splashtext": "#fff1d7",
      "--ssc-text": "#fff1d7",
      "--darken-background": "#050e134d"
    }
  },
  "darkglass": {
    "name": "Dark Glass",
    "css": {
      "--ssc-accent": "#5e78f8",
      "--ssc-base00": "#010a2c",
      "--ssc-base01": "#0a1a5b",
      "--ssc-base02": "#142d8d",
      "--ssc-base03": "#1e40c4",
      "--ssc-homepage-sidebars-bg": "#03051a1a",
      "--ssc-splashtext": "#cbd6ff",
      "--ssc-text": "#cbd6ff",
      "--darken-background": "#03051a4d"
    }
  },
  "lightglass": {
    "name": "Light Glass",
    "css": {
      "--ssc-accent": "#418494",
      "--ssc-base00": "#cdd8e4",
      "--ssc-base01": "#bdcbdb",
      "--ssc-base02": "#acbed2",
      "--ssc-base03": "#8ba4c0",
      "--ssc-homepage-sidebars-bg": "#c8d1db1a",
      "--ssc-splashtext": "#272f31",
      "--ssc-text": "#272f31",
      "--darken-background": "#c8d1db66"
    }
  },
  "minecraft": {
    "name": "Minecraft",
    "css": {
      "--ssc-accent": "#f7cb6d",
      "--ssc-base00": "#0c171b",
      "--ssc-base01": "#1d303d",
      "--ssc-base02": "#38566f",
      "--ssc-base03": "#9bce75",
      "--ssc-homepage-sidebars-bg": "#060e111a",
      "--ssc-splashtext": "#feffff",
      "--ssc-text": "#feffff",
      "--darken-background": "#060e114d"
    }
  },
  "lost": {
    "name": "Lost",
    "css": {
      "--ssc-accent": "#c85f4b",
      "--ssc-base00": "#10131d",
      "--ssc-base01": "#1b1f2d",
      "--ssc-base02": "#2f3341",
      "--ssc-base03": "#2d395d",
      "--ssc-homepage-sidebars-bg": "#090b121a",
      "--ssc-splashtext": "#a4b0d4",
      "--ssc-text": "#a4b0d4",
      "--darken-background": "#090b124d"
    }
  },
  "mclaren": {
    "name": "McLaren",
    "css": {
      "--ssc-accent": "#e8a07a",
      "--ssc-base00": "#100a08",
      "--ssc-base01": "#321f19",
      "--ssc-base02": "#54342a",
      "--ssc-base03": "#76493b",
      "--ssc-homepage-sidebars-bg": "#0905041a",
      "--ssc-splashtext": "#eedad6",
      "--ssc-text": "#eedad6",
      "--darken-background": "#0905044d"
    }
  },
  "space": {
    "name": "Space",
    "css": {
      "--ssc-accent": "#915ab0",
      "--ssc-base00": "#130f19",
      "--ssc-base01": "#2c213a",
      "--ssc-base02": "#45345a",
      "--ssc-base03": "#5e477a",
      "--ssc-homepage-sidebars-bg": "#0b080f1a",
      "--ssc-splashtext": "#c3bdd8",
      "--ssc-text": "#c3bdd8",
      "--darken-background": "#0b080f4d"
    }
  },
  "night": {
    "name": "Starful Night",
    "css": {
      "--ssc-accent": "#be6237",
      "--ssc-base00": "#050709",
      "--ssc-base01": "#192228",
      "--ssc-base02": "#2c3d48",
      "--ssc-base03": "#3f5868",
      "--ssc-homepage-sidebars-bg": "#0204041a",
      "--ssc-splashtext": "#c2e1e8",
      "--ssc-text": "#c2e1e8",
      "--darken-background": "#0204044d"
    }
  },
  "lake": {
    "name": "Moody Lake",
    "css": {
      "--ssc-accent": "#b57e4a",
      "--ssc-base00": "#dacdb8",
      "--ssc-base01": "#d1c1a8",
      "--ssc-base02": "#c8b597",
      "--ssc-base03": "#c29f65",
      "--ssc-homepage-sidebars-bg": "#d7ccbd1a",
      "--ssc-splashtext": "#4d3c31",
      "--ssc-text": "#4d3c31",
      "--darken-background": "#d7ccbd66"
    }
  },
  "fuji": {
    "name": "Fuji",
    "css": {
      "--ssc-accent": "#834561",
      "--ssc-base00": "#bedefc",
      "--ssc-base01": "#abceee",
      "--ssc-base02": "#88b3db",
      "--ssc-base03": "#78acdd",
      "--ssc-homepage-sidebars-bg": "#b8cbe01a",
      "--ssc-splashtext": "#003049",
      "--ssc-text": "#003049",
      "--darken-background": "#b8cbe066"
    }
  },
  "nightlife": {
    "name": "Nightlife",
    "css": {
      "--ssc-accent": "#e1482d",
      "--ssc-base00": "#042124",
      "--ssc-base01": "#052b30",
      "--ssc-base02": "#073f45",
      "--ssc-base03": "#47848b",
      "--ssc-homepage-sidebars-bg": "#0414161a",
      "--ssc-splashtext": "#ececff",
      "--ssc-text": "#ececff",
      "--darken-background": "#0414164d"
    }
  },
  "tokyo": {
    "name": "Tokyo",
    "css": {
      "--ssc-accent": "#fb9307",
      "--ssc-base00": "#011820",
      "--ssc-base01": "#033c51",
      "--ssc-base02": "#056182",
      "--ssc-base03": "#f79b7d",
      "--ssc-homepage-sidebars-bg": "#010e141a",
      "--ssc-splashtext": "#f4e5e0",
      "--ssc-text": "#f4e5e0",
      "--darken-background": "#010e144d"
    }
  },
  "greenneon": {
    "name": "Neon Shinjuku",
    "css": {
      "--ssc-accent": "#e00c1f",
      "--ssc-base00": "#0c1710",
      "--ssc-base01": "#16291d",
      "--ssc-base02": "#24412f",
      "--ssc-base03": "#c68c02",
      "--ssc-homepage-sidebars-bg": "#060e091a",
      "--ssc-splashtext": "#cbffd8",
      "--ssc-text": "#cbffd8",
      "--darken-background": "#060e094d"
    }
  },
  "morninglake": {
    "name": "Morning Lake",
    "css": {
      "--ssc-accent": "#5f8da0",
      "--ssc-base00": "#0e1a1a",
      "--ssc-base01": "#1f3c3c",
      "--ssc-base02": "#315d5d",
      "--ssc-base03": "#437e7e",
      "--ssc-homepage-sidebars-bg": "#0710101a",
      "--ssc-splashtext": "#acc2d4",
      "--ssc-text": "#acc2d4",
      "--darken-background": "#0710104d"
    }
  },
  "bluemountain": {
    "name": "Blue Mountains",
    "css": {
      "--ssc-accent": "#044d80",
      "--ssc-base00": "#c8d9e0",
      "--ssc-base01": "#b8cdd6",
      "--ssc-base02": "#a8c2cd",
      "--ssc-base03": "#88abba",
      "--ssc-homepage-sidebars-bg": "#c6d3d81a",
      "--ssc-splashtext": "#232e36",
      "--ssc-text": "#232e36",
      "--darken-background": "#c6d3d866"
    }
  },
  "cloudyluna": {
    "name": "Cloudy Luna",
    "css": {
      "--ssc-accent": "#bb5876",
      "--ssc-base00": "#0e0f1a",
      "--ssc-base01": "#21223a",
      "--ssc-base02": "#33355b",
      "--ssc-base03": "#45487c",
      "--ssc-homepage-sidebars-bg": "#0708101a",
      "--ssc-splashtext": "#dcb3ce",
      "--ssc-text": "#dcb3ce",
      "--darken-background": "#0708104d"
    }
  },
  "redsky": {
    "name": "Crimson Sky",
    "css": {
      "--ssc-accent": "#f24856",
      "--ssc-base00": "#021b22",
      "--ssc-base01": "#09333e",
      "--ssc-base02": "#0e4755",
      "--ssc-base03": "#6b8d95",
      "--ssc-homepage-sidebars-bg": "#0211151a",
      "--ssc-splashtext": "#ffd8d7",
      "--ssc-text": "#ffd8d7",
      "--darken-background": "#0211154d"
    }
  },
  "luna": {
    "name": "Moon",
    "css": {
      "--ssc-accent": "#594c85",
      "--ssc-base00": "#000000",
      "--ssc-base01": "#151515",
      "--ssc-base02": "#232225",
      "--ssc-base03": "#363539",
      "--ssc-homepage-sidebars-bg": "#0000001a",
      "--ssc-splashtext": "#acbce4",
      "--ssc-text": "#acbce4",
      "--darken-background": "#0000004d"
    }
  },
  "dino": {
    "name": "Dyno",
    "css": {
      "--ssc-accent": "#e3b21b",
      "--ssc-base00": "#174755",
      "--ssc-base01": "#1c687f",
      "--ssc-base02": "#1990b5",
      "--ssc-base03": "#45b9dc",
      "--ssc-homepage-sidebars-bg": "#13262c1a",
      "--ssc-splashtext": "#d6f1f6",
      "--ssc-text": "#d6f1f6",
      "--darken-background": "#13262c4d"
    }
  },
  "lonelycat": {
    "name": "Lonely Cat",
    "css": {
      "--ssc-accent": "#eca009",
      "--ssc-base00": "#011122",
      "--ssc-base01": "#032953",
      "--ssc-base02": "#044185",
      "--ssc-base03": "#b9886e",
      "--ssc-homepage-sidebars-bg": "#0109151a",
      "--ssc-splashtext": "#ffece2",
      "--ssc-text": "#ffece2",
      "--darken-background": "#0109154d"
    }
  },
  "hole": {
    "name": "Gargantua",
    "css": {
      "--ssc-accent": "#b36c46",
      "--ssc-base00": "#100d0d",
      "--ssc-base01": "#1d1c1b",
      "--ssc-base02": "#2b2927",
      "--ssc-base03": "#a3705a",
      "--ssc-homepage-sidebars-bg": "#0907071a",
      "--ssc-splashtext": "#e4cfc2",
      "--ssc-text": "#e4cfc2",
      "--darken-background": "#0907074d"
    }
  },
  "redmoon": {
    "name": "Scarlett moon",
    "css": {
      "--ssc-accent": "#cc4d51",
      "--ssc-base00": "#0b0708",
      "--ssc-base01": "#2c191d",
      "--ssc-base02": "#4c2c33",
      "--ssc-base03": "#6c3f49",
      "--ssc-homepage-sidebars-bg": "#0604041a",
      "--ssc-splashtext": "#ffe5e5",
      "--ssc-text": "#ffe5e5",
      "--darken-background": "#0604044d"
    }
  },
  "sunset": {
    "name": "Sunset Sky",
    "css": {
      "--ssc-accent": "#f57166",
      "--ssc-base00": "#121120",
      "--ssc-base01": "#201e38",
      "--ssc-base02": "#2c2a4b",
      "--ssc-base03": "#575298",
      "--ssc-homepage-sidebars-bg": "#0a09141a",
      "--ssc-splashtext": "#ede5ff",
      "--ssc-text": "#ede5ff",
      "--darken-background": "#0a09144d"
    }
  },
  "aurora": {
    "name": "Aurora",
    "css": {
      "--ssc-accent": "#45cb9c",
      "--ssc-base00": "#0a1413",
      "--ssc-base01": "#1b3632",
      "--ssc-base02": "#2c5852",
      "--ssc-base03": "#2d7168",
      "--ssc-homepage-sidebars-bg": "#050b0b1a",
      "--ssc-splashtext": "#cce9e6",
      "--ssc-text": "#cce9e6",
      "--darken-background": "#050b0b4d"
    }
  },
  "f40": {
    "name": "Rosé F40",
    "css": {
      "--ssc-accent": "#c8466d",
      "--ssc-base00": "#fa9bb1",
      "--ssc-base01": "#fa8fa8",
      "--ssc-base02": "#f27693",
      "--ssc-base03": "#f46788",
      "--ssc-homepage-sidebars-bg": "#f0afbb1a",
      "--ssc-splashtext": "#510209",
      "--ssc-text": "#510209",
      "--darken-background": "#f0afbb66"
    }
  },
  "purpleporsche": {
    "name": "Neon Porsche",
    "css": {
      "--ssc-accent": "#dc2a8f",
      "--ssc-base00": "#0a080f",
      "--ssc-base01": "#1f1a30",
      "--ssc-base02": "#342c51",
      "--ssc-base03": "#493e72",
      "--ssc-homepage-sidebars-bg": "#0504081a",
      "--ssc-splashtext": "#d1cef8",
      "--ssc-text": "#d1cef8",
      "--darken-background": "#0504084d"
    }
  },
  "bigsur": {
    "name": "Big Sur",
    "css": {
      "--ssc-accent": "#6c7ca4",
      "--ssc-base00": "#070b0d",
      "--ssc-base01": "#1a282d",
      "--ssc-base02": "#2c444e",
      "--ssc-base03": "#3e606f",
      "--ssc-homepage-sidebars-bg": "#0306071a",
      "--ssc-splashtext": "#d0c6b1",
      "--ssc-text": "#d0c6b1",
      "--darken-background": "#0306074d"
    }
  },
  "alps": {
    "name": "Alps",
    "css": {
      "--ssc-accent": "#fca434",
      "--ssc-base00": "#010f20",
      "--ssc-base01": "#022552",
      "--ssc-base02": "#043c83",
      "--ssc-base03": "#0653b4",
      "--ssc-homepage-sidebars-bg": "#0108141a",
      "--ssc-splashtext": "#fff5e2",
      "--ssc-text": "#fff5e2",
      "--darken-background": "#0108144d"
    }
  },
  "darkfuji": {
    "name": "Dark Fuji",
    "css": {
      "--ssc-accent": "#c08b55",
      "--ssc-base00": "#110d08",
      "--ssc-base01": "#21201f",
      "--ssc-base02": "#33312e",
      "--ssc-base03": "#5f5c59",
      "--ssc-homepage-sidebars-bg": "#0907041a",
      "--ssc-splashtext": "#c4bbb2",
      "--ssc-text": "#c4bbb2",
      "--darken-background": "#0907044d"
    }
  },
  "audi": {
    "name": "Audi",
    "css": {
      "--ssc-accent": "#5c9ca4",
      "--ssc-base00": "#0e0a09",
      "--ssc-base01": "#2e221c",
      "--ssc-base02": "#4e392f",
      "--ssc-base03": "#6e5042",
      "--ssc-homepage-sidebars-bg": "#0705041a",
      "--ssc-splashtext": "#a4ccd4",
      "--ssc-text": "#a4ccd4",
      "--darken-background": "#0705044d"
    }
  },
  "rallyaudi": {
    "name": "Audi Quattro",
    "css": {
      "--ssc-accent": "#df9a13",
      "--ssc-base00": "#1d1201",
      "--ssc-base01": "#4f3102",
      "--ssc-base02": "#805004",
      "--ssc-base03": "#b16f06",
      "--ssc-homepage-sidebars-bg": "#120a001a",
      "--ssc-splashtext": "#faebcb",
      "--ssc-text": "#faebcb",
      "--darken-background": "#120a004d"
    }
  },
  "e30": {
    "name": "E30",
    "css": {
      "--ssc-accent": "#5a90ab",
      "--ssc-base00": "#0d1112",
      "--ssc-base01": "#232e2f",
      "--ssc-base02": "#384a4d",
      "--ssc-base03": "#4d666b",
      "--ssc-homepage-sidebars-bg": "#07090a1a",
      "--ssc-splashtext": "#eccdc5",
      "--ssc-text": "#eccdc5",
      "--darken-background": "#07090a4d"
    }
  },
  "monaco": {
    "name": "Monaco Duo",
    "css": {
      "--ssc-accent": "#7cc4d6",
      "--ssc-base00": "#0c0c0c",
      "--ssc-base01": "#1a1a1a",
      "--ssc-base02": "#212122",
      "--ssc-base03": "#3a3a3c",
      "--ssc-homepage-sidebars-bg": "#0606061a",
      "--ssc-splashtext": "#c5c7c8",
      "--ssc-text": "#c5c7c8",
      "--darken-background": "#0606064d"
    }
  },
  "smpp": {
    "name": "Indigo",
    "css": {
      "--ssc-accent": "#7381ff",
      "--ssc-base00": "#22265d",
      "--ssc-base01": "#303582",
      "--ssc-base02": "#3e44a7",
      "--ssc-base03": "#4a4fad",
      "--ssc-homepage-sidebars-bg": "#1717301a",
      "--ssc-splashtext": "#eeefff",
      "--ssc-text": "#eeefff",
      "--darken-background": "#1717304d"
    }
  },
  "smpplite": {
    "name": "Indigo Licht",
    "css": {
      "--ssc-accent": "#797bc5",
      "--ssc-base00": "#fbfcff",
      "--ssc-base01": "#e4e8fd",
      "--ssc-base02": "#ccd4fb",
      "--ssc-base03": "#9dacf7",
      "--ssc-homepage-sidebars-bg": "#d8dcf01a",
      "--ssc-splashtext": "#28295c",
      "--ssc-text": "#28295c",
      "--darken-background": "#d8dcf066"
    }
  },
  "sm": {
    "name": "Smartschool",
    "css": {
      "--ssc-accent": "#fa7d14",
      "--ssc-base00": "#ffffff",
      "--ssc-base01": "#ececec",
      "--ssc-base02": "#dfdfdf",
      "--ssc-base03": "#bfbfbf",
      "--ssc-homepage-sidebars-bg": "#e1e1e11a",
      "--ssc-splashtext": "#000000",
      "--ssc-text": "#000000",
      "--darken-background": "#e1e1e166"
    }
  },
  "neonmclaren": {
    "name": "Neon Mclaren",
    "css": {
      "--ssc-accent": "#0bf1f8",
      "--ssc-base00": "#1d0222",
      "--ssc-base01": "#46154d",
      "--ssc-base02": "#57245f",
      "--ssc-base03": "#794283",
      "--ssc-homepage-sidebars-bg": "#1301151a",
      "--ssc-splashtext": "#e4faff",
      "--ssc-text": "#e4faff",
      "--darken-background": "#1301154d"
    }
  },
  "dunes": {
    "name": "Dusk Dunes",
    "css": {
      "--ssc-accent": "#9d464b",
      "--ssc-base00": "#deb8a4",
      "--ssc-base01": "#d2a892",
      "--ssc-base02": "#c89a81",
      "--ssc-base03": "#d78c64",
      "--ssc-homepage-sidebars-bg": "#d8bfb11a",
      "--ssc-splashtext": "#3f3333",
      "--ssc-text": "#3f3333",
      "--darken-background": "#d8bfb166"
    }
  },
  "party": {
    "name": "Fuchsia Party",
    "css": {
      "--ssc-accent": "#df3f9c",
      "--ssc-base00": "#190d1c",
      "--ssc-base01": "#43204d",
      "--ssc-base02": "#5c276b",
      "--ssc-base03": "#7b4889",
      "--ssc-homepage-sidebars-bg": "#0f07111a",
      "--ssc-splashtext": "#f8e0e1",
      "--ssc-text": "#f8e0e1",
      "--darken-background": "#0f07114d"
    }
  },
  "dragon": {
    "name": "Knight vs Dragon",
    "css": {
      "--ssc-accent": "#e29376",
      "--ssc-base00": "#261415",
      "--ssc-base01": "#6f4244",
      "--ssc-base02": "#8e5052",
      "--ssc-base03": "#bb6b6e",
      "--ssc-homepage-sidebars-bg": "#180c0c1a",
      "--ssc-splashtext": "#ecd7ce",
      "--ssc-text": "#ecd7ce",
      "--darken-background": "#180c0c4d"
    }
  },
  "softwinter": {
    "name": "Soft Winter",
    "css": {
      "--ssc-accent": "#d48c60",
      "--ssc-base00": "#e3d6cf",
      "--ssc-base01": "#d9c8bf",
      "--ssc-base02": "#d0baaf",
      "--ssc-base03": "#bc927d",
      "--ssc-homepage-sidebars-bg": "#dacfc91a",
      "--ssc-splashtext": "#344071",
      "--ssc-text": "#344071",
      "--darken-background": "#dacfc966"
    }
  },
  "grassy": {
    "name": "Grassy Forest",
    "css": {
      "--ssc-accent": "#aac873",
      "--ssc-base00": "#151f15",
      "--ssc-base01": "#283d27",
      "--ssc-base02": "#344f33",
      "--ssc-base03": "#447342",
      "--ssc-homepage-sidebars-bg": "#0d130c1a",
      "--ssc-splashtext": "#d2dde6",
      "--ssc-text": "#d2dde6",
      "--darken-background": "#0d130c4d"
    }
  },
  "misty": {
    "name": "Misty Mountains",
    "css": {
      "--ssc-accent": "#c4a400",
      "--ssc-base00": "#fbe4aa",
      "--ssc-base01": "#f9dc92",
      "--ssc-base02": "#f8d47a",
      "--ssc-base03": "#f5c44a",
      "--ssc-homepage-sidebars-bg": "#f1dcb01a",
      "--ssc-splashtext": "#4c4d09",
      "--ssc-text": "#4c4d09",
      "--darken-background": "#f1dcb066"
    }
  }
};


  /**
   * Ported verbatim from inspiration/smpp/extension/background-scripts/data/
   * theme-categories.json. "hidden" is omitted: those entries are
   * colour-only fallbacks, not choices, and smpp hides them too.
   * A theme may appear in more than one group; the picker de-dupes.
   */
  var SSC_THEME_CATEGORIES = {
    "dark": [
      "default", "birb", "ldev", "tech", "stalker", "mountain", "purple",
      "chocolate", "fall", "winter", "matcha", "vax", "sand", "ocean",
      "otters", "galaxy", "japan", "error", "smkerst", "darkglass",
      "minecraft", "lost", "mclaren", "space", "night", "nightlife",
      "tokyo", "greenneon", "redsky", "cloudyluna", "morninglake", "luna",
      "dino", "lonelycat", "hole", "sunset", "aurora", "purpleporsche",
      "alps", "darkfuji", "e30", "audi", "rallyaudi", "keith", "monaco",
      "smpp", "neonmclaren", "dragon", "party", "grassy"
    ],
    "light": [
      "white", "summer", "pink", "fairyblue", "boringwhite", "pizza",
      "lightglass", "lake", "fuji", "bluemountain", "911", "f40",
      "smpplite", "sm", "dunes", "misty", "softwinter"
    ],
    "mountain": [
      "mountain", "japan", "lake", "morninglake", "fuji", "bluemountain",
      "bigsur", "alps", "darkfuji", "misty"
    ],
    "japan": [
      "japan", "fuji", "nightlife", "tokyo", "greenneon", "darkfuji"
    ],
    "car": [
      "e30", "mclaren", "f40", "911", "purpleporsche", "audi", "rallyaudi",
      "monaco", "neonmclaren"
    ],
    "space": [
      "galaxy", "cloudyluna", "luna", "hole", "redsky", "redmoon", "ldev",
      "space", "dunes"
    ],
    "seasonal": [
      "fall", "mclaren", "smkerst", "winter", "summer", "matcha", "misty",
      "softwinter", "grassy"
    ],
    "animal": [
      "otters", "lonelycat", "dino", "keith", "dragon"
    ],
    "other": [
      "lightglass", "lost", "minecraft", "aurora", "sunset", "vax",
      "purple", "stalker", "darkglass", "chocolate", "pink", "white",
      "default", "birb", "sand", "tech", "ocean", "smpplite", "sm", "smpp",
      "party"
    ],
  };

  /**
   * Themes that have NO background image, in smpp either.
   *
   * These five are the only entries in smpp's themes.json with no matching
   * file in extension/media/theme-backgrounds/, and all five sit in
   * theme-categories.json's "hidden" list there. smpp renders them with the
   * gradient layer alone (its <img> is given .image-not-available, which is
   * display:none). We do the same, but skip requesting a 404.
   */
  var SSC_THEMES_NO_BG = {
    boringwhite: true,
    error: true,
    fairyblue: true,
    smpp: true,
    smpplite: true,
  };

  /**
   * "default" already means "geen thema" in the picker and in layout.js, so
   * smpp's "Default Deluxe" palette (the one keyed "default" in themes.json)
   * was unreachable: both options carried value="default" and the second one
   * silently stored "default" again. It gets its own key instead. The palette
   * is shared by reference, so there is one copy of the colours.
   */
  SSC_THEMES["deluxe"] = SSC_THEMES["default"];

  /** Theme id -> background file, for ids whose image is not named after them. */
  var SSC_THEME_BG_ALIAS = { deluxe: "default" };

  /**
   * Absolute URL of a theme's background, or "" for themes without one.
   * Returns "" outside an extension context so the page never gets a
   * relative path that would resolve against Smartschool's origin.
   */
  function sscThemeBackground(themeId) {
    if (!themeId || themeId === "custom") return "";
    if (!SSC_THEMES[themeId]) return "";
    if (SSC_THEMES_NO_BG[themeId]) return "";
    var file = SSC_THEME_BG_ALIAS[themeId] || themeId;
    try {
      if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL) {
        return chrome.runtime.getURL("assets/themes/" + file + ".jpg");
      }
    } catch (e) {
      /* Extension context invalidated. */
    }
    return "";
  }

  window.SSC_THEMES = SSC_THEMES;
  window.SSC_THEME_CATEGORIES = SSC_THEME_CATEGORIES;
  window.SSC_THEMES_NO_BG = SSC_THEMES_NO_BG;
  window.sscThemeBackground = sscThemeBackground;
})();
