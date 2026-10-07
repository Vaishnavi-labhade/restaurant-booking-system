// ============================================================
// RESTAURANT TABLE BOOKING SYSTEM - BACKEND SERVER
// Node.js + Express. Uses MongoDB when reachable, and automatically
// falls back to a local JSON file so the app ALWAYS works.
// ============================================================
require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const MONGO_URI = (process.env.MONGO_URI || '').trim();
const TOTAL_TABLES = 12;
const DATA_DIR = path.join(__dirname, 'data');

// ------------------------------------------------------------
// Middleware
// ------------------------------------------------------------
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ------------------------------------------------------------
// Simple async mutex: prevents two bookings taking the same table
// ------------------------------------------------------------
let lockChain = Promise.resolve();
function withLock(fn) {
  const run = lockChain.then(fn, fn);
  lockChain = run.catch(() => {});
  return run;
}

// ------------------------------------------------------------
// Storage layer: FileStore (always works) / MongoStore (optional)
// Both expose the same async interface.
// ------------------------------------------------------------
class FileStore {
  constructor(dir) {
    this.name = 'local file (data/*.json)';
    this.dir = dir;
    fs.mkdirSync(dir, { recursive: true });
    this.files = { bookings: path.join(dir, 'bookings.json'), reviews: path.join(dir, 'reviews.json') };
    this.cache = {};
    for (const k of Object.keys(this.files)) this.cache[k] = this._load(this.files[k]);
  }
  _load(file) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      if (e.code !== 'ENOENT') {
        try { fs.copyFileSync(file, file + '.corrupt-' + Date.now()); } catch (_) {}
        console.error(`[FileStore] Could not read ${path.basename(file)} (${e.message}); starting fresh (backup kept).`);
      }
      return [];
    }
  }
  _save(kind) {
    const file = this.files[kind];
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.cache[kind], null, 2));
    fs.renameSync(tmp, file); // atomic replace: no half-written files
  }
  async listBookings() { return [...this.cache.bookings].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); }
  async confirmedOnDate(date) { return this.cache.bookings.filter(b => b.date === date && b.status === 'Confirmed'); }
  async addBooking(data) {
    const doc = { _id: crypto.randomBytes(12).toString('hex'), ...data, createdAt: new Date().toISOString() };
    this.cache.bookings.push(doc); this._save('bookings'); return doc;
  }
  async cancelBooking(id) {
    const b = this.cache.bookings.find(x => x._id === id);
    if (!b) return null;
    b.status = 'Cancelled'; this._save('bookings'); return b;
  }
  async deleteBooking(id) {
    const i = this.cache.bookings.findIndex(x => x._id === id);
    if (i === -1) return false;
    this.cache.bookings.splice(i, 1); this._save('bookings'); return true;
  }
  async listReviews() { return [...this.cache.reviews].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); }
  async addReview(data) {
    const doc = { _id: crypto.randomBytes(12).toString('hex'), ...data, createdAt: new Date().toISOString() };
    this.cache.reviews.push(doc); this._save('reviews'); return doc;
  }
}

class MongoStore {
  constructor(mongoose) {
    this.name = 'MongoDB';
    const bookingSchema = new mongoose.Schema({
      name: { type: String, required: true, trim: true },
      email: { type: String, required: true, trim: true, lowercase: true },
      phone: { type: String, required: true, trim: true },
      date: { type: String, required: true },
      time: { type: String, required: true },
      guests: { type: Number, required: true, min: 1, max: 20 },
      tableNumber: { type: Number, default: 1 },
      status: { type: String, enum: ['Confirmed', 'Cancelled'], default: 'Confirmed' },
      specialRequest: { type: String, default: '', trim: true },
      createdAt: { type: Date, default: Date.now }
    });
    const reviewSchema = new mongoose.Schema({
      name: { type: String, required: true, trim: true },
      rating: { type: Number, required: true, min: 1, max: 5 },
      comment: { type: String, required: true, trim: true },
      createdAt: { type: Date, default: Date.now }
    });
    this.Booking = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);
    this.Review = mongoose.models.Review || mongoose.model('Review', reviewSchema);
    this.isId = (id) => mongoose.isValidObjectId(id);
  }
  async listBookings() { return this.Booking.find().sort({ createdAt: -1 }).lean(); }
  async confirmedOnDate(date) { return this.Booking.find({ date, status: 'Confirmed' }).lean(); }
  async addBooking(data) { return (await this.Booking.create(data)).toObject(); }
  async cancelBooking(id) { return this.isId(id) ? this.Booking.findByIdAndUpdate(id, { status: 'Cancelled' }, { new: true }).lean() : null; }
  async deleteBooking(id) { return this.isId(id) ? !!(await this.Booking.findByIdAndDelete(id)) : false; }
  async listReviews() { return this.Review.find().sort({ createdAt: -1 }).lean(); }
  async addReview(data) { return (await this.Review.create(data)).toObject(); }
}

let store = null;
let readyResolve;
const ready = new Promise((r) => { readyResolve = r; });
// API calls wait (briefly) until the database choice is made; static pages load instantly
app.use('/api', (req, res, next) => { ready.then(() => next()); });

async function initStore() {
  const looksLikePlaceholder = /YOUR_PASSWORD_HERE|<password>|<db_password>/i.test(MONGO_URI);
  if (MONGO_URI && !looksLikePlaceholder) {
    try {
      const mongoose = require('mongoose');
      await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 6000, connectTimeoutMS: 6000 });
      store = new MongoStore(mongoose);
      console.log(' [Database] Connected to MongoDB.');
      mongoose.connection.on('disconnected', () => console.warn(' [Database] MongoDB disconnected - retrying automatically...'));
      return;
    } catch (err) {
      console.error(' [Database] MongoDB unavailable:', err.message);
    }
  } else if (looksLikePlaceholder) {
    console.error(' [Database] MONGO_URI still contains the password placeholder (YOUR_PASSWORD_HERE).');
  }
  store = new FileStore(DATA_DIR);
  console.log(' [Database] Using LOCAL FILE storage (data/ folder). Bookings are saved and the site works fully.');
}

// ------------------------------------------------------------
// Helpers / validation
// ------------------------------------------------------------
const pad = (n) => String(n).padStart(2, '0');
function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function isValidDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
function dayBefore(s) {
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - 1));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((error) => {
  console.error(`[${req.method} ${req.path}]`, error.message);
  res.status(500).json({ success: false, message: 'Something went wrong on the server. Please try again.', error: error.message });
});

// ------------------------------------------------------------
// Routes
// ------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok', database: store ? store.name : 'starting', time: new Date().toISOString() });
});

app.get('/api/availability', wrap(async (req, res) => {
  let date = str(req.query.date, 10) || localToday();
  if (!isValidDate(date)) date = localToday();
  const booked = (await store.confirmedOnDate(date)).length;
  const available = Math.max(0, TOTAL_TABLES - booked);
  res.json({ success: true, date, totalTables: TOTAL_TABLES, bookedTables: booked, availableTables: available, isFullyBooked: available === 0 });
}));

app.post('/api/bookings', wrap(async (req, res) => {
  const b = req.body || {};
  const name = str(b.name, 100), email = str(b.email, 150).toLowerCase(), phone = str(b.phone, 25);
  const date = str(b.date, 10), time = str(b.time, 5), specialRequest = str(b.specialRequest, 500);
  const guests = Number(b.guests);

  if (!name || !email || !phone || !date || !time || !b.guests) {
    return res.status(400).json({ success: false, message: 'Please fill in all required fields (name, email, phone, date, time, guests).' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
  if (phone.replace(/\D/g, '').length < 10) return res.status(400).json({ success: false, message: 'Phone number must have at least 10 digits.' });
  if (!isValidDate(date)) return res.status(400).json({ success: false, message: 'Please choose a valid date.' });
  // one day of tolerance so server/browser timezone differences never block a valid booking
  if (date < dayBefore(localToday())) return res.status(400).json({ success: false, message: 'Booking date cannot be in the past.' });
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return res.status(400).json({ success: false, message: 'Please choose a valid time.' });
  if (!Number.isInteger(guests) || guests < 1 || guests > 20) return res.status(400).json({ success: false, message: 'Guests must be a whole number between 1 and 20.' });

  const saved = await withLock(async () => {
    const active = await store.confirmedOnDate(date);
    if (active.length >= TOTAL_TABLES) return null;
    const taken = new Set(active.map(x => x.tableNumber));
    let table = 1;
    for (let i = 1; i <= TOTAL_TABLES; i++) if (!taken.has(i)) { table = i; break; }
    return store.addBooking({ name, email, phone, date, time, guests, tableNumber: table, status: 'Confirmed', specialRequest });
  });

  if (!saved) {
    return res.status(400).json({ success: false, message: `Sorry, all ${TOTAL_TABLES} tables are fully booked for ${date}. Please choose another date.` });
  }
  console.log(`[New Booking] ${name} - Table #${saved.tableNumber} on ${date} at ${time}`);
  res.status(201).json({ success: true, message: 'Table booked successfully!', data: saved });
}));

app.get('/api/bookings', wrap(async (req, res) => {
  const data = await store.listBookings();
  res.json({ success: true, count: data.length, data });
}));

app.patch('/api/bookings/:id/cancel', wrap(async (req, res) => {
  const updated = await store.cancelBooking(req.params.id);
  if (!updated) return res.status(404).json({ success: false, message: 'Booking not found.' });
  res.json({ success: true, message: 'Booking cancelled successfully. The table is now available again.', data: updated });
}));

app.delete('/api/bookings/:id', wrap(async (req, res) => {
  const ok = await store.deleteBooking(req.params.id);
  if (!ok) return res.status(404).json({ success: false, message: 'Booking not found.' });
  res.json({ success: true, message: 'Booking record deleted successfully.' });
}));

app.post('/api/reviews', wrap(async (req, res) => {
  const b = req.body || {};
  const name = str(b.name, 100), comment = str(b.comment, 1000), rating = Number(b.rating);
  if (!name || !comment || !b.rating) return res.status(400).json({ success: false, message: 'Please provide your name, star rating (1-5), and feedback comment.' });
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5.' });
  const saved = await store.addReview({ name, rating, comment });
  res.status(201).json({ success: true, message: 'Thank you for your valuable feedback!', data: saved });
}));

app.get('/api/reviews', wrap(async (req, res) => {
  const reviews = await store.listReviews();
  const avg = reviews.length ? Number((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)) : 0;
  res.json({ success: true, count: reviews.length, averageRating: avg, data: reviews });
}));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Unknown API routes -> JSON (not HTML), bad JSON -> clear error
app.use('/api', (req, res) => res.status(404).json({ success: false, message: 'API route not found.' }));
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') return res.status(400).json({ success: false, message: 'Invalid JSON in request.' });
  console.error('[Unhandled]', err && err.message);
  res.status(500).json({ success: false, message: 'Unexpected server error.' });
});

// Never crash the server because of one bad request
process.on('unhandledRejection', (r) => console.error('[unhandledRejection]', r && r.message ? r.message : r));
process.on('uncaughtException', (e) => console.error('[uncaughtException]', e.message));

// ------------------------------------------------------------
// Start (DB is chosen BEFORE accepting requests)
// ------------------------------------------------------------
console.log('==================================================');
const server = app.listen(PORT, () => {
  console.log(` Server running: http://localhost:${PORT}`);
  console.log('==================================================');
  initStore().catch((e) => {
    console.error(' [Database] Init failed:', e.message);
    store = new FileStore(DATA_DIR);
  }).finally(readyResolve);
});
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') console.error(` Port ${PORT} is already in use. Close the other server, or change PORT in .env`);
  else console.error(' Server error:', e.message);
  process.exit(1);
});
