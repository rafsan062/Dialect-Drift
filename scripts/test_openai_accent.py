import os
import base64
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(override=True)
raw_key = os.getenv("OPENAI_API_KEY")
api_key = raw_key.strip().strip('"').strip("'") if raw_key else None

client = OpenAI(
    api_key=api_key,
    base_url="https://api.openai.com/v1"
)

word_to_test = "caramel"
accent = "Southern US"

print(f"Asking GPT-4o-Audio to say '{word_to_test}' with a {accent} accent...")

try:
    response = client.chat.completions.create(
        model="gpt-audio",
        modalities=["text", "audio"],
        audio={"voice": "onyx", "format": "mp3"},
        messages=[
            {
                "role": "system",
                "content": f"You are a native speaker from the {accent}. Speak with a distinct, thick regional accent."
            },
            {
                "role": "user",
                "content": f"Please say only this word, exactly as it is pronounced in your region, and nothing else: {word_to_test}"
            }
        ]
    )

    # The audio data comes back as a base64 encoded string
    audio_b64 = response.choices[0].message.audio.data
    
    output_filename = f"{word_to_test}_southern_accent.mp3"
    with open(output_filename, "wb") as f:
        f.write(base64.b64decode(audio_b64))

    print(f"Success! Saved to {output_filename}")

except Exception as e:
    print(f"An error occurred: {e}")
