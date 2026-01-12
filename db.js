import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config();

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 5432,
        dialect: "postgres",
        logging: process.env.NODE_ENV === "development" ? console.log : false,
        pool: {
            max: parseInt(process.env.DB_MAX_CONNECTIONS) || 20,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        define: {
            underscored: true,
            timestamps: false
        }
    }
);

export default sequelize;