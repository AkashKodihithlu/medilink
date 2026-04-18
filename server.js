const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config();

const session = require('express-session');
const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ───────────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(session({
  secret: 'medilink_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'frontend')));

// ── Database connection pool ────────────────────────────────────
// Using the medilink user we created earlier
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
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

    req.session.user = {
      name: `${user.first_name} ${user.last_name}`,
      email: user.email,
      role: user.role
    };

    res.json({
      message: 'Login successful',
      name: `${user.first_name} ${user.last_name}`,
      email: user.email,
      role: user.role
    });

  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Database error during login' });
  }
});

// ── LOGOUT ──────────────────────────────────────────────────────
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ message: 'Logged out' });
});

// ── CHECK SESSION ───────────────────────────────────────────────
app.get('/api/me', (req, res) => {
  if (req.session.user) return res.json({ loggedIn: true, ...req.session.user });
  res.status(401).json({ loggedIn: false });
});

app.get('/api/patients', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM patients ORDER BY created_at DESC');
  res.json(rows);
});

app.post('/api/patients', async (req, res) => {
  const { patient_id, name, age, location, condition_desc, urgency, consult_type, specialization_needed } = req.body;
  await pool.query(
    'INSERT INTO patients VALUES (?, ?, ?, ?, ?, ?, ?, ?, "pending", NOW())',
    [patient_id, name, age, location, condition_desc, urgency, consult_type, specialization_needed]
  );
  res.status(201).json({ message: 'Patient added' });
});

app.delete('/api/patients/:id', async (req, res) => {
  await pool.query('DELETE FROM patients WHERE patient_id = ?', [req.params.id]);
  res.json({ message: 'Deleted' });
});

app.get('/api/doctors', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM doctors ORDER BY created_at DESC');
  res.json(rows);
});


app.post('/api/doctors', async (req, res) => {
  const { doctor_id, name, specialization, location, experience_years, telemedicine_enabled, gender } = req.body;
  await pool.query(
    'INSERT INTO doctors (doctor_id, name, specialization, location, experience_years, telemedicine_enabled, gender) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [doctor_id, name, specialization, location, experience_years, telemedicine_enabled, gender]
  );
  res.status(201).json({ message: 'Doctor added' });
});


app.delete('/api/doctors/:id', async (req, res) => {
  await pool.query('DELETE FROM doctors WHERE doctor_id = ?', [req.params.id]);
  res.json({ message: 'Deleted' });
});


app.get('/api/allocations', async (req, res) => {
  const [rows] = await pool.query(`
    SELECT a.*, p.name AS patient_name, d.name AS doctor_name, d.specialization
    FROM allocations a
    JOIN patients p ON a.patient_id = p.patient_id
    JOIN doctors d ON a.doctor_id = d.doctor_id
    ORDER BY a.confirmed_at DESC
  `);
  res.json(rows);
});



app.post('/api/allocations', async (req, res) => {
  const { allocation_id, patient_id, doctor_id, transport_id, urgency, consult_type } = req.body;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      'INSERT INTO allocations (allocation_id, patient_id, doctor_id, transport_id, urgency, consult_type) VALUES (?, ?, ?, ?, ?, ?)',
      [allocation_id, patient_id, doctor_id, transport_id || null, urgency, consult_type]
    );
    await conn.query('UPDATE doctors SET status = "busy" WHERE doctor_id = ?', [doctor_id]);
    await conn.query('UPDATE patients SET status = "allocated" WHERE patient_id = ?', [patient_id]);
    await conn.commit();
    res.status(201).json({ message: 'Allocated' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

app.get('/api/analytics/coverage', async (req, res) => {
  const [rows] = await pool.query(`
    SELECT 
      location,
      COUNT(DISTINCT doctor_id) AS doctors,
      COUNT(DISTINCT patient_id) AS patients,
      CASE
        WHEN COUNT(DISTINCT doctor_id) = 0 THEN 'Critical'
        WHEN COUNT(DISTINCT patient_id) / COUNT(DISTINCT doctor_id) > 3 THEN 'Critical'
        WHEN COUNT(DISTINCT patient_id) / COUNT(DISTINCT doctor_id) > 2 THEN 'Moderate'
        ELSE 'Good'
      END AS severity
    FROM (
      SELECT location, NULL AS doctor_id, patient_id FROM patients
      UNION ALL
      SELECT location, doctor_id, NULL AS patient_id FROM doctors
    ) combined
    GROUP BY location
    ORDER BY doctors ASC
  `);
  res.json(rows);
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
