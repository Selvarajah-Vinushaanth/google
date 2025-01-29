const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cors = require('cors'); 
const { MongoClient, GridFSBucket } = require('mongodb');
const path = require('path');

const app = express();
app.use(cors()); 

// MongoDB connection URI
const mongoURI = 'mongodb+srv://selvavinu2002:k5tsZGJq09Zgl4o3@googledrive.weqgy.mongodb.net/files?retryWrites=true&w=majority';

// Connect to MongoDB database
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });

const conn = mongoose.connection;

// Set up Multer
const storage = multer.memoryStorage();
const upload = multer({ storage });

// MongoClient setup for GridFS
let gfs;
conn.once('open', () => {
  const bucket = new GridFSBucket(conn.db, {
    bucketName: 'files'
  });
  gfs = bucket;
});

// Handle file upload
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).send({ message: 'No file uploaded' });
  }

  const { originalname, buffer, mimetype } = req.file;
  
  const uploadStream = gfs.openUploadStream(originalname, {
    contentType: mimetype,
  });

  // Pipe the file buffer to GridFS
  uploadStream.end(buffer);

  uploadStream.on('finish', () => {
    res.status(200).send({ message: 'File uploaded successfully to MongoDB!' });
  });

  uploadStream.on('error', (err) => {
    res.status(500).send({ message: 'Error uploading file', error: err.message });
  });
});
// Add a route to fetch all files from GridFS
app.get('/files', async (req, res) => {
  try {
    // Fetch the list of files stored in MongoDB
    const files = await gfs.find().toArray();

    if (!files || files.length === 0) {
      return res.status(404).json({ message: 'No files found' });
    }

    // Return the file metadata (id and filename)
    res.json(files.map(file => ({ id: file._id, filename: file.filename })));
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving files', error: err.message });
  }
});
// Fetching file by ID
app.get('/file/:id', async (req, res) => {
  try {
    const fileId = new mongoose.Types.ObjectId(req.params.id);  // Get the file ID from the request

    // Fetch the file metadata from GridFS
    const file = await gfs.find({ _id: fileId }).toArray();
    
    if (!file || file.length === 0) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Set appropriate headers for file download
    res.set({
      'Content-Type': file[0].contentType,         // Set content type dynamically based on the file type
      'Content-Disposition': `inline; filename="${file[0].filename}"`, // For inline display
    });

    // Create a stream from GridFS and pipe it into the response
    const readStream = gfs.openDownloadStream(fileId);
    readStream.pipe(res);   // Send the file as a stream to the client
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving file', error: err.message });
  }
});


// Start server
app.listen(5000, () => {
  console.log('Server running on http://localhost:5000');
});
