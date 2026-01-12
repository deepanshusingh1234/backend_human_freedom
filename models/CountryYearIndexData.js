import { DataTypes } from "sequelize";
import sequelize from "../db.js";

export const CountryYearIndexData = sequelize.define("CountryYearIndexData", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    year: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    population: {
        type: DataTypes.BIGINT,
        allowNull: true
    },
    freedomIndex: {
        type: DataTypes.DECIMAL(10, 4),
        allowNull: true,
        field: "freedom_index"
    },
    welcomeIndex: {
        type: DataTypes.DECIMAL(10, 4),
        allowNull: true,
        field: "welcome_index"
    },
    countryId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "country_id"
    }
}, {
    tableName: "country_year_index_data",
    timestamps: false,
    indexes: [
        {
            unique: true,
            fields: ['country_id', 'year']
        }
    ]
});