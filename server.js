// Import necessary modules
const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const ejs = require('ejs'); // Import the EJS view engine

const app = express();
const port = 3000;

app.use(express.json());

// MySQL connection configuration
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'Joseph12!',
  database: 'your_mysql_database',
});

// Connect to MySQL
db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
  } else {
    console.log('Connected to MySQL database');
  }
});

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve HTML files and static assets
app.use(express.static('public'));

// Home page route
app.get('/', (req, res) => {
  // Render the 'home' template
  res.render('home');
});

// Create appointment page route
app.get('/create', (req, res) => {
  // Render the 'create' template
  res.render('create');
});

// Customer profiles page route
app.get('/customer-profiles', (req, res) => {
  // Render the 'customer-profile' template
  res.render('customer-profiles');
});

// Fetch all appointments from the database
app.get('/appointments', (req, res) => {
  db.query('SELECT * FROM appointments', (err, results) => {
    if (err) {
      console.error('Error executing MySQL query:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    } else {
      // Render the 'appointments' template with fetched data
      res.render('appointments', { appointments: results });
    }
  });
});

// Handle the creation of a new appointment
app.post('/create', (req, res) => {
  console.log('Received request to create appointment:', req.body);

  const { title, date } = req.body;

  // Insert new appointment into MySQL
  db.query('INSERT INTO appointments (title, date) VALUES (?, ?)', [title, date], (err, results) => {
    if (err) {
      console.error('Error executing MySQL query:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    } else {
      const newAppointment = { id: results.insertId, title, date };
      res.json(newAppointment);
    }
  });
});
// Server-side code for canceling an appointment
app.post('/cancel-appointment/:id', (req, res) => {
  const appointmentId = req.params.id;

  // Implement the logic to cancel the appointment (e.g., update the database)
  db.query('DELETE FROM appointments WHERE id = ?', [appointmentId], (err, result) => {
    if (err) {
      console.error('Error canceling appointment:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    } else {
      res.json({ message: 'Appointment canceled successfully' });
    }
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});


