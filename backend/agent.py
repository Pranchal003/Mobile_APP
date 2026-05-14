# tts.py
import sys
from gtts import gTTS

text = sys.argv[1]
output_path = sys.argv[2]

tts = gTTS(text=text, lang='en')
tts.save(output_path)
