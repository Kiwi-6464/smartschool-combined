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
      "--ssc-accent": "#e0e0e0",
      "--ssc-base00": "#141313",
      "--ssc-base01": "#1e1c1c",
      "--ssc-base02": "#2a2828",
      "--ssc-base03": "#373434",
      "--ssc-homepage-sidebars-bg": "#0c0b0b1a",
      "--ssc-splashtext": "#ededed",
      "--ssc-text": "#d5d5d5",
      "--darken-background": "#0c0b0b4d"
    }
  },
  "default": {
    "name": "Default Deluxe",
    "css": {
      "--ssc-accent": "#e8e8e8",
      "--ssc-text": "#d5d5d5",
      "--ssc-base00": "#141414",
      "--ssc-base01": "#1f1f1f",
      "--ssc-base02": "#2c2c2c",
      "--ssc-base03": "#383838",
      "--ssc-homepage-sidebars-bg": "#0b0b0b1a",
      "--ssc-splashtext": "#e8e8e8",
      "--darken-background": "#0b0b0b4d"
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
    "name": "Black Dunes",
    "css": {
      "--ssc-accent": "#e0e0e0",
      "--ssc-base00": "#141313",
      "--ssc-base01": "#1e1c1c",
      "--ssc-base02": "#2a2828",
      "--ssc-base03": "#373434",
      "--ssc-homepage-sidebars-bg": "#0c0b0b1a",
      "--ssc-splashtext": "#ededed",
      "--ssc-text": "#d5d5d5",
      "--darken-background": "#0c0b0b4d",
      "--ssc-scrim": "color-mix(in srgb, #141313 50%, transparent)"
    }
  },
  "purple": {
    "name": "Neon Violet",
    "css": {
      "--ssc-accent": "#7e76dc",
      "--ssc-base00": "#100f17",
      "--ssc-base01": "#181724",
      "--ssc-base02": "#212032",
      "--ssc-base03": "#2c2a41",
      "--ssc-homepage-sidebars-bg": "#09090e1a",
      "--ssc-splashtext": "#ececef",
      "--ssc-text": "#d2d2d8",
      "--darken-background": "#09090e4d",
      "--ssc-scrim": "color-mix(in srgb, #100f17 30%, transparent)"
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
      "--ssc-accent": "#6f6e6b",
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
  "japan": {
    "name": "Maple Fuji",
    "css": {
      "--ssc-accent": "#da6c75",
      "--ssc-base00": "#151111",
      "--ssc-base01": "#211a1a",
      "--ssc-base02": "#2e2524",
      "--ssc-base03": "#3c302f",
      "--ssc-homepage-sidebars-bg": "#0d0a0a1a",
      "--ssc-splashtext": "#efecec",
      "--ssc-text": "#d8d2d2",
      "--darken-background": "#0d0a0a4d",
      "--ssc-scrim": "color-mix(in srgb, #151111 55%, transparent)"
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
      "--ssc-splashtext": "#e6e6e6",
      "--ssc-text": "#e6e6e6",
      "--darken-background": "#1010104d"
    }
  },
  "mclaren": {
    "name": "McLaren",
    "css": {
      "--ssc-accent": "#e0e0e0",
      "--ssc-base00": "#141313",
      "--ssc-base01": "#1e1c1c",
      "--ssc-base02": "#2a2828",
      "--ssc-base03": "#373434",
      "--ssc-homepage-sidebars-bg": "#0c0b0b1a",
      "--ssc-splashtext": "#ededed",
      "--ssc-text": "#d5d5d5",
      "--darken-background": "#0c0b0b4d"
    }
  },
  "fuji": {
    "name": "Cherry Tree",
    "css": {
      "--ssc-accent": "#87223b",
      "--ssc-base00": "#e9e2e4",
      "--ssc-base01": "#e2d7da",
      "--ssc-base02": "#dacdd0",
      "--ssc-base03": "#cbb8bd",
      "--ssc-homepage-sidebars-bg": "#dcd0d31a",
      "--ssc-splashtext": "#251f20",
      "--ssc-text": "#251f20",
      "--darken-background": "#dcd0d366",
      "--ssc-scrim": "color-mix(in srgb, #e9e2e4 35%, transparent)"
    }
  },
  "luna": {
    "name": "Moon",
    "css": {
      "--ssc-accent": "#e0e0e0",
      "--ssc-base00": "#141313",
      "--ssc-base01": "#1e1c1c",
      "--ssc-base02": "#2a2828",
      "--ssc-base03": "#373434",
      "--ssc-homepage-sidebars-bg": "#0c0b0b1a",
      "--ssc-splashtext": "#ededed",
      "--ssc-text": "#d5d5d5",
      "--darken-background": "#0c0b0b4d"
    }
  },
  "e30": {
    "name": "E30",
    "css": {
      "--ssc-accent": "#6c9ada",
      "--ssc-base00": "#101316",
      "--ssc-base01": "#181c22",
      "--ssc-base02": "#222830",
      "--ssc-base03": "#2c343f",
      "--ssc-homepage-sidebars-bg": "#0a0b0d1a",
      "--ssc-splashtext": "#ecedef",
      "--ssc-text": "#d2d5d8",
      "--darken-background": "#0a0b0d4d"
    }
  },
  "monaco": {
    "name": "Monaco Duo",
    "css": {
      "--ssc-accent": "#daac6c",
      "--ssc-base00": "#17140f",
      "--ssc-base01": "#231e17",
      "--ssc-base02": "#312a20",
      "--ssc-base03": "#41372a",
      "--ssc-homepage-sidebars-bg": "#0e0c091a",
      "--ssc-splashtext": "#efedec",
      "--ssc-text": "#d8d6d2",
      "--darken-background": "#0e0c094d"
    }
  },
  "neonmclaren": {
    "name": "Neon Mclaren",
    "css": {
      "--ssc-accent": "#e0e0e0",
      "--ssc-base00": "#141313",
      "--ssc-base01": "#1e1c1c",
      "--ssc-base02": "#2a2828",
      "--ssc-base03": "#373434",
      "--ssc-homepage-sidebars-bg": "#0c0b0b1a",
      "--ssc-splashtext": "#ededed",
      "--ssc-text": "#d5d5d5",
      "--darken-background": "#0c0b0b4d",
      "--ssc-scrim": "color-mix(in srgb, #141313 15%, transparent)"
    }
  },
  "gargantua": {
    "name": "Gargantua",
    "css": {
      "--ssc-accent": "#da886c",
      "--ssc-base00": "#151211",
      "--ssc-base01": "#211c1a",
      "--ssc-base02": "#2e2624",
      "--ssc-base03": "#3c322f",
      "--ssc-homepage-sidebars-bg": "#0d0b0a1a",
      "--ssc-splashtext": "#efecec",
      "--ssc-text": "#d8d3d2",
      "--darken-background": "#0d0b0a4d"
    }
  },
  "blueaesthetic": {
    "name": "Blue Aesthetic",
    "css": {
      "--ssc-accent": "#6cacda",
      "--ssc-base00": "#0d1419",
      "--ssc-base01": "#151f26",
      "--ssc-base02": "#1d2b35",
      "--ssc-base03": "#253846",
      "--ssc-homepage-sidebars-bg": "#080c0f1a",
      "--ssc-splashtext": "#ecedef",
      "--ssc-text": "#d2d6d8",
      "--darken-background": "#080c0f4d"
    }
  },
  "gta6": {
    "name": "GTA VI",
    "css": {
      "--ssc-accent": "#da6cd1",
      "--ssc-base00": "#190d18",
      "--ssc-base01": "#261525",
      "--ssc-base02": "#351d33",
      "--ssc-base03": "#462543",
      "--ssc-homepage-sidebars-bg": "#0f080e1a",
      "--ssc-splashtext": "#efecee",
      "--ssc-text": "#d8d2d8",
      "--darken-background": "#0f080e4d"
    }
  },
  "lucia": {
    "name": "Lucia",
    "css": {
      "--ssc-accent": "#6c9ada",
      "--ssc-base00": "#0f1218",
      "--ssc-base01": "#161c24",
      "--ssc-base02": "#1f2732",
      "--ssc-base03": "#293342",
      "--ssc-homepage-sidebars-bg": "#090b0e1a",
      "--ssc-splashtext": "#ecedef",
      "--ssc-text": "#d2d5d8",
      "--darken-background": "#090b0e4d",
      "--ssc-scrim": "color-mix(in srgb, #0f1218 25%, transparent)"
    }
  },
  "mbappe": {
    "name": "EA FC 27",
    "css": {
      "--ssc-accent": "#83b3c3",
      "--ssc-base00": "#101516",
      "--ssc-base01": "#192022",
      "--ssc-base02": "#222c2f",
      "--ssc-base03": "#2d3a3e",
      "--ssc-homepage-sidebars-bg": "#0a0c0d1a",
      "--ssc-splashtext": "#eceeef",
      "--ssc-text": "#d2d7d8",
      "--darken-background": "#0a0c0d4d",
      "--ssc-scrim": "color-mix(in srgb, #101516 20%, transparent)"
    }
  },
  "macos": {
    "name": "macOS Monterey",
    "css": {
      "--ssc-accent": "#e0e0e0",
      "--ssc-base00": "#141313",
      "--ssc-base01": "#1e1c1c",
      "--ssc-base02": "#2a2828",
      "--ssc-base03": "#373434",
      "--ssc-homepage-sidebars-bg": "#0c0b0b1a",
      "--ssc-splashtext": "#ededed",
      "--ssc-text": "#d5d5d5",
      "--darken-background": "#0c0b0b4d"
    }
  },
  "surface": {
    "name": "Surface",
    "css": {
      "--ssc-accent": "#839ec3",
      "--ssc-base00": "#121315",
      "--ssc-base01": "#1b1d20",
      "--ssc-base02": "#26282c",
      "--ssc-base03": "#31353a",
      "--ssc-homepage-sidebars-bg": "#0b0b0c1a",
      "--ssc-splashtext": "#ecedef",
      "--ssc-text": "#d2d5d8",
      "--darken-background": "#0b0b0c4d"
    }
  },
  "windows11": {
    "name": "Windows 11 Dark",
    "css": {
      "--ssc-accent": "#e0e0e0",
      "--ssc-base00": "#141313",
      "--ssc-base01": "#1e1c1c",
      "--ssc-base02": "#2a2828",
      "--ssc-base03": "#373434",
      "--ssc-homepage-sidebars-bg": "#0c0b0b1a",
      "--ssc-splashtext": "#ededed",
      "--ssc-text": "#d5d5d5",
      "--darken-background": "#0c0b0b4d"
    }
  },
  "helloworld": {
    "name": "Hello World",
    "css": {
      "--ssc-accent": "#83a9c3",
      "--ssc-base00": "#121315",
      "--ssc-base01": "#1b1e20",
      "--ssc-base02": "#26292c",
      "--ssc-base03": "#32363a",
      "--ssc-homepage-sidebars-bg": "#0b0c0c1a",
      "--ssc-splashtext": "#ecedef",
      "--ssc-text": "#d2d6d8",
      "--darken-background": "#0b0c0c4d"
    }
  },
  "snowmountains": {
    "name": "Snow Mountains",
    "css": {
      "--ssc-accent": "#da756c",
      "--ssc-base00": "#161110",
      "--ssc-base01": "#221a19",
      "--ssc-base02": "#2f2423",
      "--ssc-base03": "#3e2f2d",
      "--ssc-homepage-sidebars-bg": "#0d0a0a1a",
      "--ssc-splashtext": "#efecec",
      "--ssc-text": "#d8d2d2",
      "--darken-background": "#0d0a0a4d",
      "--ssc-scrim": "color-mix(in srgb, #161110 40%, transparent)"
    }
  },
  "windows11blue": {
    "name": "Windows 11 Blue",
    "css": {
      "--ssc-accent": "#224c87",
      "--ssc-base00": "#dee4ed",
      "--ssc-base01": "#d2dbe7",
      "--ssc-base02": "#c7d1e1",
      "--ssc-base03": "#afbfd4",
      "--ssc-homepage-sidebars-bg": "#cad4e21a",
      "--ssc-splashtext": "#1f2125",
      "--ssc-text": "#1f2125",
      "--darken-background": "#cad4e266",
      "--ssc-scrim": "color-mix(in srgb, #dee4ed 35%, transparent)"
    }
  },
  "windows11abstract": {
    "name": "Windows 11 Abstract",
    "css": {
      "--ssc-accent": "#825a21",
      "--ssc-base00": "#e9e6e2",
      "--ssc-base01": "#e2ddd8",
      "--ssc-base02": "#dad5cd",
      "--ssc-base03": "#cbc3b9",
      "--ssc-homepage-sidebars-bg": "#dcd7d01a",
      "--ssc-splashtext": "#25221f",
      "--ssc-text": "#25221f",
      "--darken-background": "#dcd7d066",
      "--ssc-scrim": "color-mix(in srgb, #e9e6e2 35%, transparent)"
    }
  },
  "applelogo": {
    "name": "Apple Glow",
    "css": {
      "--ssc-accent": "#224c87",
      "--ssc-base00": "#e0e5eb",
      "--ssc-base01": "#d6dbe4",
      "--ssc-base02": "#cbd2dd",
      "--ssc-base03": "#b5c0ce",
      "--ssc-homepage-sidebars-bg": "#ced5df1a",
      "--ssc-splashtext": "#1f2125",
      "--ssc-text": "#1f2125",
      "--darken-background": "#ced5df66"
    }
  },
  "infinitypurple": {
    "name": "Infinity Purple",
    "css": {
      "--ssc-accent": "#222a87",
      "--ssc-base00": "#e0e1eb",
      "--ssc-base01": "#d5d6e4",
      "--ssc-base02": "#caccdd",
      "--ssc-base03": "#b4b7cf",
      "--ssc-homepage-sidebars-bg": "#cdcfdf1a",
      "--ssc-splashtext": "#1c1d21",
      "--ssc-text": "#1c1d21",
      "--darken-background": "#cdcfdf66",
      "--ssc-scrim": "color-mix(in srgb, #e0e1eb 25%, transparent)"
    }
  },
  "pinkabstract": {
    "name": "Pink Abstract",
    "css": {
      "--ssc-accent": "#87223b",
      "--ssc-base00": "#eae1e3",
      "--ssc-base01": "#e2d7da",
      "--ssc-base02": "#dbccd0",
      "--ssc-base03": "#ccb7bd",
      "--ssc-homepage-sidebars-bg": "#ddcfd31a",
      "--ssc-splashtext": "#251f20",
      "--ssc-text": "#251f20",
      "--darken-background": "#ddcfd366"
    }
  },
  "christmastree": {
    "name": "Christmas Tree",
    "css": {
      "--ssc-accent": "#6c9ada",
      "--ssc-base00": "#0d1219",
      "--ssc-base01": "#151c26",
      "--ssc-base02": "#1d2735",
      "--ssc-base03": "#253346",
      "--ssc-homepage-sidebars-bg": "#080b0f1a",
      "--ssc-splashtext": "#ecedef",
      "--ssc-text": "#d2d5d8",
      "--darken-background": "#080b0f4d",
      "--ssc-scrim": "color-mix(in srgb, #0d1219 20%, transparent)"
    }
  },
  "gameart1": {
    "name": "Game Art 1",
    "css": {
      "--ssc-accent": "#da9a6c",
      "--ssc-base00": "#19120d",
      "--ssc-base01": "#261c15",
      "--ssc-base02": "#35271d",
      "--ssc-base03": "#463325",
      "--ssc-homepage-sidebars-bg": "#0f0b081a",
      "--ssc-splashtext": "#efedec",
      "--ssc-text": "#d8d5d2",
      "--darken-background": "#0f0b084d",
      "--ssc-scrim": "color-mix(in srgb, #19120d 35%, transparent)"
    }
  },
  "gameart2": {
    "name": "Game Art 2",
    "css": {
      "--ssc-accent": "#da886c",
      "--ssc-base00": "#19100d",
      "--ssc-base01": "#261915",
      "--ssc-base02": "#35231d",
      "--ssc-base03": "#462e25",
      "--ssc-homepage-sidebars-bg": "#0f0a081a",
      "--ssc-splashtext": "#efecec",
      "--ssc-text": "#d8d3d2",
      "--darken-background": "#0f0a084d"
    }
  },
  "gameart3": {
    "name": "Game Art 3",
    "css": {
      "--ssc-accent": "#6cacda",
      "--ssc-base00": "#0f1317",
      "--ssc-base01": "#181c23",
      "--ssc-base02": "#212731",
      "--ssc-base03": "#2b3440",
      "--ssc-homepage-sidebars-bg": "#090b0e1a",
      "--ssc-splashtext": "#ecedef",
      "--ssc-text": "#d2d5d8",
      "--darken-background": "#090b0e4d",
      "--ssc-scrim": "color-mix(in srgb, #0f1317 45%, transparent)"
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
  "stalker": {
    "name": "Ruby Eclipse",
    "css": {
      "--ssc-accent": "#da665e",
      "--ssc-text": "#fef6f4",
      "--ssc-base00": "#1a1311",
      "--ssc-base01": "#371b19",
      "--ssc-base02": "#5c1c1a",
      "--ssc-base03": "#823530",
      "--ssc-homepage-sidebars-bg": "#100b091a",
      "--ssc-splashtext": "#fef6f4",
      "--darken-background": "#100b094d"
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
      "--ssc-splashtext": "#f7f6f4",
      "--ssc-text": "#f7f6f4",
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
      "--ssc-splashtext": "#ffffff",
      "--ssc-text": "#ffffff",
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
      "--ssc-splashtext": "#ffffff",
      "--ssc-text": "#ffffff",
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
      "--ssc-splashtext": "#ffffff",
      "--ssc-text": "#ffffff",
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
      "--ssc-splashtext": "#ffffff",
      "--ssc-text": "#ffffff",
      "--darken-background": "#0406094d",
      "--ssc-scrim": "color-mix(in srgb, #090c10 40%, transparent)"
    }
  },
  "vax": {
    "name": "Star Wars",
    "css": {
      "--ssc-accent": "#d6b7b0",
      "--ssc-text": "#ffffff",
      "--ssc-base00": "#411900",
      "--ssc-base01": "#724021",
      "--ssc-base02": "#b9815d",
      "--ssc-base03": "#caa288",
      "--ssc-homepage-sidebars-bg": "#02020585",
      "--darken-background": "rgba(0,0,0,0.15)",
      "--ssc-scrim": "color-mix(in srgb, #411900 35%, transparent)",
      "--ssc-splashtext": "#ffffff"
    }
  },
  "sand": {
    "name": "Sahara Oasis",
    "css": {
      "--ssc-accent": "#8a9fca",
      "--ssc-base00": "#2e2526",
      "--ssc-base01": "#3d3434",
      "--ssc-base02": "#544848",
      "--ssc-base03": "#634f4e",
      "--ssc-homepage-sidebars-bg": "#1a16171a",
      "--ssc-splashtext": "#ffffff",
      "--ssc-text": "#ffffff",
      "--darken-background": "#1a16174d"
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
      "--ssc-splashtext": "#efd9ff",
      "--ssc-text": "#efd9ff",
      "--darken-background": "#0701184d"
    }
  },
  "pink": {
    "name": "Cherry Haze",
    "css": {
      "--ssc-accent": "#953366",
      "--ssc-base00": "#f7ccd5",
      "--ssc-base01": "#fbbecc",
      "--ssc-base02": "#f0a8c1",
      "--ssc-base03": "#ea8eb0",
      "--ssc-homepage-sidebars-bg": "#ebc6d21a",
      "--ssc-splashtext": "#000000",
      "--ssc-text": "#000000",
      "--darken-background": "#ebc6d266"
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
  "smkerst": {
    "name": "Smartschool Kerst",
    "css": {
      "--ssc-accent": "#f6ed4f",
      "--ssc-base00": "#051e45",
      "--ssc-base01": "#124f96",
      "--ssc-base02": "#3071c9",
      "--ssc-base03": "#4b47c0",
      "--ssc-homepage-sidebars-bg": "#0c12251a",
      "--ssc-splashtext": "#ffffff",
      "--ssc-text": "#ffffff",
      "--darken-background": "#0c12254d"
    }
  },
  "summer": {
    "name": "Sunset Beach",
    "css": {
      "--ssc-accent": "#1f737c",
      "--ssc-base00": "#efe9d3",
      "--ssc-base01": "#f2e8ca",
      "--ssc-base02": "#e2d4ac",
      "--ssc-base03": "#c4c8c7",
      "--ssc-homepage-sidebars-bg": "#e4dcc81a",
      "--ssc-splashtext": "#21160a",
      "--ssc-text": "#21160a",
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
      "--ssc-splashtext": "#fcfdfd",
      "--ssc-text": "#fcfdfd",
      "--darken-background": "#040e134d"
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
      "--ssc-splashtext": "#ffffff",
      "--ssc-text": "#ffffff",
      "--darken-background": "#050e134d",
      "--ssc-scrim": "color-mix(in srgb, #09181f 10%, transparent)"
    }
  },
  "darkglass": {
    "name": "Dark Glass",
    "css": {
      "--ssc-accent": "#667ff8",
      "--ssc-base00": "#010a2c",
      "--ssc-base01": "#0a1a5b",
      "--ssc-base02": "#142d8d",
      "--ssc-base03": "#1e40c4",
      "--ssc-homepage-sidebars-bg": "#03051a1a",
      "--ssc-splashtext": "#ffffff",
      "--ssc-text": "#ffffff",
      "--darken-background": "#03051a4d"
    }
  },
  "lightglass": {
    "name": "Light Glass",
    "css": {
      "--ssc-accent": "#2d5b66",
      "--ssc-base00": "#cdd8e4",
      "--ssc-base01": "#bdcbdb",
      "--ssc-base02": "#acbed2",
      "--ssc-base03": "#8ba4c0",
      "--ssc-homepage-sidebars-bg": "#c8d1db1a",
      "--ssc-splashtext": "#000000",
      "--ssc-text": "#000000",
      "--darken-background": "#c8d1db66",
      "--ssc-scrim": "color-mix(in srgb, #cdd8e4 25%, transparent)"
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
      "--ssc-splashtext": "#ffffff",
      "--ssc-text": "#ffffff",
      "--darken-background": "#060e114d"
    }
  },
  "lost": {
    "name": "Lost",
    "css": {
      "--ssc-accent": "#cc6a58",
      "--ssc-base00": "#10131d",
      "--ssc-base01": "#1b1f2d",
      "--ssc-base02": "#2f3341",
      "--ssc-base03": "#2d395d",
      "--ssc-homepage-sidebars-bg": "#090b121a",
      "--ssc-splashtext": "#fafafc",
      "--ssc-text": "#fafafc",
      "--darken-background": "#090b124d"
    }
  },
  "space": {
    "name": "Space",
    "css": {
      "--ssc-accent": "#a87dc1",
      "--ssc-base00": "#130f19",
      "--ssc-base01": "#2c213a",
      "--ssc-base02": "#45345a",
      "--ssc-base03": "#5e477a",
      "--ssc-homepage-sidebars-bg": "#0b080f1a",
      "--ssc-splashtext": "#ffffff",
      "--ssc-text": "#ffffff",
      "--darken-background": "#0b080f4d"
    }
  },
  "night": {
    "name": "Starful Night",
    "css": {
      "--ssc-accent": "#c4724b",
      "--ssc-base00": "#050709",
      "--ssc-base01": "#192228",
      "--ssc-base02": "#2c3d48",
      "--ssc-base03": "#3f5868",
      "--ssc-homepage-sidebars-bg": "#0204041a",
      "--ssc-splashtext": "#ffffff",
      "--ssc-text": "#ffffff",
      "--darken-background": "#0204044d"
    }
  },
  "lake": {
    "name": "Moody Lake",
    "css": {
      "--ssc-accent": "#69492b",
      "--ssc-base00": "#dacdb8",
      "--ssc-base01": "#d1c1a8",
      "--ssc-base02": "#c8b597",
      "--ssc-base03": "#c29f65",
      "--ssc-homepage-sidebars-bg": "#d7ccbd1a",
      "--ssc-splashtext": "#000000",
      "--ssc-text": "#000000",
      "--darken-background": "#d7ccbd66",
      "--ssc-scrim": "color-mix(in srgb, #dacdb8 35%, transparent)"
    }
  },
  "nightlife": {
    "name": "Nightlife",
    "css": {
      "--ssc-accent": "#e6654f",
      "--ssc-base00": "#042124",
      "--ssc-base01": "#052b30",
      "--ssc-base02": "#073f45",
      "--ssc-base03": "#47848b",
      "--ssc-homepage-sidebars-bg": "#0414161a",
      "--ssc-splashtext": "#ffffff",
      "--ssc-text": "#ffffff",
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
      "--ssc-splashtext": "#ffffff",
      "--ssc-text": "#ffffff",
      "--darken-background": "#010e144d",
      "--ssc-scrim": "color-mix(in srgb, #011820 15%, transparent)"
    }
  },
  "greenneon": {
    "name": "Neon Shinjuku",
    "css": {
      "--ssc-accent": "#ea5c69",
      "--ssc-base00": "#0c1710",
      "--ssc-base01": "#16291d",
      "--ssc-base02": "#24412f",
      "--ssc-base03": "#c68c02",
      "--ssc-homepage-sidebars-bg": "#060e091a",
      "--ssc-splashtext": "#ffffff",
      "--ssc-text": "#ffffff",
      "--darken-background": "#060e094d"
    }
  },
  "morninglake": {
    "name": "Morning Lake",
    "css": {
      "--ssc-accent": "#82a6b5",
      "--ssc-base00": "#0e1a1a",
      "--ssc-base01": "#1f3c3c",
      "--ssc-base02": "#315d5d",
      "--ssc-base03": "#437e7e",
      "--ssc-homepage-sidebars-bg": "#0710101a",
      "--ssc-splashtext": "#ffffff",
      "--ssc-text": "#ffffff",
      "--darken-background": "#0710104d",
      "--ssc-scrim": "color-mix(in srgb, #0e1a1a 40%, transparent)"
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
      "--ssc-splashtext": "#000000",
      "--ssc-text": "#000000",
      "--darken-background": "#c6d3d866",
      "--ssc-scrim": "color-mix(in srgb, #c8d9e0 25%, transparent)"
    }
  },
  "cloudyluna": {
    "name": "Cloudy Luna",
    "css": {
      "--ssc-accent": "#c5718b",
      "--ssc-base00": "#0e0f1a",
      "--ssc-base01": "#21223a",
      "--ssc-base02": "#33355b",
      "--ssc-base03": "#45487c",
      "--ssc-homepage-sidebars-bg": "#0708101a",
      "--ssc-splashtext": "#ffffff",
      "--ssc-text": "#ffffff",
      "--darken-background": "#0708104d"
    }
  },
  "redsky": {
    "name": "Crimson Sky",
    "css": {
      "--ssc-accent": "#f46773",
      "--ssc-base00": "#021b22",
      "--ssc-base01": "#09333e",
      "--ssc-base02": "#0e4755",
      "--ssc-base03": "#6b8d95",
      "--ssc-homepage-sidebars-bg": "#0211151a",
      "--ssc-splashtext": "#ffffff",
      "--ssc-text": "#ffffff",
      "--darken-background": "#0211154d"
    }
  },
  "dino": {
    "name": "Dyno",
    "css": {
      "--ssc-accent": "#f1d98f",
      "--ssc-base00": "#174755",
      "--ssc-base01": "#1c687f",
      "--ssc-base02": "#1990b5",
      "--ssc-base03": "#45b9dc",
      "--ssc-homepage-sidebars-bg": "#13262c1a",
      "--ssc-splashtext": "#ffffff",
      "--ssc-text": "#ffffff",
      "--darken-background": "#13262c4d",
      "--ssc-scrim": "color-mix(in srgb, #174755 40%, transparent)"
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
      "--ssc-splashtext": "#ffffff",
      "--ssc-text": "#ffffff",
      "--darken-background": "#0109154d"
    }
  },
  "hole": {
    "name": "Gargantua",
    "css": {
      "--ssc-accent": "#b7734f",
      "--ssc-base00": "#100d0d",
      "--ssc-base01": "#1d1c1b",
      "--ssc-base02": "#2b2927",
      "--ssc-base03": "#a3705a",
      "--ssc-homepage-sidebars-bg": "#0907071a",
      "--ssc-splashtext": "#f2e8e2",
      "--ssc-text": "#f2e8e2",
      "--darken-background": "#0907074d"
    }
  },
  "redmoon": {
    "name": "Scarlett moon",
    "css": {
      "--ssc-accent": "#d26266",
      "--ssc-base00": "#0b0708",
      "--ssc-base01": "#2c191d",
      "--ssc-base02": "#4c2c33",
      "--ssc-base03": "#6c3f49",
      "--ssc-homepage-sidebars-bg": "#0604041a",
      "--ssc-splashtext": "#fffcfc",
      "--ssc-text": "#fffcfc",
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
      "--ssc-splashtext": "#f3eeff",
      "--ssc-text": "#f3eeff",
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
      "--ssc-splashtext": "#ffffff",
      "--ssc-text": "#ffffff",
      "--darken-background": "#050b0b4d"
    }
  },
  "f40": {
    "name": "Rosé F40",
    "css": {
      "--ssc-accent": "#72283e",
      "--ssc-base00": "#fa9bb1",
      "--ssc-base01": "#fa8fa8",
      "--ssc-base02": "#f27693",
      "--ssc-base03": "#f46788",
      "--ssc-homepage-sidebars-bg": "#f0afbb1a",
      "--ssc-splashtext": "#000000",
      "--ssc-text": "#000000",
      "--darken-background": "#f0afbb66",
      "--ssc-scrim": "color-mix(in srgb, #fa9bb1 10%, transparent)"
    }
  },
  "purpleporsche": {
    "name": "Neon Porsche",
    "css": {
      "--ssc-accent": "#e14aa0",
      "--ssc-base00": "#0a080f",
      "--ssc-base01": "#1f1a30",
      "--ssc-base02": "#342c51",
      "--ssc-base03": "#493e72",
      "--ssc-homepage-sidebars-bg": "#0504081a",
      "--ssc-splashtext": "#f7f6fe",
      "--ssc-text": "#f7f6fe",
      "--darken-background": "#0504084d"
    }
  },
  "bigsur": {
    "name": "Big Sur",
    "css": {
      "--ssc-accent": "#7e8caf",
      "--ssc-base00": "#070b0d",
      "--ssc-base01": "#1a282d",
      "--ssc-base02": "#2c444e",
      "--ssc-base03": "#3e606f",
      "--ssc-homepage-sidebars-bg": "#0306071a",
      "--ssc-splashtext": "#ffffff",
      "--ssc-text": "#ffffff",
      "--darken-background": "#0306074d",
      "--ssc-scrim": "color-mix(in srgb, #070b0d 30%, transparent)"
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
      "--ssc-splashtext": "#ffffff",
      "--ssc-text": "#ffffff",
      "--darken-background": "#0108144d",
      "--ssc-scrim": "color-mix(in srgb, #010f20 30%, transparent)"
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
      "--ssc-splashtext": "#f7f6f5",
      "--ssc-text": "#f7f6f5",
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
      "--ssc-splashtext": "#ffffff",
      "--ssc-text": "#ffffff",
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
      "--ssc-splashtext": "#ffffff",
      "--ssc-text": "#ffffff",
      "--darken-background": "#120a004d",
      "--ssc-scrim": "color-mix(in srgb, #1d1201 10%, transparent)"
    }
  },
  "sm": {
    "name": "Smartschool",
    "css": {
      "--ssc-accent": "#a8540d",
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
  "dunes": {
    "name": "Dusk Dunes",
    "css": {
      "--ssc-accent": "#6e3134",
      "--ssc-base00": "#deb8a4",
      "--ssc-base01": "#d2a892",
      "--ssc-base02": "#c89a81",
      "--ssc-base03": "#d78c64",
      "--ssc-homepage-sidebars-bg": "#d8bfb11a",
      "--ssc-splashtext": "#000000",
      "--ssc-text": "#000000",
      "--darken-background": "#d8bfb166"
    }
  },
  "party": {
    "name": "Fuchsia Party",
    "css": {
      "--ssc-accent": "#e669b2",
      "--ssc-base00": "#190d1c",
      "--ssc-base01": "#43204d",
      "--ssc-base02": "#5c276b",
      "--ssc-base03": "#7b4889",
      "--ssc-homepage-sidebars-bg": "#0f07111a",
      "--ssc-splashtext": "#ffffff",
      "--ssc-text": "#ffffff",
      "--darken-background": "#0f07114d"
    }
  },
  "dragon": {
    "name": "Knight vs Dragon",
    "css": {
      "--ssc-accent": "#ebb39f",
      "--ssc-base00": "#261415",
      "--ssc-base01": "#6f4244",
      "--ssc-base02": "#8e5052",
      "--ssc-base03": "#bb6b6e",
      "--ssc-homepage-sidebars-bg": "#180c0c1a",
      "--ssc-splashtext": "#ffffff",
      "--ssc-text": "#ffffff",
      "--darken-background": "#180c0c4d",
      "--ssc-scrim": "color-mix(in srgb, #261415 20%, transparent)"
    }
  },
  "softwinter": {
    "name": "Soft Winter",
    "css": {
      "--ssc-accent": "#754d35",
      "--ssc-base00": "#e3d6cf",
      "--ssc-base01": "#d9c8bf",
      "--ssc-base02": "#d0baaf",
      "--ssc-base03": "#bc927d",
      "--ssc-homepage-sidebars-bg": "#dacfc91a",
      "--ssc-splashtext": "#000000",
      "--ssc-text": "#000000",
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
      "--ssc-splashtext": "#ffffff",
      "--ssc-text": "#ffffff",
      "--darken-background": "#0d130c4d"
    }
  },
  "misty": {
    "name": "Misty Mountains",
    "css": {
      "--ssc-accent": "#746100",
      "--ssc-base00": "#fbe4aa",
      "--ssc-base01": "#f9dc92",
      "--ssc-base02": "#f8d47a",
      "--ssc-base03": "#f5c44a",
      "--ssc-homepage-sidebars-bg": "#f1dcb01a",
      "--ssc-splashtext": "#1c1c03",
      "--ssc-text": "#1c1c03",
      "--darken-background": "#f1dcb066",
      "--ssc-scrim": "color-mix(in srgb, #fbe4aa 20%, transparent)"
    }
  },
};


  /**
   * Picker groups. Each theme is listed in exactly one group, the one that
   * fits its picture best; the picker sorts every group by name. Dark and
   * Light only hold the themes that fit no subject group.
   */
  var SSC_THEME_CATEGORIES = {
    "car": ["911", "audi", "e30", "f40", "mclaren", "monaco", "neonmclaren", "purpleporsche", "rallyaudi"],
    "japan": ["darkfuji", "fuji", "greenneon", "japan", "nightlife", "tokyo"],
    "space": ["cloudyluna", "galaxy", "gargantua", "hole", "luna", "redmoon", "space"],
    "games": ["gameart1", "gameart2", "gameart3", "gta6", "lucia", "mbappe", "minecraft"],
    "nature": ["alps", "aurora", "bigsur", "bluemountain", "christmastree", "dino", "dragon", "dunes", "fall", "grassy", "lake", "lonelycat", "lost", "matcha", "misty", "morninglake", "mountain", "ocean", "otters", "redsky", "sand", "smkerst", "snowmountains", "softwinter", "summer", "sunset", "vax", "winter"],
    "dark": ["birb", "blueaesthetic", "chocolate", "darkglass", "default", "helloworld", "ldev", "macos", "night", "party", "purple", "stalker", "surface", "tech", "windows11"],
    "light": ["applelogo", "boringwhite", "fairyblue", "infinitypurple", "lightglass", "pink", "pinkabstract", "sm", "white", "windows11abstract", "windows11blue"]
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
    default: true,
    deluxe: true,
    boringwhite: true,
    fairyblue: true,
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
