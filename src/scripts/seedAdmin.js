require('dotenv').config({ override: true });
const mongoose = require('mongoose');
const User = require('../models/User');
const config = require('../config/env');

async function seedAdmin() {
  try {
    await mongoose.connect(config.mongodbUri);
    console.log('Connected to MongoDB');

    const existingAdmin = await User.findOne({ email: 'avinash@admin.com' });

    if (existingAdmin) {
      // Update to ensure admin role and password
      existingAdmin.role = 'admin';
      existingAdmin.password = '123456';
      await existingAdmin.save();
      console.log('Admin user updated successfully');
    } else {
      await User.create({
        name: 'Avinash',
        email: 'avinash@admin.com',
        password: '123456',
        role: 'admin',
        company: 'GeoOutreach',
      });
      console.log('Admin user created successfully');
    }

    console.log('Admin credentials:');
    console.log('  Email: avinash@admin.com');
    console.log('  Password: 123456');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error seeding admin:', error.message);
    process.exit(1);
  }
}

seedAdmin();
