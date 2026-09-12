# 📄 DocuMind

A Retrieval-Augmented Generation (RAG) assistant that answers questions grounded in your own documents. Upload a PDF, and DocuMind splits it into searchable chunks, embeds them using Google's Gemini embedding model, and answers your questions using only the relevant parts of that document — with source citations so you can verify every answer.

**Live Demo:** [https://documind-oa92.onrender.com/](https://documind-oa92.onrender.com/)

---

## Features

- **PDF upload & parsing** — extracts text content from any uploaded PDF
- **Semantic chunking** — splits documents into overlapping ~500-word chunks to preserve context across boundaries
- **Vector embeddings** — generates a Gemini embedding for every chunk, representing its meaning as a vector
- **Retrieval-Augmented Generation (RAG)** — finds the most relevant chunks for a question using cosine similarity, then feeds only that context to the LLM
- **Grounded answers** — the model is instructed to answer only from the provided context, and explicitly says "I don't know" rather than hallucinating when the answer isn't present
- **Source citations** — every answer shows the exact excerpts and match percentages it was based on, for transparency and trust
- **Multi-document support** — upload multiple PDFs and switch between them via a document selector
- **Graceful rate-limit handling** — clear user-facing messaging when the free-tier API quota is hit, instead of a raw error

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express |
| AI / Embeddings | Google Gemini API (`@google/genai`) — `gemini-embedding-001` for embeddings, `gemini-3.6-flash` for answer generation |
| PDF Parsing | pdf-parse |
| Database | MongoDB (via Mongoose) — stores chunks and their embeddings |
| Frontend | HTML, CSS, vanilla JavaScript |

---

## How It Works (RAG Pipeline)

1. **Upload**: a PDF is uploaded and its text extracted via `pdf-parse`.
2. **Chunking**: the text is split into overlapping ~500-word chunks so that facts near chunk boundaries aren't lost.
3. **Embedding**: each chunk is sent to Gemini's embedding model, producing a high-dimensional vector representing its meaning. Chunks and their embeddings are stored in MongoDB.
4. **Retrieval**: when a question is asked, it's embedded the same way, and compared against every stored chunk's embedding using cosine similarity.
5. **Augmentation**: the top 3 most relevant chunks are selected and inserted into a prompt as context.
6. **Generation**: Gemini generates an answer using *only* that context, explicitly declining to answer if the information isn't present — preventing hallucination.
7. **Citation**: the exact source excerpts and their similarity scores are returned alongside the answer, so the user can verify it.

---

## Running Locally

1. **Clone the repo**
   ```bash
   git clone https://github.com/abhijeetsangal/DocuMind.git
   cd DocuMind
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env` file in the project root:
   ```
   GEMINI_API_KEY=your_gemini_api_key
   MONGODB_URI=your_mongodb_connection_string
   ```

4. **Start the server**
   ```bash
   node server.js
   ```

5. Open your browser to `http://localhost:3000`

---

## Project Structure

```
├── models/
│   └── Chunk.js          # Mongoose schema for document chunks + embeddings
├── public/
│   └── index.html         # Frontend UI, styles, and client-side logic
├── server.js               # Express server, RAG pipeline, and API routes
├── package.json
└── .gitignore
```

---

## Design Note: Strict Grounding

DocuMind is intentionally conservative — it will not answer questions that require reasoning across the whole document (e.g., "which day is busiest") if that comparison isn't explicitly stated in the text, nor will it solve problems that aren't factually present in the source (e.g., assignment questions without included answers). This is a deliberate trade-off: strict grounding sacrifices some flexibility in exchange for trustworthy, verifiable answers — a core principle in production RAG systems.

---

## Author

**Abhijeet Sangal**
[GitHub](https://github.com/abhijeetsangal) · [LinkedIn](https://www.linkedin.com/in/abhijeetsangal)
