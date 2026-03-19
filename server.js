const express  = require('express');
const cors     = require('cors');
const mysql    = require('mysql2/promise');
const bcrypt   = require('bcryptjs');
const path     = require('path');

const app  = express();
const PORT = 5000;

// ── Middleware ───────────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'frontend')));

// ── Database connection pool ────────────────────────────────────
// Using the medilink user we created earlier
const pool = mysql.createPool({
  host:     'localhost',
  user:     'root',
  password: 'A@dish2oo6',
  database: 'medilink_db',
  waitForConnections: true,
  connectionLimit: 10,
});

// ── Auto-create tables on startup (Fallback) ────────────────────
async function initDB() {
  try {
    const conn = await pool.getConnection();
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id     INT AUTO_INCREMENT PRIMARY KEY,
        first_name  VARCHAR(50)  NOT NULL,
        last_name   VARCHAR(50)  NOT NULL,
        email       VARCHAR(100) NOT NULL UNIQUE,
        password    VARCHAR(255) NOT NULL,
        role        VARCHAR(50)  DEFAULT 'Field Coordinator',
        district    VARCHAR(100),
        created_at  DATETIME     DEFAULT NOW()
      )
    `);
    conn.release();
    console.log('✅ Connected to MySQL database (medilink_db) successfully!');
  } catch (err) {
    console.error('❌ MySQL connection failed:', err.message);
    console.error('   Please ensure MySQL is running, and the medilink user has access to medilink_db.');
  }
}

// ── SIGNUP ──────────────────────────────────────────────────────
app.post('/api/signup', async (req, res) => {
  const { firstName, lastName, email, password, role, district } = req.body;

  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    // Check if email already exists
    const [rows] = await pool.query('SELECT user_id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    // Hash password
    const hashed = await bcrypt.hash(password, 10);

    // Insert user
    const [result] = await pool.query(
      'INSERT INTO users (first_name, last_name, email, password, role, district) VALUES (?, ?, ?, ?, ?, ?)',
      [firstName.trim(), lastName.trim(), email.trim().toLowerCase(), hashed, role || 'Field Coordinator', (district || '').trim()]
    );

    res.status(201).json({
      message: 'Account created',
      name: `${firstName.trim()} ${lastName.trim()}`
    });

  } catch (err) {
    console.error('Signup error:', err.message);
    res.status(500).json({ error: 'Database error during signup' });
  }
});

// ── LOGIN ───────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);

    if (rows.length === 0) {
      return res.status(401).json({ error: 'No account found with this email' });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    res.json({
      message: 'Login successful',
      name:  `${user.first_name} ${user.last_name}`,
      email: user.email,
      role:  user.role
    });

  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Database error during login' });
  }
});

// ── LOGOUT ──────────────────────────────────────────────────────
app.post('/api/logout', (req, res) => {
  res.json({ message: 'Logged out' });
});

// ── CHECK SESSION ───────────────────────────────────────────────
app.get('/api/me', (req, res) => {
  res.status(401).json({ loggedIn: false });
});

// ── Catch-all: serve index.html for any unmatched route ─────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// ── Start ───────────────────────────────────────────────────────
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 MediLink Node.js server running at http://localhost:${PORT}`);
  });
});
