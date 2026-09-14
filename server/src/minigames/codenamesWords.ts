// Einzelwort-Karten für Codenames: konkrete, gut ratbare deutsche Substantive.
export const CODENAMES_WORDS: string[] = [
  "ADLER", "AFRIKA", "AGENT", "AMPEL", "ANGEL", "ANKER", "APFEL", "ARM",
  "ARZT", "AUGE", "AUTO", "BABY", "BACH", "BALL", "BANK", "BÄR", "BART",
  "BAUM", "BERG", "BERLIN", "BESEN", "BETT", "BIENE", "BILD", "BIRNE",
  "BLATT", "BLITZ", "BLUME", "BODEN", "BOGEN", "BOOT", "BRIEF", "BRILLE",
  "BROT", "BRÜCKE", "BUCH", "BÜRSTE", "BUTTER", "CHINA", "CLOWN", "COMPUTER",
  "DACH", "DAME", "DÄMON", "DECKE", "DEGEN", "DELFIN", "DEUTSCHLAND",
  "DIAMANT", "DINOSAURIER", "DOKTOR", "DONNER", "DORF", "DRACHE", "DRAHT",
  "DUSCHE", "EI", "EICHE", "EIMER", "EIS", "EISEN", "ELEFANT", "ENGEL",
  "ENTE", "ERDE", "ESEL", "EULE", "FABRIK", "FADEN", "FAHNE", "FALKE",
  "FASS", "FEDER", "FELD", "FENSTER", "FEUER", "FILM", "FINGER", "FISCH",
  "FLASCHE", "FLÖTE", "FLUSS", "FLÜGEL", "FRANKREICH", "FROSCH", "FUCHS",
  "FUSS", "GABEL", "GARTEN", "GEIGE", "GEIST", "GELD", "GESICHT", "GIFT",
  "GITARRE", "GLAS", "GLOCKE", "GOLD", "GRAS", "HAFEN", "HAI", "HAKEN",
  "HAMMER", "HAND", "HASE", "HAUS", "HELD", "HEMD", "HERZ", "HIMMEL",
  "HOLZ", "HONIG", "HOSE", "HOTEL", "HUND", "HUT", "IGEL", "INDIEN",
  "INSEL", "JÄGER", "KAFFEE", "KAKTUS", "KAMEL", "KAMM", "KANONE", "KARTE",
  "KÄSE", "KASTEN", "KATZE", "KERZE", "KETTE", "KIND", "KINO", "KIRCHE",
  "KISSEN", "KISTE", "KLAVIER", "KLEID", "KNOCHEN", "KNOPF", "KÖNIG",
  "KOPF", "KORB", "KRAFT", "KRANICH", "KRANKENHAUS", "KREBS", "KREIS",
  "KREUZ", "KRONE", "KUCHEN", "KUGEL", "KUH", "KÜCHE", "KÜRBIS", "LABOR",
  "LAMPE", "LAND", "LAUB", "LEBEN", "LEITER", "LICHT", "LINIE", "LIPPE",
  "LÖFFEL", "LONDON", "LÖWE", "LUFT", "MAGNET", "MANTEL", "MASCHINE",
  "MASKE", "MAUER", "MAUS", "MEER", "MESSER", "METALL", "MEXIKO", "MILCH",
  "MOND", "MOTOR", "MÜCKE", "MÜHLE", "MÜLL", "MUND", "MÜNZE", "NADEL",
  "NAGEL", "NASE", "NEBEL", "NETZ", "NINJA", "NUSS", "OFEN", "OHR", "OPER",
  "ORANGE", "ORGEL", "PALME", "PAPIER", "PARK", "PFEIL", "PFERD", "PFLANZE",
  "PILZ", "PINGUIN", "PINSEL", "PIRAT", "PISTOLE", "PLATTE", "POLIZEI",
  "PROFESSOR", "PYRAMIDE", "QUELLE", "RABE", "RAD", "RAKETE", "RATTE",
  "RAUM", "REGEN", "REH", "REIFEN", "RIESE", "RING", "RITTER", "ROBOTER",
  "ROCK", "ROM", "ROSE", "RÜCKEN", "SÄGE", "SALZ", "SAND", "SÄNGER",
  "SATELLIT", "SCHACH", "SCHAF", "SCHATTEN", "SCHATZ", "SCHIFF", "SCHILD",
  "SCHLANGE", "SCHLOSS", "SCHLÜSSEL", "SCHNEE", "SCHRANK", "SCHUH",
  "SCHULE", "SCHWAN", "SCHWEIN", "SCHWERT", "SEE", "SEGEL", "SEIFE",
  "SEIL", "SENSE", "SESSEL", "SICHEL", "SOFA", "SOLDAT", "SONNE",
  "SPATZ", "SPIEGEL", "SPINNE", "SPUR", "STADION", "STADT", "STAR",
  "STEIN", "STERN", "STIEFEL", "STIFT", "STIMME", "STRAND", "STRASSE",
  "STROH", "STUHL", "STURM", "TAFEL", "TASSE", "TAUBE", "TEE", "TEICH",
  "TELEFON", "TELLER", "TEPPICH", "TEUFEL", "THEATER", "TIGER", "TISCH",
  "TOPF", "TOR", "TÜR", "TÜRKEI", "TURM", "UHR", "VOGEL", "VULKAN",
  "WAFFE", "WAGEN", "WALD", "WAND", "WÄSCHE", "WASSER", "WELLE", "WELT",
  "WESPE", "WIND", "WOLF", "WOLKE", "WÜRFEL", "WURM", "WURST", "ZAHN",
  "ZAUN", "ZEBRA", "ZELT", "ZIEGE", "ZIRKUS", "ZUG", "ZWERG",
];

/** Returns `count` distinct random words (uppercase). */
export function pickWords(count: number): string[] {
  const pool = [...CODENAMES_WORDS];
  const out: string[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}
