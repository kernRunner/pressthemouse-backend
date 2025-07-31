const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');



const app = express();
const db = new sqlite3.Database('./scores.db');

// Middleware
app.use(cors());
app.use(express.json());

// Create table if it doesn't exist
db.run(`
  CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    score INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

const SHARED_SECRET = "p9VtFz!x32#l";
const crypto = require("crypto");

function generateExpectedHash(score) {
    return crypto
        .createHash("sha256")
        .update(`${score}:${SHARED_SECRET}`)
        .digest("hex");
}

app.post("/score", express.json(), (req, res) => {
    const { name, score, hash } = req.body;

    if (
        typeof name !== 'string' ||
        typeof score !== 'number' ||
        score <= 0 ||
        score > 10000000 || // limit max score
        name.length < 1 ||
        name.length > 20 || // prevent long names
        /[^a-zA-Z0-9 _-]/.test(name) // allow only safe characters
    ) {
        return res.status(400).json({ error: 'Invalid name or score' });
    }

    const expected = generateExpectedHash(score);

    if (!hash || hash !== expected) {
        console.warn(`Rejected score submission. Name: ${name}, Score: ${score}, Hash: ${hash}`);
        return res.status(403).json({ error: "Invalid or missing score signature." });
    }

    db.run(
        'INSERT INTO scores (name, score) VALUES (?, ?)',
        [name, score],
        function (err) {
            if (err) return res.status(500).json({ error: 'DB error' });
            res.json({ success: true, id: this.lastID });
        }
    );
});


// GET /leaderboard → Top 10
app.get('/leaderboard', (req, res) => {
    db.all('SELECT name, score FROM scores ORDER BY score DESC LIMIT 10', (err, rows) => {
        if (err) return res.status(500).json({ error: 'DB error' });
        res.json(rows);
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
