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

// Create customer-profile page route
app.get('/create-profile', (req, res) => {
  res.render('create-profile');
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

// Inside your server-side code
app.get('/fetch-client-dog-info', async (req, res) => {
  try {
      const clientId = req.query.clientId;
      const dogId = req.query.dogId;

      // Fetch client and dog information from the database
      const [result] = await db.query(`
          SELECT clients.lastname, clients.firstname, dogs.dog_name
          FROM clients
          LEFT JOIN dogs ON clients.client_id = dogs.client_id
          WHERE clients.client_id = ? AND dogs.dog_id = ?;
      `, [clientId, dogId]);

      if (result.length > 0) {
          const clientAndDogInfo = result[0];
          res.json(clientAndDogInfo);
      } else {
          res.status(404).json({ error: 'Client and dog information not found' });
      }
  } catch (error) {
      console.error('Error fetching client and dog information:', error);
      res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.post('/log-appointment-to-history', async (req, res) => {
  try {
    console.log('Received request to log appointment to history:', req.body);

    const { appointment_id, client_id, dog_id, time_slot, date } = req.body;
    console.log('Received appointment_id:', appointment_id);

    console.log('Logging appointment to history with data:', {
      appointment_id,
      client_id,
      dog_id,
      time_slot,
      date,
    });

    // Your MySQL query to insert the appointment into the history table
    const logQuery = `
        INSERT INTO appointment_history (appointment_id, client_id, dog_id, time_slot, date)
        VALUES (?, ?, ?, ?, ?)
    `;

    // Execute the query with the provided data
    const [logResult] = await db.query(logQuery, [appointment_id, client_id, dog_id, time_slot, date]);

    // Assuming the insertion is successful
    if (logResult.affectedRows === 1) {
      console.log('Appointment logged to history successfully.');
      res.json({ success: true });
    } else {
      console.error('Unexpected number of affected rows in history log:', logResult.affectedRows);
      res.status(500).json({ success: false, message: 'Error logging appointment to history' });
    }
  } catch (error) {
    console.error('Error logging appointment to history:', error);
    res.status(500).json({ success: false, message: 'Error logging appointment to history' });
  }
});

// POST route to handle profile creation
app.post('/create-profile', async (req, res) => {
  try {
      const formData = req.body;

      // Insert client information
      const insertClientQuery = 'INSERT INTO clients (firstname, lastname, phone_number) VALUES (?, ?, ?)';
      const [clientResult] = await db.query(insertClientQuery, [formData.firstname, formData.lastname, formData.phone_number]);

      if (clientResult.affectedRows === 1) {
          const clientId = clientResult.insertId;

          // Insert dog information with the retrieved client ID
          const insertDogQuery = 'INSERT INTO dogs (client_id, dog_name, breed) VALUES (?, ?, ?)';
          const [dogResult] = await db.query(insertDogQuery, [clientId, formData.dog_name, formData.breed]);

          if (dogResult.affectedRows === 1) {
              // Insert appointment information
              const insertAppointmentQuery = 'INSERT INTO appointments (client_id, dog_id, time_slot, date) VALUES (?, ?, ?, ?)';
              const [appointmentResult] = await db.query(insertAppointmentQuery, [clientId, dogResult.insertId, '09:00', '2024-01-23']);

              if (appointmentResult.affectedRows === 1) {
                  const appointmentId = appointmentResult.insertId;

                  // Send the response with the success status, message, and appointmentId
                  res.status(200).json({
                      success: true,
                      message: 'Profile created successfully!',
                      appointmentId: appointmentId,
                  });
              } else {
                  res.status(500).json({ success: false, message: 'Error creating profile. Please try again.' });
              }
          } else {
              res.status(500).json({ success: false, message: 'Error creating profile. Please try again.' });
          }
      } else {
          res.status(500).json({ success: false, message: 'Error creating profile. Please try again.' });
      }
  } catch (error) {
      console.error('Error creating profile:', error);
      res.status(500).json({ success: false, message: 'Error creating profile. Please try again.' });
  }
});

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
      SELECT c.client_id, c.lastname, c.firstname, c.phone_number,
             d.dog_id, d.dog_name, d.breed,
             ah.date, ah.time_slot
      FROM clients c
      LEFT JOIN dogs d ON c.client_id = d.client_id
      LEFT JOIN appointment_history ah ON c.client_id = ah.client_id AND d.dog_id = ah.dog_id
      WHERE c.phone_number = ?
    `;
    const [clientAndDogs] = await db.query(query, [phoneNumber]);

    console.log('Query Result:', clientAndDogs); // Add this line for debugging

    if (clientAndDogs.length > 0) {
      // Extract client details
      const clientDetails = {
        client_id: clientAndDogs[0].client_id,
        lastname: clientAndDogs[0].lastname,
        firstname: clientAndDogs[0].firstname,
        phone_number: clientAndDogs[0].phone_number,
      };

      // Extract distinct dogs and their appointment history
      const dogsMap = new Map();
      clientAndDogs.forEach(appointment => {
        console.log('Individual Appointment:', appointment); // Add this line for debugging

        const { dog_id, dog_name, breed, date, time_slot } = appointment;

        if (!dogsMap.has(dog_id)) {
          dogsMap.set(dog_id, {
            dog_id,
            dog_name,
            breed,
            appointment_history: [],
          });
        }

        if (date) {
          dogsMap.get(dog_id).appointment_history.push({
            date,
            time_slot,
          });
        }
      });

      const dogsArray = Array.from(dogsMap.values());

      console.log('Formatted Result:', { ...clientDetails, dogs: dogsArray }); // Add this line for debugging

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
// Example in Node.js with MySQL2 library
app.delete('/cancel-appointment/:id', (req, res) => {
  const appointmentId = req.params.id;

  console.log('Canceling appointment:', appointmentId);

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
