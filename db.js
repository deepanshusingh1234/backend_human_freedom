import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: "postgres",
    protocol: "postgres",
    logging: process.env.NODE_ENV === "development" ? console.log : false,
    pool: { max: 20, min: 0, acquire: 30000, idle: 10000 },
    define: { underscored: true, timestamps: false },
    dialectOptions: {
        ssl: {
            require: true,
            rejectUnauthorized: false // very important
        }
    }
});

export default sequelize;
