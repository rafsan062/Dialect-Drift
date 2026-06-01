import os
from dotenv import load_dotenv
from openai import OpenAI

# Load environment variables from .env file, overriding any existing ones in the terminal session
load_dotenv(override=True)

# Get API key and clean it up (removes any hidden newlines or quotes)
raw_key = os.getenv("OPENAI_API_KEY")
api_key = raw_key.strip().strip('"').strip("'") if raw_key else None

print(f"DEBUG: Using API key starting with: {str(api_key)[:8]}...")

if not api_key:
    print("ERROR: OPENAI_API_KEY not found in .env file!")
    print("Please add it to your .env file like this:")
    print("OPENAI_API_KEY=your_key_here")
    exit(1)

# Initialize the OpenAI client and explicitly set the base URL to OpenAI
# (This prevents it from accidentally sending requests to Groq!)
client = OpenAI(
    api_key=api_key,
    base_url="https://api.openai.com/v1"
)

word_to_test = "Caramel"
# OpenAI has 6 preset voices: alloy, echo, fable, onyx, nova, and shimmer
voice_name = "onyx" 

print(f"Generating audio for '{word_to_test}' using OpenAI voice '{voice_name}'...")

try:
    # Generate the audio using the TTS API
    response = client.audio.speech.create(
        model="tts-1",
        voice=voice_name,
        input=word_to_test
    )

    # Save it to an MP3 file
    output_filename = f"{word_to_test}_openai.mp3"
    response.stream_to_file(output_filename)

    print(f"Success! Saved audio to {output_filename}")
    print("You can play this file to hear the pronunciation.")

except Exception as e:
    print(f"An error occurred: {e}")
