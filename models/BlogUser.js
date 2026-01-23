import { DataTypes } from "sequelize";
import sequelize from "../db.js";

export const BlogUser = sequelize.define("BlogUser", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    username: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
    },
    password: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    email: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true
        }
    },
    role: {
        type: DataTypes.STRING(20),
        defaultValue: "editor",
        validate: {
            isIn: [["admin", "editor"]]
        }
    }
}, {
    tableName: "blog_users",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at"
});