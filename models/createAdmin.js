// scripts/createAdmin.js
import bcrypt from 'bcrypt';
import { BlogUser } from '../models/index.js';
import sequelize from '../db.js';

const createAdminUser = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connected successfully');

        // Check if admin already exists
        const existingAdmin = await BlogUser.findOne({
            where: { username: 'admin' }
        });

        if (existingAdmin) {
            console.log('✅ Admin user already exists');
            return;
        }

        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash('admin123', saltRounds);

        // Create admin user
        await BlogUser.create({
            username: 'admin',
            password_hash: passwordHash,
            email: 'admin@visafreeblog.com',
            role: 'admin'
        });

        console.log('✅ Admin user created successfully');
        console.log('Username: admin');
        console.log('Password: admin123');

    } catch (error) {
        console.error('❌ Error creating admin user:', error);
    } finally {
        process.exit();
    }
};

createAdminUser();