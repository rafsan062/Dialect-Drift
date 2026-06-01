import os
import json
import re
import time
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(override=True)
raw_key = os.getenv("OPENAI_API_KEY")
api_key = raw_key.strip().strip('"').strip("'") if raw_key else None

client = OpenAI(
    api_key=api_key,
    base_url="https://api.openai.com/v1"
)

OUTPUT_DIR = "public/audio"
os.makedirs(OUTPUT_DIR, exist_ok=True)

with open("data/processed/words.json", "r") as f:
    data = json.load(f)

print(f"Loaded {len(data)} words to process.")

PHONETIC_OVERRIDES = {
    "boulevard": "bool-uh-vard",
    "crawfish": "craw-fish",
    "praline": "praw-leen",
    "tp'ing": "tee peeing"
}

def generate_audio(word):
    tts_input = PHONETIC_OVERRIDES.get(word.lower(), word)
    for attempt in range(3):
        try:
            response = client.audio.speech.create(
                model="tts-1",
                voice="onyx",  # Standard, clear American voice
                input=f", {tts_input}.", # Commas add a tiny micro-pause to prevent clipping
                speed=0.85,         # Speaking slightly slower prevents it from slurring 2 words into 1
                response_format="mp3"
            )
            # tts-1 does not return a transcript or b64, it just returns raw bytes
            return response.content
        except Exception as e:
            print(f"Error generating {word}: {e}")
            time.sleep(1)
            
    return None

for i, (word, info) in enumerate(data.items()):
    sanitized_word = re.sub(r'[^a-zA-Z0-9]', '_', word)
    output_filename = os.path.join(OUTPUT_DIR, f"{sanitized_word}.mp3")
    
    if os.path.exists(output_filename):
        print(f"Skipping {word} - already exists")
        continue

    print(f"[{i+1}/{len(data)}] Generating audio for '{word}'...")
    
    audio_bytes = generate_audio(word)
    if audio_bytes:
        with open(output_filename, "wb") as f:
            f.write(audio_bytes)
        
    # The tts-1 endpoint is much faster and has higher rate limits, 
    # but a small sleep is still polite.
    time.sleep(0.1)

print("All done!")
