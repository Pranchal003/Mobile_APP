import os
import sys
import json
import uuid
import subprocess
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from pydub import AudioSegment
import logging
from pydub.utils import which

# --- Configuration ---
app = Flask(__name__)
CORS(app)  # This will enable CORS for all routes

AUDIO_DIR = "audio_notifications"
UPLOADS_DIR = "uploads"
DB_FILE = "notifications.json"

# Ensure directories exist
os.makedirs(AUDIO_DIR, exist_ok=True)
os.makedirs(UPLOADS_DIR, exist_ok=True)

# --- Database Helper Functions ---
def read_db():
    if not os.path.exists(DB_FILE):
        return []
    with open(DB_FILE, "r") as f:
        return json.load(f)

def write_db(data):
    with open(DB_FILE, "w") as f:
        json.dump(data, f, indent=4)

# --- Helper Functions ---
def generate_audio(text: str):
    """Generates audio from text and returns the filename."""
    try:
        from gtts import gTTS
        filename = f"{uuid.uuid4()}.mp3"
        filepath = os.path.join(AUDIO_DIR, filename)
        tts = gTTS(text, lang='en')
        tts.save(filepath)
        return filename
    except Exception as e:
        print(f"Audio generation failed: {e}")
        return None

def run_selenium_script(description: str, agent: str):
    """
    Runs the main.py selenium script by writing the description
    to the my_report.txt file that the script reads.
    """
    # Overwrite the report file with the new description
    with open("my_report.txt", "w") as f:
        f.write(f"description={description}\n")
        f.write(f"agent={agent}\n") # Add other fields as needed
        f.write(f"task=Automated report from {agent}\n")

    try:
        # The main.py script reads my_report.txt directly, so we just run it
        main_py_path = os.path.join(os.path.dirname(__file__), 'main.py')
        result = subprocess.run(
            [sys.executable, main_py_path], # No need for --report-file argument
            capture_output=True, text=True, timeout=300, check=False
        )
        if result.returncode == 0:
            return {"success": True, "message": "Selenium script completed.", "output": result.stdout}
        else:
            return {"success": False, "message": "Selenium script failed.", "error": result.stderr}
    except Exception as e:
        return {"success": False, "message": f"An exception occurred: {e}"}

def run_transcription(file_path: str) -> dict:
    """Runs the transcription script and returns the result."""
    try:
        transcribe_py_path = os.path.join(os.path.dirname(__file__), 'transcribe.py')
        result = subprocess.run(
            [sys.executable, transcribe_py_path, file_path],
            capture_output=True, text=True, timeout=60, check=True
        )
        return {"success": True, "text": result.stdout.strip()}
    except subprocess.CalledProcessError as e:
        return {"success": False, "error": f"Transcription failed: {e.stderr}"}
    except Exception as e:
        return {"success": False, "error": f"An unexpected error occurred during transcription: {e}"}

# --- API Endpoints ---

@app.route('/')
def index():
    return jsonify({"status": "ok", "message": "Backend is running!"})

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    if not file:
        return jsonify({"error": "File not provided"}), 400

    temp_filename = f"temp_{uuid.uuid4()}"
    temp_filepath = os.path.join(UPLOADS_DIR, temp_filename)
    
    try:
        file.save(temp_filepath)

        # --- Convert to WAV ---
        audio = AudioSegment.from_file(temp_filepath)
        wav_filename = f"audio-{int(datetime.now().timestamp() * 1000)}.wav"
        wav_filepath = os.path.join(UPLOADS_DIR, wav_filename)
        audio.export(wav_filepath, format="wav")

        # After converting, run transcription on the new WAV file
        transcription_result = run_transcription(wav_filepath)
        
        # Include transcription text in the response
        if transcription_result["success"]:
            transcribed_text = transcription_result["text"]
            
            # Run the selenium script with the transcribed text
            # NOTE: The agent is hardcoded here as "Voice Input"
            selenium_result = run_selenium_script(transcribed_text, "Voice Input")

            if not selenium_result["success"]:
                # If the selenium script fails, return an error but still with the transcription
                return jsonify({
                    "message": "Transcription successful, but processing failed.",
                    "transcribed_text": transcribed_text,
                    "error_details": selenium_result["error"]
                }), 500

            # Create and Save Notification
            notification = {
                "id": str(uuid.uuid4()),
                "type": "Report via Voice Input",
                "summary": transcribed_text[:100],  # Truncate summary
                "audio_filename": None, # No audio confirmation for this flow yet
                "timestamp": datetime.utcnow().isoformat(),
                "is_read": False,
                "is_archived": False,
            }
            notifications = read_db()
            notifications.insert(0, notification)
            write_db(notifications)

            return jsonify({
                "message": "File uploaded, transcribed, and processed successfully",
                "filename": wav_filename,
                "transcribed_text": transcribed_text
            }), 200
        else:
            # Still send a 200 but indicate transcription failure
            return jsonify({
                "message": "File uploaded, but transcription failed.",
                "filename": wav_filename,
                "transcribed_text": "",
                "error_details": transcription_result["error"]
            }), 200

    except FileNotFoundError:
        # This block will catch the ffmpeg/ffprobe error
        logging.error("ffmpeg or ffprobe not found. Please install ffmpeg and add it to your system's PATH.")
        return jsonify({
            "error": "Server-side configuration error.",
            "details": "ffmpeg is not installed or not found in system's PATH. Please check server logs."
        }), 500
    except Exception as e:
        logging.error(f"An error occurred: {e}")
        return jsonify({"error": "An internal server error occurred.", "details": str(e)}), 500
    finally:
        # --- Cleanup ---
        try:
            if os.path.exists(temp_filepath):
                os.remove(temp_filepath)
        except Exception as e:
            logging.error(f"Error removing temp file {temp_filepath}: {e}")

@app.route('/submit_report', methods=['POST'])
def submit_report():
    data = request.get_json()
    description = data.get('description')
    agent = data.get('agent')

    if not description or not agent:
        return jsonify({"error": "Description and agent are required."}), 400

    # 1. Run Selenium Script
    selenium_result = run_selenium_script(description, agent)
    if not selenium_result["success"]:
        return jsonify(selenium_result), 500

    # 2. Generate Audio
    audio_text = "Report is submitted successfully."
    audio_filename = generate_audio(audio_text)
    if not audio_filename:
        return jsonify({"error": "Failed to generate audio notification."}), 500

    # 3. Create and Save Notification
    notification = {
        "id": str(uuid.uuid4()),
        "type": f"Report via {agent}",
        "summary": description[:100],  # Truncate summary
        "audio_filename": audio_filename,
        "timestamp": datetime.utcnow().isoformat(),
        "is_read": False,
        "is_archived": False,
    }
    
    notifications = read_db()
    notifications.insert(0, notification)
    write_db(notifications)
    
    return jsonify(notification), 201

@app.route('/notifications', methods=['GET'])
def get_notifications():
    return jsonify(read_db())

@app.route('/notifications/<notification_id>', methods=['PUT'])
def update_notification(notification_id):
    updates = request.get_json()
    notifications = read_db()
    
    target_notification = next((n for n in notifications if n['id'] == notification_id), None)
    if not target_notification:
        return jsonify({"error": "Notification not found."}), 404
        
    if 'is_read' in updates:
        target_notification['is_read'] = updates['is_read']
    if 'is_archived' in updates:
        target_notification['is_archived'] = updates['is_archived']
        
    write_db(notifications)
    return jsonify(target_notification)

@app.route('/notifications/<notification_id>', methods=['DELETE'])
def delete_notification(notification_id):
    notifications = read_db()
    notification_to_delete = next((n for n in notifications if n['id'] == notification_id), None)

    if not notification_to_delete:
        return jsonify({"error": "Notification not found."}), 404

    # Delete audio file
    audio_path = os.path.join(AUDIO_DIR, notification_to_delete['audio_filename'])
    if os.path.exists(audio_path):
        os.remove(audio_path)

    new_notifications = [n for n in notifications if n['id'] != notification_id]
    write_db(new_notifications)
    
    return '', 204

@app.route('/notifications/delete_all', methods=['POST'])
def delete_all_notifications():
    notifications = read_db()
    for notification in notifications:
        audio_path = os.path.join(AUDIO_DIR, notification['audio_filename'])
        if os.path.exists(audio_path):
            os.remove(audio_path)
    write_db([]) # Write an empty list
    return '', 204

@app.route('/audio/<filename>', methods=['GET'])
def get_audio(filename):
    return send_from_directory(AUDIO_DIR, filename)

if __name__ == '__main__':
    # Moved this check here so it only runs once on startup
    print(f"Checking for ffmpeg... Found at: {which('ffmpeg')}")
    app.run(host='0.0.0.0', port=5001, debug=True) 