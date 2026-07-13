// Antigravity Conquest - Map Definition
// Designed with 6 continents and 30 territories.
// Coordinates are optimized for a 1000x650 SVG viewBox.

const GameMap = {
  width: 1000,
  height: 650,
  continents: {
    borealis: {
      id: "borealis",
      name: "Borealis (Frozen North)",
      color: "#00f0ff",
      bonus: 3,
      territories: ["B1", "B2", "B3", "B4", "B5"]
    },
    aetheria: {
      id: "aetheria",
      name: "Aetheria (Sky Highlands)",
      color: "#d000ff",
      bonus: 4,
      territories: ["A1", "A2", "A3", "A4", "A5", "A6"]
    },
    elvoria: {
      id: "elvoria",
      name: "Elvoria (Emerald Woods)",
      color: "#00ff66",
      bonus: 4,
      territories: ["E1", "E2", "E3", "E4", "E5", "E6"]
    },
    nautilus: {
      id: "nautilus",
      name: "Nautilus (Sunken Deep)",
      color: "#0066ff",
      bonus: 2,
      territories: ["N1", "N2", "N3", "N4"]
    },
    zuldakar: {
      id: "zuldakar",
      name: "Zul'Dakar (Desert Dunes)",
      color: "#ffaa00",
      bonus: 3,
      territories: ["Z1", "Z2", "Z3", "Z4", "Z5"]
    },
    vulkan: {
      id: "vulkan",
      name: "Vulkan (Volcanic Rift)",
      color: "#ff3300",
      bonus: 2,
      territories: ["V1", "V2", "V3", "V4"]
    }
  },
  territories: {
    // Borealis
    "B1": { id: "B1", name: "Frostguard", continent: "borealis", x: 180, y: 120, neighbors: ["B2", "B4", "B5"] },
    "B2": { id: "B2", name: "Whiteout", continent: "borealis", x: 280, y: 80, neighbors: ["B1", "B3", "B4"] },
    "B3": { id: "B3", name: "Icecap", continent: "borealis", x: 380, y: 100, neighbors: ["B2", "B4", "A1"] }, // A1 is inter-continental
    "B4": { id: "B4", name: "Tundra", continent: "borealis", x: 260, y: 170, neighbors: ["B1", "B2", "B3", "B5", "N1"] }, // N1 is inter-continental
    "B5": { id: "B5", name: "Glacier", continent: "borealis", x: 140, y: 200, neighbors: ["B1", "B4", "E2"] }, // E2 is inter-continental

    // Aetheria
    "A1": { id: "A1", name: "Cloudreach", continent: "aetheria", x: 620, y: 80, neighbors: ["A2", "A6", "B3"] },
    "A2": { id: "A2", name: "Skypoint", continent: "aetheria", x: 720, y: 100, neighbors: ["A1", "A3", "A5"] },
    "A3": { id: "A3", name: "Aether", continent: "aetheria", x: 820, y: 110, neighbors: ["A2", "A4", "A5"] },
    "A4": { id: "A4", name: "Zeppelin", continent: "aetheria", x: 860, y: 200, neighbors: ["A3", "A5", "V2"] }, // V2 is inter-continental
    "A5": { id: "A5", name: "Nimbus", continent: "aetheria", x: 760, y: 190, neighbors: ["A2", "A3", "A4", "A6", "N2"] }, // N2 is inter-continental
    "A6": { id: "A6", name: "Horizon", continent: "aetheria", x: 650, y: 170, neighbors: ["A1", "A5", "N1"] }, // N1 is inter-continental

    // Elvoria
    "E1": { id: "E1", name: "Eldoria", continent: "elvoria", x: 120, y: 320, neighbors: ["E2", "E4", "E5"] },
    "E2": { id: "E2", name: "Silverwood", continent: "elvoria", x: 220, y: 280, neighbors: ["E1", "E3", "E4", "B5"] },
    "E3": { id: "E3", name: "Goldfield", continent: "elvoria", x: 320, y: 270, neighbors: ["E2", "E4", "E6"] },
    "E4": { id: "E4", name: "Shadowfen", continent: "elvoria", x: 240, y: 370, neighbors: ["E1", "E2", "E3", "E5", "E6"] },
    "E5": { id: "E5", name: "Sunspire", continent: "elvoria", x: 140, y: 430, neighbors: ["E1", "E4", "Z1"] }, // Z1 is inter-continental
    "E6": { id: "E6", name: "Whispering Pines", continent: "elvoria", x: 350, y: 360, neighbors: ["E3", "E4", "Z2", "N3"] }, // Z2, N3 are inter-continental

    // Nautilus
    "N1": { id: "N1", name: "Coral", continent: "nautilus", x: 480, y: 200, neighbors: ["N2", "B4", "A6"] },
    "N2": { id: "N2", name: "Abyss", continent: "nautilus", x: 530, y: 280, neighbors: ["N1", "N3", "N4", "A5"] },
    "N3": { id: "N3", name: "Atoll", continent: "nautilus", x: 450, y: 370, neighbors: ["N2", "N4", "E6", "Z3"] },
    "N4": { id: "N4", name: "Mariana", continent: "nautilus", x: 580, y: 370, neighbors: ["N2", "N3", "V1"] },

    // Zul'Dakar
    "Z1": { id: "Z1", name: "Sandspire", continent: "zuldakar", x: 180, y: 530, neighbors: ["Z2", "Z4", "E5"] },
    "Z2": { id: "Z2", name: "Oasis", continent: "zuldakar", x: 280, y: 490, neighbors: ["Z1", "Z3", "Z4", "E6"] },
    "Z3": { id: "Z3", name: "Dunes", continent: "zuldakar", x: 380, y: 500, neighbors: ["Z2", "Z5", "N3", "V1"] }, // V1 is inter-continental
    "Z4": { id: "Z4", name: "Canyon", continent: "zuldakar", x: 240, y: 600, neighbors: ["Z1", "Z2", "Z5"] },
    "Z5": { id: "Z5", name: "Badlands", continent: "zuldakar", x: 370, y: 600, neighbors: ["Z3", "Z4", "V4"] }, // V4 is inter-continental

    // Vulkan
    "V1": { id: "V1", name: "Obsidian", continent: "vulkan", x: 680, y: 480, neighbors: ["V2", "V4", "N4", "Z3"] },
    "V2": { id: "V2", name: "Volcania", continent: "vulkan", x: 790, y: 460, neighbors: ["V1", "V3", "V4", "A4"] },
    "V3": { id: "V3", name: "Cinder", continent: "vulkan", x: 890, y: 480, neighbors: ["V2", "V4"] },
    "V4": { id: "V4", name: "Brimstone", continent: "vulkan", x: 790, y: 560, neighbors: ["V1", "V2", "V3", "Z5"] }
  }
};
