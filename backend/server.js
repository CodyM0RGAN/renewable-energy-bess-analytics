const mongoose = require('mongoose');
const dotenv = require('dotenv');

const { createApp } = require('./src/app');
const { seedDatabase } = require('./src/seed');

dotenv.config();

const PORT = process.env.PORT || 8089;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongo:27017/bess_analytics';

const app = createApp();

async function startServer() {
  try {
    mongoose.set('strictQuery', false);
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    try {
      const { seeded, count } = await seedDatabase();
      if (seeded) {
        console.log('Seeded ' + count + ' BESS assets');
      } else {
        console.log('BESS asset collection already populated (' + count + ' records)');
      }
    } catch (seedErr) {
      console.warn('Failed to seed database:', seedErr.message);
    }

    app.listen(PORT, () => {
      console.log('Server running on port ' + PORT);
    });
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
