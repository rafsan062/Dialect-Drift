/** Shared constants and demo copy. */

export const STATE_FIPS_TO_ABBR = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT",
  "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL",
  "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD",
  "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE",
  "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND",
  "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD",
  "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV",
  "55": "WI", "56": "WY",
};

export const US_ATLAS_URL =
  "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

export const SAMPLE_SENTENCES = {
  sandwich: "I grabbed a hoagie before class.",
  soda: "Do you call it pop, soda, or coke?",
  water: "Where is the bubbler?",
  south: "Y'all want to grab a coke before the game?",
  midwest: "You guys want a pop? Put on your tennis shoes first.",
};

export const QUICK_WORDS = ["hoagie", "pop", "y'all", "bubbler", "soda", "crawfish"];

/** Words emphasized in the default explore cloud (high-signal concepts). */
export const TRENDING_WORDS = [
  "hoagie", "sub", "grinder", "hero",
  "pop", "soda", "coke",
  "y'all", "you guys", "youse",
  "bubbler", "tennis shoes", "sneakers",
  "crawfish", "firefly", "lightning bug",
];

export const WAVE_COLORS = {
  south: "var(--south)",
  midwest: "var(--midwest)",
  northeast: "var(--northeast)",
  west: "var(--west)",
};

export const CLOUD_FILLER = [
  { text: "dialect", trend: 0.12 },
  { text: "regional", trend: 0.11 },
  { text: "accent", trend: 0.1 },
];

export const MAX_CLOUD_WORDS = 72;
