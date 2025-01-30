const express = require('express');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const mongoose = require('mongoose');
const cors = require('cors');
const { GridFSBucket } = require('mongodb');
const authRoutes = require('./auth');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/auth', authRoutes);

cloudinary.config({
  cloud_name: 'dymacgz9c',
  api_key: '891185113691777',
  api_secret: 'jCy9txZ_WznNQZjj6yZ7-v6eRRU',
});

const fileSchema = new mongoose.Schema({
  email: String,
  public_id: String,
  mimeType: String,
  url: String
});
const File = mongoose.model('File', fileSchema);

const cloudinaryStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => ({
    folder: `uploads/${req.body.email}`,
    resource_type: 'auto',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'mp4', 'webm', 'pdf'],
  }),
});

const cloudinaryUpload = multer({ storage: cloudinaryStorage });

mongoose.connect('mongodb://localhost:27017/filesDB', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

const fileConn = mongoose.createConnection('mongodb://localhost:27017/filesDB', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

let gfs;
fileConn.once('open', () => {
  gfs = new GridFSBucket(fileConn.db, { bucketName: 'files' });
});

app.post('/upload/cloudinary', cloudinaryUpload.single('file'), async (req, res) => {
  if (!req.file || !req.body.email) {
    return res.status(400).send('No file or email provided');
  }
  const fileMetadata = {
    email: req.body.email,
    public_id: req.file.public_id,
    mimeType: req.file.mimetype,
    url: req.file.path,
  };
  try {
    await new File(fileMetadata).save();
    res.json({ url: req.file.path });
  } catch (error) {
    res.status(500).send('Error saving metadata');
  }
});

const memoryStorage = multer.memoryStorage();
const gridFsUpload = multer({ storage: memoryStorage });

app.post('/upload/gridfs', gridFsUpload.single('file'), (req, res) => {
  if (!req.file || !req.body.email) {
    return res.status(400).send('No file or email provided');
  }
  const uploadStream = gfs.openUploadStream(`${req.body.email}_${req.file.originalname}`, {
    contentType: req.file.mimetype,
  });
  uploadStream.end(req.file.buffer);
  uploadStream.on('finish', () => res.send({ message: 'File uploaded' }));
  uploadStream.on('error', err => res.status(500).send(err.message));
});

app.get('/files/cloudinary', async (req, res) => {
  try {
    const files = await File.find({ email: req.query.email });
    res.json(files);
  } catch (err) {
    res.status(500).send('Error fetching files');
  }
});

app.get('/files/gridfs', async (req, res) => {
  try {
    const files = await gfs.find({ filename: new RegExp(`^${req.query.email}_`) }).toArray();
    res.json(files.map(file => ({ id: file._id, filename: file.filename })));
  } catch (err) {
    res.status(500).send('Error retrieving files');
  }
});

app.get('/file/gridfs/:id', async (req, res) => {
  try {
    const fileId = new mongoose.Types.ObjectId(req.params.id);
    const file = await gfs.find({ _id: fileId }).toArray();
    if (!file || file.length === 0) return res.status(404).send('File not found');
    res.set({ 'Content-Type': file[0].contentType });
    const readStream = gfs.openDownloadStream(fileId);
    readStream.pipe(res);
  } catch (err) {
    res.status(500).send('Error retrieving file');
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
