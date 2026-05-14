const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const { exec } = require('child_process');
const fs = require('fs');
const mysql = require('mysql2');

const app = express();
const PORT = 5050;

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

// ✅ Middleware
app.use(cors({
  origin: [
    'http://localhost:19006',
    'http://localhost:8081',
    'http://localhost:3000',
    'http://localhost:8082'
  ],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Accept'],
  credentials: true
}));
app.use(express.json());

// ✅ MySQL Connection
const db = mysql.createPool({
  host: '88.150.227.117',
  user: 'nrktrn_web_admin',
  password: 'GOeg&*$*657',
  port: 3306,
  database: 'nrkindex_trn',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

db.getConnection((err, connection) => {
  if (err) {
    console.error('❌ MySQL Connection Error:', err);
    console.error('Continuing without database connection...');
  } else {
    console.log('✅ Connected to MySQL Server Database');
    connection.release();
  }
});

// ✅ Upload and Output folders
const uploadDir = path.join(__dirname, 'uploads');
const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

// ✅ Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log('📁 Multer destination called for file:', file.originalname);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname) || '.m4a';
    const filename = `audio-${timestamp}${ext}`;
    console.log('📁 Multer filename generated:', filename);
    cb(null, filename);
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    console.log('🔍 Multer fileFilter called for:', file);
    console.log('🔍 File fieldname:', file.fieldname);
    console.log('🔍 File originalname:', file.originalname);
    console.log('🔍 File mimetype:', file.mimetype);
    
    // Accept any audio file
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      console.log('❌ File type not accepted:', file.mimetype);
      cb(new Error('Only audio files are allowed'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// ✅ Convert to WAV
function convertToWav(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .toFormat('wav')
      .on('error', reject)
      .on('end', () => resolve(outputPath))
      .save(outputPath);
  });
}

// ✅ Reusable Insert Function
function insertTranscriptionToDB(text, agent, column = 'COLUMN_Y', res) {
  const query = `
    INSERT INTO AIA_VOICETOTEXTDATA (USERID, FIRMID, TEXT_DATA, TARGET_AGENT, TARGET_COLUMN)
    VALUES (?, ?, ?, ?, ?)
  `;
  const values = [1254, 5, text, agent, column];

  db.getConnection((err, connection) => {
    if (err) {

      console.error('❌ DB Connection Error:', err);
      return res.status(500).json({ error: '❌ Database Connection Failed' });
    }
    
    connection.query(query, values, (err, result) => {
      // Always release the connection back to the pool
      connection.release();
      
      if (err) {
        console.error('❌ DB Insert Error:', err);
        return res.status(500).json({ error: '❌ Database Insert Failed' });
      }
      console.log('✅ Insert into Database, ID:', result.insertId);
      res.json({ insertId: result.insertId, transcription: text });
    });
  });
}

// ✅ Upload & Transcribe Endpoint
app.post('/upload', upload.single('audio'), async (req, res) => {
  console.log('📥 Received upload request');
  console.log('📥 Request headers:', req.headers);
  console.log('📥 Request body keys:', Object.keys(req.body));
  console.log('📥 Request file:', req.file);
  console.log('📥 Request files:', req.files);

  if (!req.file) {
    console.error('❌ No file in request');
    console.error('❌ Request body:', req.body);
    console.error('❌ Request headers content-type:', req.headers['content-type']);
    
    // Check if the request body contains file data but multer didn't process it
    if (req.body && req.body.audio) {
      console.error('❌ File data found in body but not processed by multer');
      return res.status(400).json({ 
        error: '❌ File upload failed - file data not properly formatted',
        details: 'The file was sent but could not be processed. This usually happens when testing on web platform with a file URI instead of a real file object.'
      });
    }
    
    return res.status(400).json({ error: '❌ No Audio File Uploaded' });
  }

  console.log('✅ File received successfully:', req.file);

  const originalPath = req.file.path;
  const wavPath = originalPath.replace(path.extname(originalPath), '.wav');

  console.log('📁 Original file path:', originalPath);
  console.log('📁 WAV file path:', wavPath);

  try {
    // Check if original file exists
    if (!fs.existsSync(originalPath)) {
      console.error('❌ Original file does not exist:', originalPath);
      return res.status(500).json({ error: '❌ Uploaded file not found' });
    }

    console.log('🔄 Starting audio conversion...');
    await convertToWav(originalPath, wavPath);
    console.log('✅ Converted to WAV');

    // Check if WAV file was created
    if (!fs.existsSync(wavPath)) {
      console.error('❌ WAV file was not created:', wavPath);
      return res.status(500).json({ error: '❌ Audio conversion failed - WAV file not created' });
    }

    // Run transcription and return the text to the app.
    exec(`python transcribe.py "${wavPath}"`, { encoding: 'utf8' }, (err, stdout, stderr) => {
      // Always cleanup files, regardless of transcription outcome
        try {
          if (fs.existsSync(originalPath)) fs.unlinkSync(originalPath);
          if (fs.existsSync(wavPath)) fs.unlinkSync(wavPath);
        } catch (e) {
          console.error('Error cleaning up files:', e);
        }
      
      if (err) {
        console.error('❌ Transcription Error:', stderr);
        return res.status(500).json({ error: 'Transcription failed', details: stderr });
      }

      const transcription = stdout.trim();
      console.log('✅ Transcription successful:', transcription);

      // Send the transcription result back to the app
      res.json({
        success: true,
        message: 'File uploaded and transcribed successfully.',
        transcription: transcription
      });
    });

  } catch (err) {
    console.error('❌ Audio Conversion/Processing Error:', err);
    console.error('❌ Error stack:', err.stack);
    
    // Cleanup original file on error
    try {
      if (fs.existsSync(originalPath)) {
        fs.unlinkSync(originalPath);
        console.log('🗑️ Cleaned up original file after error');
      }
    } catch (e) {
      console.error('Error cleaning up file after error:', e);
    }
    
    res.status(500).json({ 
      error: '❌ Audio Conversion Failed',
      details: err.message,
      originalFile: req.file.originalname
    });
  }
});

// ✅ Multer Error Handler
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    console.error('❌ Multer Error:', error);
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: '❌ File too large. Maximum size is 10MB.' });
    }
    return res.status(400).json({ error: `❌ File upload error: ${error.message}` });
  }
  next(error);
});

// ✅ Manual Insert (Text to DB)
app.post('/insert', (req, res) => {
  const { text_data, target_agent } = req.body;

  if (!text_data || !target_agent) {
    return res.status(400).json({ error: '❌ Missing text_data or target_agent' });
  }

  insertTranscriptionToDB(text_data, target_agent, 'COLUMN_Y', res);
});

app.post('/run-automation', (req, res) => {
  const { text_data, target_agent } = req.body;

  if (!text_data) {
    return res.status(400).json({ error: 'Missing text_data for automation' });
  }
  
  // Clean the input: take the last non-empty line of the transcription
  const cleaned_text = text_data.trim().split('\n').filter(line => line.trim() !== '').pop() || '';

  if (!cleaned_text) {
    return res.status(400).json({ error: 'Cleaned text data is empty after processing.' });
  }
  
  const scriptName = 'main.py';

  // We will change the directory to the selenium folder before running the script
  const command = `python ${scriptName} "${cleaned_text}"`;

  console.log(`🤖 Executing command: ${command}`);

  exec(command, { encoding: 'utf8' }, (err, stdout, stderr) => {
    if (err) {
      console.error('❌ Selenium Script Error:', stderr);
      return res.status(500).json({ error: 'Failed to run automation', details: stderr });
    }

    const result = stdout.trim();
    console.log('✅ Selenium Script Result:', result);

    res.json({ success: true, output: result });
  });
});

// ✅ Text-to-Speech Endpoint (requires agent.py to support this mode)
app.post('/api/speak', (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).send('❌ Missing text');

  const filename = `voice_${Date.now()}.mp3`;
  const outputPath = path.join(outputDir, filename);

  exec(`python agent.py "${text}" "${outputPath}"`, (err) => {
    if (err) {
      console.error('❌ TTS Error:', err.message);
      return res.status(500).send('❌ Error generating audio');
    }

    res.sendFile(outputPath, () => {
      fs.unlink(outputPath, () => {}); // Cleanup
    });
  });
});

// ✅ Health Check Endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ✅ Global Error Handler
app.use((err, req, res, next) => {
  console.error('🔥 Global Error Handler:', err);
  console.error('🔥 Error stack:', err.stack);
  
  // Ensure we send JSON response
  res.status(500).json({
    error: '❌ Internal Server Error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// ✅ 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: '❌ Endpoint Not Found',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// ✅ Start Server
app.listen(PORT, 'localhost', () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

app.get('/', (req, res) => {
  res.send('Backend server is running!');
});
