import { DataTypes } from "sequelize";
import sequelize from "../db.js";

export const VisaMatrix = sequelize.define("VisaMatrix", {
    fromCountryId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "from_country_id",
        primaryKey: true  // Part of composite primary key
    },
    toCountryId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "to_country_id",
        primaryKey: true  // Part of composite primary key
    },
    yearId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "year_id",
        primaryKey: true  // Part of composite primary key
    },
    visaFree: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        field: "visa_free"
    }
}, {
    tableName: "visa_matrix",
    timestamps: false,
    // No separate id column - using composite primary key
    // Sequelize will handle composite keys automatically
});