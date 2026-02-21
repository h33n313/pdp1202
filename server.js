import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // IMPORTANT: For Easypanel/Docker persistence, we use a dedicated data folder
  const DATA_DIR = path.join(__dirname, 'data');
  const DB_FILE = path.join(DATA_DIR, 'hassan_data_base.json');

  // Middleware
  app.use(cors());
  app.use(bodyParser.json({ limit: '50mb' })); 

  // --- IN-MEMORY DATABASE CACHE ---
  let db = {
    pdps: [],
    users: []
  };

  // Initialize DB
  const initDB = () => {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(DB_FILE)) {
      // We need to import MOCK_USERS here or define them. 
      // Since this is server-side and MOCK_USERS are in a TS file, 
      // it's better to just define the initial state if needed or let the client handle it.
      // However, the user wants them to persist.
      const initialData = { pdps: [], users: [] };
      fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
      db = initialData;
    } else {
      try {
        const data = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          db = { pdps: parsed, users: [] };
        } else {
          db = parsed;
        }
        console.log(`✅ Database loaded: ${db.pdps.length} PDPs, ${db.users.length} Users.`);
      } catch (error) {
        console.error("❌ Error reading DB file, resetting cache:", error);
        db = { pdps: [], users: [] };
      }
    }
  };

  let writeTimeout = null;
  const saveToDisk = () => {
    if (writeTimeout) clearTimeout(writeTimeout);
    writeTimeout = setTimeout(() => {
        fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), 'utf-8', (err) => {
          if (err) console.error("❌ Error writing to disk:", err);
        });
    }, 1000);
  };

  initDB();

  // --- API ROUTES ---
  app.get('/api/pdps', (req, res) => {
    res.json(db.pdps);
  });

  app.post('/api/pdps', (req, res) => {
    const newPDP = req.body;
    const index = db.pdps.findIndex(p => p.id === newPDP.id);
    if (index >= 0) {
      db.pdps[index] = newPDP;
    } else {
      db.pdps.push(newPDP);
    }
    res.json({ success: true, message: 'Saved successfully' });
    saveToDisk();
  });

  app.put('/api/pdps/:id', (req, res) => {
    const { id } = req.params;
    const updatedFields = req.body;
    const index = db.pdps.findIndex(p => p.id === id);
    if (index >= 0) {
      db.pdps[index] = { ...db.pdps[index], ...updatedFields };
      res.json({ success: true });
      saveToDisk();
    } else {
      res.status(404).json({ error: 'PDP not found' });
    }
  });

  app.delete('/api/pdps/:id', (req, res) => {
    const { id } = req.params;
    const initialLength = db.pdps.length;
    db.pdps = db.pdps.filter(p => p.id !== id);
    if (db.pdps.length !== initialLength) {
        res.json({ success: true });
        saveToDisk();
    } else {
        res.status(404).json({ error: 'Not found' });
    }
  });

  app.get('/api/users', (req, res) => {
    res.json(db.users);
  });

  app.post('/api/users', (req, res) => {
    const newUser = req.body;
    const index = db.users.findIndex(u => u.id === newUser.id);
    if (index >= 0) {
      db.users[index] = newUser;
    } else {
      db.users.push(newUser);
    }
    res.json({ success: true });
    saveToDisk();
  });

  app.delete('/api/users/:id', (req, res) => {
    const { id } = req.params;
    db.users = db.users.filter(u => u.id !== id);
    res.json({ success: true });
    saveToDisk();
  });

  app.post('/api/restore', (req, res) => {
    const newData = req.body;
    if (newData && typeof newData === 'object') {
      if (Array.isArray(newData)) {
        db.pdps = newData;
      } else {
        db = { ...db, ...newData };
      }
      saveToDisk();
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Invalid data format' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
  });
}

startServer();
