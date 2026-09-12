require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const { PDFParse } = require('pdf-parse');
const Chunk = require('./models/Chunk');

function chunkText(text, chunkSize = 500, overlap = 50) {
    const words = text.split(/\s+/);
    const chunks = [];

    for (let i = 0; i < words.length; i += (chunkSize - overlap)) {
        const chunk = words.slice(i, i + chunkSize).join(' ');
        if (chunk.trim().length > 0) {
            chunks.push(chunk);
        }
        if (i + chunkSize >= words.length) break;
    }

    return chunks;
}

async function embedText(text) {
    const response = await ai.models.embedContent({
        model: 'gemini-embedding-001',
        contents: text,
    });
    return response.embeddings[0].values;
}

function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

const app = express();
app.use(express.json());
app.use(express.static('public'));

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB connected'))
    .catch((error) => console.error('MongoDB connection error:', error));

const upload = multer({ storage: multer.memoryStorage() });

app.post('/upload', upload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        console.log('File received:', req.file.originalname, req.file.size, 'bytes');

        const parser = new PDFParse({ data: req.file.buffer });
        const result = await parser.getText();
        const extractedText = result.text;

        console.log('Extracted text length:', extractedText.length, 'characters');

        const chunks = chunkText(extractedText);
        console.log('Split into', chunks.length, 'chunks');

        const chunksWithEmbeddings = [];
        for (const text of chunks) {
            const embedding = await embedText(text);
            chunksWithEmbeddings.push({
                documentName: req.file.originalname,
                text: text,
                embedding: embedding
            });
            console.log('Embedded a chunk, vector length:', embedding.length);
        }

        await Chunk.insertMany(chunksWithEmbeddings);

        res.json({
            filename: req.file.originalname,
            textLength: extractedText.length,
            chunkCount: chunks.length,
            embeddingDimension: chunksWithEmbeddings[0]?.embedding.length
        });

    } catch (error) {
        console.error('Error processing upload:', error);
        res.status(500).json({ error: 'Failed to process document' });
    }
});

app.post('/ask', async (req, res) => {
    try {
        const { question, documentName } = req.body;

        if (!question) {
            return res.status(400).json({ error: 'No question provided' });
        }

        const questionEmbedding = await embedText(question);

        const chunks = await Chunk.find({ documentName });

        if (chunks.length === 0) {
            return res.status(404).json({ error: 'No document found. Upload one first.' });
        }

        const scoredChunks = chunks.map(chunk => ({
            text: chunk.text,
            score: cosineSimilarity(questionEmbedding, chunk.embedding)
        }));

        scoredChunks.sort((a, b) => b.score - a.score);
        const topChunks = scoredChunks.slice(0, 3);

        console.log('Top chunk scores:', topChunks.map(c => c.score.toFixed(3)));

        const context = topChunks.map(c => c.text).join('\n\n---\n\n');

        const prompt = `Answer the question based ONLY on the following context. If the answer isn't in the context, say "I don't know based on this document."

Context:
${context}

Question: ${question}

Answer:`;

        const response = await ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: prompt,
        });

        res.json({
            answer: response.text,
            sources: topChunks.map(c => ({
                text: c.text.length > 250 ? c.text.substring(0, 250) + '...' : c.text,
                score: Math.round(c.score * 100)
            }))
        });

    } catch (error) {
        console.error('Error answering question:', error);

        if (error.status === 429) {
            return res.status(429).json({
                error: 'Rate limit reached. The free tier allows a limited number of questions per day — please try again later.'
            });
        }

        res.status(500).json({ error: 'Failed to answer question' });
    }
});

app.get('/documents', async (req, res) => {
    try {
        const documentNames = await Chunk.distinct('documentName');
        res.json({ documents: documentNames });
    } catch (error) {
        console.error('Error fetching documents:', error);
        res.status(500).json({ error: 'Failed to fetch documents' });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});