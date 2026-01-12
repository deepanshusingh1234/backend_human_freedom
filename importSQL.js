// importSQL.js
import { Sequelize } from "sequelize";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

// Connect to PostgreSQL using DATABASE_URL
const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: "postgres",
    dialectOptions: {
        ssl: {
            require: true,
            rejectUnauthorized: false
        }
    },
});

async function importSQL() {
    try {
        const sql = fs.readFileSync("hf-4.sql", "utf8"); // your SQL file
        await sequelize.query(sql);                       // execute SQL
        console.log("✅ SQL imported successfully!");
        process.exit(0);
    } catch (err) {
        console.error("❌ Error importing SQL:", err);
        process.exit(1);
    }
}

importSQL();
