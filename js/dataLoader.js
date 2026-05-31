/** Load dictionary JSON (Vite serves public/ as /data; Live Server uses public/data/). */

async function fetchJsonFirst(paths) {
  let lastStatus = 0;
  for (const url of paths) {
    const res = await fetch(url);
    if (res.ok) return res.json();
    lastStatus = res.status;
  }
  throw new Error(
    `Could not load ${paths[0]?.split("/").pop() || "data"} (${lastStatus || "network error"}). Tried: ${paths.join(", ")}`,
  );
}

function dictionaryPaths(filename) {
  const fromModule = new URL(`../public/data/${filename}`, import.meta.url).href;
  return [
    `./public/data/${filename}`,
    fromModule,
    `./data/processed/${filename}`,
    `/data/${filename}`,
  ];
}

export async function loadDictionary() {
  const words = await fetchJsonFirst(dictionaryPaths("words.json"));
  
  let stagingWords = {};
  try {
    stagingWords = await fetchJsonFirst(dictionaryPaths("words_staging.json"));
  } catch (err) {
    // Staging might not exist yet, ignore
  }

  // Merge staging into main words dict
  for (const key in stagingWords) {
    words[key] = stagingWords[key];
  }

  const regionStyles = await fetchJsonFirst(dictionaryPaths("region_styles.json"));
  return { words, regionStyles };
}
