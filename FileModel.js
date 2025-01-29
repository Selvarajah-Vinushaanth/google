// If you want to store metadata separately, you can define a Mongoose model
const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  fileUrl: { type: String, required: true },
  fileType: { type: String, required: true },
  fileSize: { type: Number, required: true },
});

const File = mongoose.model('File', fileSchema);

module.exports = File;
