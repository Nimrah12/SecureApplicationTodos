const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const port = 3000;

// Use EJS as the view engine
app.set('view engine', 'ejs');

// Serve static files from the 'styles' directory
app.use('/styles', express.static('styles'));

// Use body-parser middleware to parse form data
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('views'));

// SQLite3 database setup
const db = new sqlite3.Database('./database.db');

// Create users and tasks tables
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT,
      password TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      description TEXT,
      dueDate DATE,
      priority TEXT,
      completed INTEGER,
      user_id INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
});

// Routes
app.get('/', (req, res) => {
  res.render('login');
});

app.get('/login', (req, res) => {
  console.log('Login route reached');
  // Render the login page
  res.render('login');
});

app.get('/register', (req, res) => {
  res.render('register');
});

// Vulnerability: No password hashing, vulnerable to SQL injection
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  // Insert user into the database
  db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, password], (err) => {
    if (err) {
      return res.send('SignUp failed. Please try again.');
    }
    res.send('User Sign up successful! <a href="/login">Login</a>');
  });
});

//login route
//insecure authentication, susceptible to SQL Injection 
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  // Vulnerable SQL query prone to SQL injection
  const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
  db.get(query, (err, row) => {
    if (err) {
      return res.send('Login failed. Please try again.');
    } if (!row) {
      return res.send('Invalid username or password.');
    }
    res.redirect('/tasks');
  });
});

//Retrive task
// Insecure Query, Cross-Site Scripting (XSS) Vulnerability
app.get('/tasks', (req, res) => {
  // Retrieve tasks for the logged-in user
  const userId = req.query.userId; // Vulnerable to reflected XSS
  db.all(`SELECT * FROM tasks WHERE user_id = ${userId}`, (err, tasks) => {
    if (err) {
      return res.send('Error retrieving tasks.');
    }
    res.render('tasks', { tasks });
  });
});

app.post('/tasks', (req, res) => {
  const { title, description, dueDate, priority, completed } = req.body;
  const userId = 1;

  // Insert task into the database
  db.run(
    'INSERT INTO tasks (title, description, dueDate, priority, completed, user_id) VALUES (?, ?, ?, ?, ?, ?)',
    [title, description, dueDate, priority, completed ? 1 : 0, userId],
    (err) => {
      if (err) {
        console.error('Task creation error:', err);
        return res.send('Task creation failed. Please try again.');
      }

      res.redirect('/tasks');
    }
  );
});

// Route to display all tasks
// Insecure Vulnerablity, Sensitive Data Exposure
app.get('/all-tasks', (req, res) => {
  // Vulnerable to sensitive data exposure as it returns all tasks without proper authorization
  db.all('SELECT * FROM tasks', (err, allTasks) => {
    if (err) {
      console.error('Error fetching tasks:', err);
      return res.status(500).send('Internal Server Error');
    }

    // Separate tasks into completed and not completed
    const notCompletedTasks = allTasks.filter(task => !task.completed);
    const completedTasks = allTasks.filter(task => task.completed);

    // Render the 'allTasks' EJS template and pass the tasks data
    res.render('allTasks', { notCompletedTasks, completedTasks });
  });
});


// Edit task route
app.get('/tasks/:id/edit', (req, res) => {
  const taskId = req.params.id;
  // Retrieve task details
  db.get('SELECT * FROM tasks WHERE id = ?', [taskId], (err, task) => {
    if (err || !task) {
      return res.send('Task not found.');
    }
    res.render('editTask', { task });
  });
});

// Update task route
app.post('/tasks/:id/edit', (req, res) => {
  const taskId = req.params.id;
  const { title, description, dueDate, priority, completed } = req.body;
  // Update task in the database
  db.run(
    'UPDATE tasks SET title = ?, description = ?, dueDate = ?, priority = ?, completed = ? WHERE id = ?',
    [title, description, dueDate, priority, completed ? 1 : 0, taskId],
    (err) => {
      if (err) {
        return res.send('Task update failed. Please try again.');
      }
      res.redirect('/tasks');
    }
  );
});

// Delete task route
app.get('/tasks/:id/delete', (req, res) => {
  const taskId = req.params.id;
  // Delete task from the database
  db.run('DELETE FROM tasks WHERE id = ?', [taskId], (err) => {
    if (err) {
      return res.send('Task deletion failed. Please try again.');
    }
    res.redirect('/tasks');
  });
});

// Main page route
app.get('/main', (req, res) => {
  res.render('main');
});

// Route to handle logout
app.get('/logout', (req, res) => {
  console.log('Logout route reached');
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.status(500).send('Internal Server Error');
    }
    res.redirect('/login');
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

