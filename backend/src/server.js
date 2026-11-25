require('dotenv').config();
const app = require('./app');
const { connectDatabase } = require('./config/database');

const port = Number(process.env.PORT || 5000);

async function start() {
  await connectDatabase();
  app.listen(port, () => {
    console.log(`server is running on port ${port}`);
  });
}

start().catch((error) => {
  console.error('Unable to start IMS API:', error.message);
  process.exitCode = 1;
});


