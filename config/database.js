const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('bitespeed_db', 'admin', 'pass', {
  host: 'localhost',
  dialect: 'postgres'
});

module.exports = sequelize;
