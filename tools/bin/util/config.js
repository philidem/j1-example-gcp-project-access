const dotenv = require('dotenv');

exports.printConfigEntry = function (key) {
  const result = dotenv.config();
  const value = result.parsed?.[key]?.trim();
  if (value) {
    process.stdout.write(value);
  } else {
    console.error(`"${key}" is missing from your .env file`);
    process.exitCode = 1;
  }
};
