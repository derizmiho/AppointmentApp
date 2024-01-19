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
// Customer Profile route
app.get('/customer-profile', (req, res) => {
  res.render('customer-profile');
});
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

// Function to fetch client and dog information by IDs
async function fetchClientAndDogInfoByIds(clientId, dogId) {
  const query = `
    SELECT clients.*, dogs.*
    FROM clients
    LEFT JOIN dogs ON clients.client_id = dogs.client_id
    WHERE clients.client_id = ? AND dogs.dog_id = ?;
  `;

  const [result] = await db.query(query, [clientId, dogId]);
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



app.get('/get-client-profile', async (req, res) => {
  try {
    const { phoneNumber } = req.query;
    const query = `
      SELECT c.*, d.dog_id, d.dog_name, d.breed
      FROM clients c
      LEFT JOIN dogs d ON c.client_id = d.client_id
      WHERE c.phone_number = ?
    `;
    const [clientAndDogs] = await db.query(query, [phoneNumber]);
    console.log('Query Result:', clientAndDogs);

    if (clientAndDogs.length > 0) {
      console.log('Client and Dogs:', clientAndDogs);

      // Extract client details
      const clientDetails = {
        client_id: clientAndDogs[0].client_id,
        lastname: clientAndDogs[0].lastname,
        firstname: clientAndDogs[0].firstname,
        phone_number: clientAndDogs[0].phone_number,
      };

      // Extract dogs array
      const dogsArray = clientAndDogs.map(dog => ({
        dog_id: dog.dog_id,
        dog_name: dog.dog_name,
        breed: dog.breed,
      }));
      console.log('Number of Dogs:', dogsArray.length);

      res.json({ ...clientDetails, dogs: dogsArray });
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
async function insertAppointmentIntoDatabase(appointmentData) {
  try {
    const { client_id, dog_id, time_slot, date } = appointmentData;

    // Fetch client and dog information to construct the title
    const [clientInfo] = await db.query('SELECT firstname, lastname FROM clients WHERE client_id = ?', [client_id]);
    const [dogInfo] = await db.query('SELECT dog_name FROM dogs WHERE dog_id = ?', [dog_id]);

    // Construct the title using client and dog information
    const title = `${clientInfo[0].firstname} ${clientInfo[0].lastname} - ${dogInfo[0].dog_name}`;

    // Your MySQL query to insert the appointment into the database with the title
    const insertQuery = `
      INSERT INTO appointments (client_id, dog_id, time_slot, date, title)
      VALUES (?, ?, ?, ?, ?)
    `;

    // Execute the query with the provided data
    const [result] = await db.query(insertQuery, [client_id, dog_id, time_slot, date, title]);

    // Assuming the insertion is successful
    if (result.affectedRows === 1) {
      return { success: true };
    } else {
      console.error('Unexpected number of affected rows:', result.affectedRows);
      return { success: false, message: 'Error inserting appointment into the database' };
    }
  } catch (error) {
    console.error('Error inserting appointment into the database:', error);
    return { success: false, message: 'Error inserting appointment into the database' };
  }
}


app.post('/create-appointment', async (req, res) => {
  try {
    const appointmentData = req.body;

    // Validate the incoming data
    if (!isValidAppointmentData(appointmentData)) {
      return res.status(400).json({ success: false, message: 'Invalid appointment data' });
    }

    // Set the appointment date based on the user's input or the current selected day
    appointmentData.date = req.body.date;

    // Insert the appointment into the database
    console.log('Before inserting appointment into the database')
    const insertResult = await insertAppointmentIntoDatabase(appointmentData);
    console.log('After inserting appointment into the database');
    console.log('Incoming Appointment Data:', appointmentData);

    if (insertResult.success) {
      res.json({ success: true, message: 'Appointment created successfully' });
    } else {
      res.status(500).json({ success: false, message: 'Error creating appointment', error: insertResult.message });
    }
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
  }
});




// Validation function for appointment data
function isValidAppointmentData(appointmentData) {
  // Check if appointmentData is an object
  if (typeof appointmentData !== 'object' || appointmentData === null) {
      return false;
  }

  // Ensure required fields are present
  if (!appointmentData.client_id || !appointmentData.dog_id || !appointmentData.time_slot) {
      return false;
  }

  // Validate time_slot format (HH:mm)
  const timeSlotRegex = /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeSlotRegex.test(appointmentData.time_slot)) {
      return false;
  }

  // If all validations pass, return true
  return true;
}


// Fetch all appointments from the database
app.get('/load-appointments', async (req, res) => {
  try {
    const { date, week } = req.query;
    const connection = await db.getConnection();

    try {
      let query;
      if (date) {
        // Fetch appointments for a specific date
        console.log('Before executing load-appointments query');
        console.log('Load Appointments - Date:', date, 'Week:', week);
        query = 'SELECT * FROM appointments WHERE DATE(date) = ?';
        console.log('After executing load-appointments query');

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
