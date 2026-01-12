import { DataTypes } from "sequelize";
import sequelize from "../db.js";

export const Country = sequelize.define("Country", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notEmpty: true
        }
    },
    code: {
        type: DataTypes.STRING(3),
        allowNull: false,
        unique: true,
        validate: {
            notEmpty: true,
            len: [2, 3]
        }
    }
}, {
    tableName: "countries",
    timestamps: false
});