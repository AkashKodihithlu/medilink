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

// ── EQUIPMENT ───────────────────────────────────────────────────

// GET all equipment
app.get('/api/equipment', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM equipment ORDER BY updated_at DESC'
    );
    res.json(rows);
  } catch (err) {
    console.error('Equipment fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch equipment' });
  }
});

// POST new equipment
app.post('/api/equipment', async (req, res) => {
  const { name, category, facilityName, facilityLocation, serialNumber, status, purchaseDate } = req.body;

  if (!name || !category || !facilityName || !facilityLocation || !serialNumber || !purchaseDate) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const id = 'EQ-' + Date.now();
    await pool.query(
      `INSERT INTO equipment
         (equipment_id, name, category, facility_name, facility_location,
          serial_number, status, purchase_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, category, facilityName, facilityLocation,
       serialNumber, status || 'active', purchaseDate]
    );
    const [[row]] = await pool.query(
      'SELECT * FROM equipment WHERE equipment_id = ?', [id]
    );
    res.status(201).json(row);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Serial number already exists' });
    }
    console.error('Equipment create error:', err.message);
    res.status(500).json({ error: 'Failed to create equipment' });
  }
});

// PATCH equipment status
app.patch('/api/equipment/:id/status', async (req, res) => {
  const { status } = req.body;
  const allowed = ['active', 'under-maintenance', 'decommissioned'];

  if (!allowed.includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  try {
    const [result] = await pool.query(
      'UPDATE equipment SET status = ? WHERE equipment_id = ?',
      [status, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Equipment not found' });
    }
    res.json({ message: 'Status updated' });
  } catch (err) {
    console.error('Equipment status error:', err.message);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// DELETE equipment
app.delete('/api/equipment/:id', async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM equipment WHERE equipment_id = ?', [req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Equipment not found' });
    }
    res.json({ message: 'Equipment deleted' });
  } catch (err) {
    console.error('Equipment delete error:', err.message);
    res.status(500).json({ error: 'Failed to delete equipment' });
  }
});

// ── TRANSFER REQUESTS ────────────────────────────────────────────

// POST new transfer request
app.post('/api/transfers', async (req, res) => {
  const { equipmentId, fromFacility, toFacility, reason, urgency, dateNeeded } = req.body;

  if (!equipmentId || !fromFacility || !toFacility || !reason || !urgency || !dateNeeded) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO transfer_requests
         (equipment_id, from_facility, to_facility, reason, urgency, date_needed)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [equipmentId, fromFacility, toFacility, reason, urgency, dateNeeded]
    );
    res.status(201).json({ message: 'Transfer request submitted', id: result.insertId });
  } catch (err) {
    console.error('Transfer request error:', err.message);
    res.status(500).json({ error: 'Failed to submit transfer request' });
  }
});

// ── PATIENTS (read-only for now) ─────────────────────────────────
app.get('/api/patients', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM patients ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error('Patients fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch patients' });
  }
});

// ── DOCTORS (read-only for now) ──────────────────────────────────
app.get('/api/doctors', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM doctors ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error('Doctors fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch doctors' });
  }
});

// ── ALLOCATIONS (read-only for now) ─────────────────────────────
app.get('/api/allocations', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM allocations ORDER BY confirmed_at DESC');
    res.json(rows);
  } catch (err) {
    console.error('Allocations fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch allocations' });
  }
});

// ── ANALYTICS: COVERAGE GAPS ─────────────────────────────────────
app.get('/api/analytics/coverage', async (req, res) => {
  try {
    // Fetch patients and doctors grouped by location
    const [[patients], [doctors]] = await Promise.all([
      pool.query('SELECT location, specialization_needed FROM patients'),
      pool.query('SELECT location, specialization FROM doctors'),
    ]);

    const locationMap = {};

    patients.forEach(p => {
      const loc = (p.location || '').trim();
      if (!locationMap[loc]) locationMap[loc] = { patients:0, doctors:0, specs:new Set(), neededSpecs:new Set() };
      locationMap[loc].patients++;
      locationMap[loc].neededSpecs.add(p.specialization_needed);
    });

    doctors.forEach(d => {
      const loc = (d.location || '').trim();
      if (!locationMap[loc]) locationMap[loc] = { patients:0, doctors:0, specs:new Set(), neededSpecs:new Set() };
      locationMap[loc].doctors++;
      locationMap[loc].specs.add(d.specialization);
    });

    const gaps = Object.entries(locationMap).map(([loc, data]) => {
      const ratio = data.patients === 0 ? 1 : data.doctors / data.patients;
      let severity, coverage;
      if (data.doctors === 0 && data.patients > 0) { severity = 'Critical'; coverage = 0; }
      else if (ratio < 0.3) { severity = 'Critical'; coverage = Math.round(ratio * 100); }
      else if (ratio < 0.6) { severity = 'Moderate'; coverage = Math.round(ratio * 100); }
      else if (ratio < 1)   { severity = 'Low';      coverage = Math.round(ratio * 100); }
      else                  { severity = 'Good';     coverage = 100; }

      const missingSpecs = [...data.neededSpecs].filter(s => !data.specs.has(s));
      return { loc, patients: data.patients, doctors: data.doctors, severity, coverage, missingSpecs };
    }).sort((a, b) => a.coverage - b.coverage);

    res.json(gaps);
  } catch (err) {
    console.error('Coverage analytics error:', err.message);
    res.status(500).json({ error: 'Failed to compute coverage gaps' });
  }
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
