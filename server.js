const express = require('express');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const mongoose = require('mongoose');
const cors = require('cors'); 
const { GridFSBucket } = require('mongodb');
const authRoutes = require('./auth');

// Initialize express app
const app = express();
app.use(cors());

// Cloudinary Configuration
cloudinary.config({
  cloud_name: 'dymacgz9c',
  api_key: '891185113691777',
  api_secret: 'jCy9txZ_WznNQZjj6yZ7-v6eRRU',  // Use your Cloudinary API credentials
});

// MongoDB Schema for storing metadata of files
const fileSchema = new mongoose.Schema({
  public_id: String,
  mimeType: String,
  url: String
});

const File = mongoose.model('File', fileSchema);

// Configure multer-storage-cloudinary with image, video, and PDF support
const cloudinaryStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'uploads',
    resource_type: 'auto', // Automatically detect the resource type (image, video, etc.)
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'mp4', 'webm', 'pdf'],
  },
});

const cloudinaryUpload = multer({ storage: cloudinaryStorage });

app.use(express.json());
app.use('/auth', authRoutes);

// MongoDB Connection for images
// MongoDB Connection for images
mongoose.connect('mongodb+srv://selvavinu2002:k5tsZGJq09Zgl4o3@googledrive.weqgy.mongodb.net/images?retryWrites=true&w=majority', {
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected for images'))
  .catch(err => console.error('MongoDB connection error for images:', err));

// MongoDB Connection for files
const mongoURI = 'mongodb+srv://selvavinu2002:k5tsZGJq09Zgl4o3@googledrive.weqgy.mongodb.net/files?retryWrites=true&w=majority';
const fileConn = mongoose.createConnection(mongoURI, { useUnifiedTopology: true });

let gfs;
fileConn.once('open', () => {
  const bucket = new GridFSBucket(fileConn.db, {
    bucketName: 'files'
  });
  gfs = bucket;
});

// Handle file upload to Cloudinary
app.post('/upload/cloudinary', cloudinaryUpload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded');
  }

  const fileMetadata = {
    public_id: req.file.public_id,
    mimeType: req.file.mimetype,
    url: req.file.path,
  };

  try {
    // Save file metadata in MongoDB
    const newFile = new File(fileMetadata);
    await newFile.save();

    res.json({ url: req.file.path });  // Respond with the Cloudinary URL
  } catch (error) {
    console.error('Error saving metadata:', error);
    res.status(500).send('Error saving metadata to database');
  }
});

// Handle file upload to GridFS
const memoryStorage = multer.memoryStorage();
const gridFsUpload = multer({ storage: memoryStorage });

app.post('/upload/gridfs', gridFsUpload.single('file'), (req, res) => {
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

// Fetch all files route from Cloudinary
app.get('/files/cloudinary', async (req, res) => {
  try {
    const files = await File.find();
    res.json(files);
  } catch (err) {
    console.error('Error fetching files:', err);
    res.status(500).send('Error fetching files');
  }
});

// Fetch all files route from GridFS
app.get('/files/gridfs', async (req, res) => {
  try {
    const files = await gfs.find().toArray();

    if (!files || files.length === 0) {
      return res.status(404).json({ message: 'No files found' });
    }

    res.json(files.map(file => ({ id: file._id, filename: file.filename })));
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving files', error: err.message });
  }
});

// Fetching file by ID from GridFS
app.get('/file/gridfs/:id', async (req, res) => {
  try {
    const fileId = new mongoose.Types.ObjectId(req.params.id);

    const file = await gfs.find({ _id: fileId }).toArray();
    
    if (!file || file.length === 0) {
      return res.status(404).json({ message: 'File not found' });
    }

    res.set({
      'Content-Type': file[0].contentType,
      'Content-Disposition': `inline; filename="${file[0].filename}"`,
    });

    const readStream = gfs.openDownloadStream(fileId);
    readStream.pipe(res);
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving file', error: err.message });
  }
});

// Server setup
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
