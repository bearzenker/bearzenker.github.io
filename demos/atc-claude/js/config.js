// Game configuration - all magic numbers live here.
export const CONFIG = {
    // Radar geometry
    radarPixels: 700,
    blockPixels: 10,
    get blocks() { return this.radarPixels / this.blockPixels; }, // 70

    // Turn timing
    turnPauseMs: 5000,

    // Level 1 settings
    level: {
        turns: 75,
        initialAircraft: 2,
        spawnEveryTurns: 5,
        maxAircraft: 6,
    },

    // Aircraft physics defaults
    aircraft: {
        speed: 1,             // blocks per turn
        turnRate: 30,         // degrees per turn
        climbRate: 2,         // Angels per turn
        minSpawnAlt: 5,
        maxSpawnAlt: 20,
    },

    // Airport / runway
    airport: {
        centerBlockX: 35,
        centerBlockY: 35,
        runwayLengthBlocks: 3,
        approachLengthBlocks: 10,
        approachHalfWidthBlocks: 3,
        // Wind blows in this compass direction; planes land into the wind
        // (landing heading = windDirection + 180).
        windDirection: 90, // east
    },

    // Landing rules
    landing: {
        maxAltitude: 5,
        headingToleranceDeg: 30,
        approachCountdown: 5,
    },

    // Proximity / scoring
    proximity: {
        nearMissBlocks: 2,
        collisionBlocks: 1,
        altitudeSeparation: 1, // same block OK if altitudes differ by >= this
    },

    scoring: {
        landing: 100,
        nearMiss: -25,
        lostAircraft: -50,
    },

    // Aircraft selection
    selectRadiusBlocks: 2,
};
