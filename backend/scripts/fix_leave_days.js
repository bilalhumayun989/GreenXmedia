/**
 * Migration Script: Fix Leave Days Count
 * 
 * This script recalculates the daysCount for all existing leave applications
 * to ensure accurate date range calculations (inclusive days).
 * 
 * Usage: node backend/scripts/fix_leave_days.js
 */

const mongoose = require('mongoose');
const LeaveApplication = require('../models/LeaveApplication');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const fixLeaveDays = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Get all leave applications
        const leaves = await LeaveApplication.find({});
        console.log(`📋 Found ${leaves.length} leave applications to process`);

        let updated = 0;
        let errors = 0;

        for (const leave of leaves) {
            try {
                // Calculate days correctly (inclusive)
                const start = new Date(leave.startDate + 'T00:00:00');
                const end = new Date(leave.endDate + 'T00:00:00');
                const daysDiff = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;

                // Only update if different
                if (leave.daysCount !== daysDiff) {
                    console.log(`📅 Updating leave ${leave._id}: ${leave.startDate} to ${leave.endDate}`);
                    console.log(`   Old: ${leave.daysCount} days → New: ${daysDiff} days`);
                    
                    leave.daysCount = daysDiff;
                    await leave.save();
                    updated++;
                } else {
                    console.log(`✓ Leave ${leave._id} already correct: ${daysDiff} days`);
                }
            } catch (err) {
                console.error(`❌ Error processing leave ${leave._id}:`, err.message);
                errors++;
            }
        }

        console.log('\n=== Migration Complete ===');
        console.log(`✅ Updated: ${updated} records`);
        console.log(`✓ Already correct: ${leaves.length - updated - errors} records`);
        console.log(`❌ Errors: ${errors} records`);

        await mongoose.connection.close();
        console.log('🔌 Database connection closed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
};

// Run the migration
fixLeaveDays();
