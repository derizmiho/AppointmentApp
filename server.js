// Import necessary modules
const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const ejs = require('ejs'); // Import the EJS view engine

const app = express();
const port = 3000;

app.use(express.json());

// MySQL connection configuration
const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'Joseph12!',
  database: 'test_database',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
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

async function fetchClientAndDogInfoByPhoneNumber(phoneNumber) {
  const query = `
    SELECT clients.*, dogs.*
    FROM clients
    LEFT JOIN dogs ON clients.client_id = dogs.client_id
    WHERE clients.phone_number = ?;
  `;

  const [result] = await db.query(query, [phoneNumber]);
  return result[0]; // Assuming you expect only one result
}



app.get('/customer-profile', async (req, res) => {
  try {
    const phoneNumber = req.query.phoneNumber;
    console.log('Phone Number:', phoneNumber);

    const clientAndDogInfo = await fetchClientAndDogInfoByPhoneNumber(phoneNumber);
    console.log('Client and Dog Info:', clientAndDogInfo);

    if (clientAndDogInfo) {
      res.render('customer-profile', { clientAndDogInfo });
    } else {
      console.log('Client not found');
      res.status(404).send('Client not found');
    }
  } catch (error) {
    console.error('Error fetching client and dog info:', error);
    res.status(500).send('Internal Server Error');
  }
});



// Getting client profile from phone number search
app.get('/get-client-profile', async (req, res) => {
  try {
    const { phoneNumber } = req.query;
    const query = 'SELECT * FROM clients WHERE phone_number = ?';
    const [client] = await db.query(query, [phoneNumber]);

    if (client.length > 0) {
      res.json(client[0]);
    } else {
      res.status(404).json({ error: 'Client not found' });
    }
  } catch (error) {
    console.error('Error fetching client profile:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});

// Update the appointment information
app.post('/edit-appointment/:id', async (req, res) => {
  const appointmentId = req.params.id;
  const { date, phoneNumber } = req.body;

  try {
    // Update the appointment date in the database
    const updateQuery = 'UPDATE appointments SET date = ? WHERE appointment_id = ?';
    await db.query(updateQuery, [date, appointmentId]);

    // Fetch the updated appointment data
    const fetchQuery = 'SELECT * FROM appointments WHERE appointment_id = ?';
    const [fetchResult] = await db.query(fetchQuery, [appointmentId]);

    const updatedAppointment = fetchResult[0];

    // Update client information if a phone number is provided
    if (phoneNumber) {
      const updateClientQuery = 'UPDATE clients SET appointment_id = ? WHERE phone_number = ?';
      await db.query(updateClientQuery, [appointmentId, phoneNumber]);
    }

    res.json({ updatedAppointment });
  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Fetch all appointments from the database
app.post('/create', async (req, res) => {
  try {
    const { title, date, timeSlot } = req.body;
    console.log('Received Date:', date);

    const connection = await db.getConnection();

    try {
      // Format time slot as 'HH:mm:ss'
      const timeSlotString = timeSlot !== undefined ? timeSlot.toString() : '';

      // Use the received date directly, without generating a new one
      const formattedDate = new Date(date).toISOString().slice(0, 10);

      const query = 'INSERT INTO appointments (client_id, date, time_slot, title, phone_number) VALUES ((SELECT client_id FROM clients WHERE phone_number = ?), ?, ?, ?, ?)';
      const [result] = await connection.query(query, [phoneNumber, formattedDate, timeSlotString, title, phoneNumber]);

      console.log('Create endpoint reached');
      console.log('Query:', query, 'Params:', [phoneNumber, formattedDate, timeSlotString, title, phoneNumber]);
      console.log('MySQL Query Result:', result);

      if (result.affectedRows === 1) {
        const newAppointment = {
          appointment_id: result.insertId,
          title,
          date: formattedDate,
          time_slot: timeSlotString,
          phone_number: phoneNumber,
        };

        connection.release(); // Release the connection back to the pool
        return res.json(newAppointment);
      } else {
        console.error('Unexpected number of affected rows:', result.affectedRows);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    } catch (insertError) {
      console.error('Error during execution:', insertError);
      res.status(500).json({ error: 'Internal Server Error', details: insertError.message });
    }
  } catch (connectionError) {
    console.error('Error establishing connection:', connectionError);
    res.status(500).json({ error: 'Internal Server Error', details: connectionError.message });
  }
});

// Fetch all appointments from the database
app.get('/load-appointments', async (req, res) => {
  try {
    const { date, week } = req.query;
    const connection = await db.getConnection();

    try {
      let query;
      if (date) {
        // Fetch appointments for a specific date
        query = 'SELECT * FROM appointments WHERE DATE(date) = ?';
      } else if (week) {
        // Fetch appointments for a specific week
        query = 'SELECT * FROM appointments WHERE WEEK(date) = ?';
      } else {
        // Fetch all appointments
        query = 'SELECT * FROM appointments';
      }

      const [appointments] = await connection.query(query, [date || week]);

      console.log('Fetched Appointments:', appointments);

      res.json(appointments);
    } catch (selectError) {
      console.error('Error during execution:', selectError);
      res.status(500).json({ error: 'Internal Server Error', details: selectError.message });
    } finally {
      connection.release(); // Release the connection back to the pool
    }
  } catch (connectionError) {
    console.error('Error establishing connection:', connectionError);
    res.status(500).json({ error: 'Internal Server Error', details: connectionError.message });
  }
});

// Assuming you have an endpoint for fetching appointments
app.get('/get-appointments', (req, res) => {
  // Fetch appointments from your database
  const appointments = [
    { appointment_id: 1, title: 'Meeting', date: '2022-01-15T10:00:00', phone_number: '123-456-7890' },
    // Add more appointments as needed
  ];

  res.json(appointments);
});

// Server-side code for canceling an appointment
app.post('/cancel-appointment/:id', (req, res) => {
  const appointmentId = req.params.id;

  // Implement the logic to cancel the appointment (e.g., update the database)
  db.query('DELETE FROM appointments WHERE appointment_id = ?', [appointmentId], (err, result) => {
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
