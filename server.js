const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./backend/db');
const apiRoutes = require('./backend/routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
initDatabase();

// Middleware
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// API Routes
app.use('/api', apiRoutes);

// Static frontend
app.use(express.static(path.join(__dirname, 'public')));

// Fallback to index.html for client-side navigation
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🌿 EcoTrace — City Waste Sorting & Recovery System`);
  console.log(`🚀 Server running at: http://localhost:${PORT}`);
  console.log(`==================================================\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    const ALT_PORT = 3001;
    console.log(`Port ${PORT} in use, trying ${ALT_PORT}...`);
    app.listen(ALT_PORT, () => {
      console.log(`\n🌿 EcoTrace running at: http://localhost:${ALT_PORT}\n`);
    });
  } else {
    console.error('Server error:', err);
  }
});
