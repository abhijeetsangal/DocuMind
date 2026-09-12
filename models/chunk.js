const mongoose = require('mongoose');

const chunkSchema = new mongoose.Schema({
    documentName: {
        type: String,
        required: true
    },
    text: {
        type: String,
        required: true
    },
    embedding: {
        type: [Number],
        default: []
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Chunk', chunkSchema);