import { DataTypes } from 'sequelize';
import sequelize from '../db.js';

const Contact = sequelize.define('Contact', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    fullName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: 'full_name'
    },
    email: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    subject: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    message: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    createdAt: {
        type: DataTypes.DATE,
        field: 'created_at',
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'contacts',
    timestamps: false,  // Disable auto timestamps
    createdAt: 'created_at',  // This doesn't matter when timestamps is false
    updatedAt: false    // Explicitly disable updatedAt
});

export default Contact;