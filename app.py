from flask import Flask, request, jsonify, session
from flask_cors import CORS
import mysql.connector
import bcrypt

app = Flask(__name__)
app.secret_key = 'your-secret-key-change-this'
CORS(app, supports_credentials=True)

# ── Database connection ──────────────────────────────────────────
def get_db():
    return mysql.connector.connect(
        host='localhost',
        user='medilink',
        password='medilink123',
        database='medilink_db'
    )

# ── SIGNUP route ─────────────────────────────────────────────────
@app.route('/api/signup', methods=['POST'])
def signup():
    data       = request.json
    first_name = data.get('firstName', '').strip()
    last_name  = data.get('lastName', '').strip()
    email      = data.get('email', '').strip().lower()
    password   = data.get('password', '')
    role       = data.get('role', 'Field Coordinator')
    district   = data.get('district', '').strip()

    # Basic validation
    if not all([first_name, last_name, email, password]):
        return jsonify({'error': 'All fields are required'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    # Hash the password — NEVER store plain text
    hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

    try:
        db  = get_db()
        cur = db.cursor()

        # Check if email already exists
        cur.execute("SELECT user_id FROM users WHERE email = %s", (email,))
        if cur.fetchone():
            return jsonify({'error': 'An account with this email already exists'}), 409

        # Insert new user
        cur.execute("""
            INSERT INTO users (first_name, last_name, email, password, role, district)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (first_name, last_name, email, hashed.decode('utf-8'), role, district))

        db.commit()
        user_id = cur.lastrowid
        cur.close()
        db.close()

        # Start session
        session['user_id']   = user_id
        session['user_name'] = f"{first_name} {last_name}"
        session['user_email']= email

        return jsonify({'message': 'Account created', 'name': f"{first_name} {last_name}"}), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── LOGIN route ──────────────────────────────────────────────────
@app.route('/api/login', methods=['POST'])
def login():
    data     = request.json
    email    = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    try:
        db  = get_db()
        cur = db.cursor(dictionary=True)

        cur.execute("SELECT * FROM users WHERE email = %s", (email,))
        user = cur.fetchone()
        cur.close()
        db.close()

        if not user:
            return jsonify({'error': 'No account found with this email'}), 401

        # Compare entered password against the stored hash
        match = bcrypt.checkpw(
            password.encode('utf-8'),
            user['password'].encode('utf-8')
        )
        if not match:
            return jsonify({'error': 'Incorrect password'}), 401

        # Start session
        session['user_id']   = user['user_id']
        session['user_name'] = f"{user['first_name']} {user['last_name']}"
        session['user_email']= user['email']

        return jsonify({
            'message': 'Login successful',
            'name':    session['user_name'],
            'email':   session['user_email'],
            'role':    user['role']
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── LOGOUT route ─────────────────────────────────────────────────
@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Logged out'}), 200


# ── CHECK SESSION route ──────────────────────────────────────────
@app.route('/api/me', methods=['GET'])
def me():
    if 'user_id' in session:
        return jsonify({
            'loggedIn': True,
            'name':  session['user_name'],
            'email': session['user_email']
        })
    return jsonify({'loggedIn': False}), 401


if __name__ == '__main__':
    app.run(debug=True, port=5000)