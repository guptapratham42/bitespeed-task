const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: true, // Enable SSL for secure connection (if applicable)
  }
});

module.exports = sequelize;
