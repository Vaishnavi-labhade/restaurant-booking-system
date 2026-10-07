# 🍽️ Restaurant Table Booking System

A clean, simple, and beginner-friendly **College Mini Project** for reserving restaurant dining tables online.

---

## 📌 Project Overview

The **Restaurant Table Booking System** is a full-stack web application designed for small restaurants to manage table reservations easily. Guests can visit the website, explore the food menu, check restaurant information, and book a table by submitting a simple reservation form. The reservation is validated on the client side and saved securely into a MongoDB database using an Express.js backend API.

---

## ✨ Features

- **Responsive & Modern Design**: Works smoothly across mobile phones, tablets, and desktop computers.
- **Separate File Structure**: HTML, CSS, JavaScript, and Backend code are neatly separated into dedicated files.
- **Interactive Navigation Bar**: Smooth scrolling to Home, About, Menu, Book a Table, and Contact sections.
- **Popular Menu Display**: Visual cards showcasing popular food items with names and prices (Pizza, Burger, Pasta, Biryani, Sandwich, Coffee).
- **Online Table Booking Form**: Collects customer name, email, phone number, reservation date, time, number of guests, and special requests.
- **Client-Side Form Validation**:
  - Checks for non-empty required fields.
  - Validates email format.
  - Validates phone number (minimum 10 digits).
  - Prevents booking past dates.
  - Limits guests between 1 and 20.
  - Displays instant inline feedback.
- **RESTful API**:
  - `POST /api/bookings` to create and save new bookings.
  - `GET /api/bookings` to retrieve all saved reservations.
- **Clear User Feedback**: Displays *"Table booked successfully!"* upon successful submission and clears the form.
- **Graceful Error Handling**: Displays user-friendly error alerts if the server or database is unavailable.

---

## 💻 Technologies Used

### Frontend
- **HTML5**: Semantic document structure.
- **CSS3**: Pure CSS styling with Flexbox, CSS Grid, cards, hover effects, and responsive media queries (No complex external frameworks used).
- **Vanilla JavaScript**: DOM manipulation, client-side validation, and asynchronous API calls using `fetch()`.

### Backend
- **Node.js**: JavaScript runtime environment.
- **Express.js**: Web server framework for routing and handling API requests.
- **dotenv**: Environment variable management.

### Database
- **MongoDB**: NoSQL document database.
- **Mongoose**: Object Data Modeling (ODM) library for MongoDB and Node.js.

---

## 📁 Folder Structure

```text
restaurant-booking/
│
├── public/
│   ├── index.html       # Website frontend structure
│   ├── style.css        # Clean, modern, responsive styles
│   └── script.js        # Form validation and fetch API connection
│
├── server.js            # Node.js & Express server, MongoDB connection, API routes
├── package.json         # Project metadata and dependencies
├── .env                 # Environment variables (PORT, MONGO_URI)
└── README.md            # Project documentation and setup guide
```

---

## ⚙️ Prerequisites

Before running the project, make sure you have the following installed on your computer:

1. **Node.js** (v16 or higher recommended): [Download Node.js](https://nodejs.org/)
2. **MongoDB**:
   - **Option A (Local)**: [MongoDB Community Server](https://www.mongodb.com/try/download/community) installed and running locally on your computer.
   - **Option B (Cloud)**: A free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cloud database.

---

## 🚀 How to Run the Project (Step-by-Step)

### Step 1: Open the Project Directory
Open your terminal or Command Prompt (CMD / PowerShell) and navigate into the project folder:
```bash
cd restaurant-booking
```

---

### Step 2: Install Required Dependencies
Install the required Node.js packages defined in `package.json`:
```bash
npm install
```
This installs `express`, `mongoose`, and `dotenv`.

---

### Step 3: Configure Environment Variables
Open the `.env` file in any text editor. By default, it is configured for a local MongoDB server:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/restaurant_db
```

> **Note for MongoDB Atlas Users**: If you are using MongoDB Atlas in the cloud, replace `MONGO_URI` with your connection string:
> ```env
> MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/restaurant_db?retryWrites=true&w=majority
> ```

---

### Step 4: Ensure MongoDB is Running
- If using **local MongoDB**, make sure the MongoDB service is active. On Windows, you can start it via Windows Services or run:
  ```bash
  mongod
  ```
- If using **MongoDB Atlas**, make sure your IP address is whitelisted in Network Access.

---

### Step 5: Start the Server
Start the Node.js Express server:
```bash
node server.js
```
*(Or alternatively run `npm start`)*

You should see output similar to:
```text
==================================================
 Server is running on: http://localhost:5000
 Static files served from: /public
==================================================
--------------------------------------------------
 [MongoDB] Database connected successfully!
--------------------------------------------------
```

---

### Step 6: Open the Website in Your Browser
Open your web browser (Google Chrome, Firefox, Edge, etc.) and visit:
```text
http://localhost:5000
```

Now you can:
1. Browse through the Home, About, and Menu sections.
2. Fill out the reservation form in the **Book a Table** section.
3. Click **Book Table** to submit.
4. See the success message: **"Table booked successfully!"**.

---

## 📡 API Endpoints Reference

| Method | Endpoint | Description | Request Body |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/bookings` | Saves a new reservation to MongoDB | `{ name, email, phone, date, time, guests, specialRequest }` |
| **GET** | `/api/bookings` | Returns all saved reservations | None |

You can test `GET /api/bookings` directly in your browser:
```text
http://localhost:5000/api/bookings
```
It returns all bookings in JSON format!

---

## 🎓 College Viva / Project Evaluation Q&A

**Q1: What is the architecture of this mini project?**
> It follows a classic **Client-Server Architecture**. The client (HTML/CSS/JS) sends requests via HTTP using JavaScript `fetch()`. The server (Node.js/Express) processes the request, communicates with the MongoDB database using Mongoose, and returns JSON responses.

**Q2: Why are HTML, CSS, and JS separated into distinct files?**
> Separation of concerns improves code readability, maintainability, reusability, and makes debugging easier. It also aligns with professional web development standards.

**Q3: How does the frontend communicate with the backend?**
> The frontend collects the input values from the booking form, converts them into a JSON object, and sends an asynchronous HTTP POST request using `fetch('/api/bookings')`.

**Q4: What is Mongoose and why is it used?**
> Mongoose is an Object Data Modeling (ODM) library for MongoDB and Node.js. It allows developers to define strongly typed schemas and models for storing structured documents in MongoDB.

---

## 📄 License
This project is licensed for educational and college mini-project purposes.

---

## 🛠️ Reliability notes (backend fixes)

- **Always works:** if MongoDB is unreachable (wrong password, Atlas IP not allowed, no internet), the server automatically stores data in `data/bookings.json` and `data/reviews.json`. Check which one is active at `http://localhost:5000/api/health`.
- **To use MongoDB Atlas:** set the real password in `MONGO_URI` (`.env`) and add your IP under Atlas → Network Access (`0.0.0.0/0` for testing).
- **No double booking:** table assignment is serialized, so two simultaneous bookings never get the same table.
- **Server-side validation** for email, phone, date, time and guests; clear JSON errors for bad requests.
- **Windows:** double-click `start.bat` (installs dependencies on first run).
