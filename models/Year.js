import { DataTypes } from "sequelize";
import sequelize from "../db.js";

export const Year = sequelize.define("Year", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    year: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        validate: {
            min: 1900,
            max: 2100
        }
    },
    worldPopulation: {
        type: DataTypes.BIGINT,
        allowNull: true,
        field: "world_population"
    },
    vffi: {
        type: DataTypes.FLOAT,  // store numeric VFFI
        allowNull: true
    }
}, {
    tableName: "years",
    timestamps: false
});