import os
from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs

# Load environment variables from .env file
load_dotenv()

# Get API key
api_key = os.getenv("ELEVENLABS_API_KEY")

if not api_key:
    print("ERROR: ELEVENLABS_API_KEY not found in .env file!")
    print("Please add it to your .env file like this:")
    print("ELEVENLABS_API_KEY=your_key_here")
    exit(1)

# Initialize the client with your API key
client = ElevenLabs(api_key=api_key)

word_to_test = "Caramel"
# Use Rachel's Voice ID
voice_id = "21m00Tcm4TlvDq8ikWAM" 

print(f"Generating audio for '{word_to_test}'...")

try:
    # Generate the audio using the new v2+ SDK syntax
    audio_generator = client.text_to_speech.convert(
        text=word_to_test,
        voice_id=voice_id,
        model_id="eleven_multilingual_v2",
        output_format="mp3_44100_128"
    )

    # The convert function returns a generator of bytes. 
    audio_bytes = b"".join(audio_generator)

    # Save it to an MP3 file
    output_filename = f"{word_to_test}_pronunciation.mp3"
    with open(output_filename, "wb") as f:
        f.write(audio_bytes)

    print(f"Success! Saved audio to {output_filename}")
    print("You can play this file to hear the pronunciation.")

except Exception as e:
    print(f"An error occurred: {e}")
