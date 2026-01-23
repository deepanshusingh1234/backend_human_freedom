import { DataTypes } from "sequelize";
import sequelize from "../db.js";

export const PostStat = sequelize.define("PostStat", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    post_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: "blog_posts",
            key: "id"
        },
        onDelete: "CASCADE"
    },
    table_type: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: {
            isIn: [["stats1", "stats2"]]
        }
    },
    country: {
        type: DataTypes.STRING(100)
    },
    label: {
        type: DataTypes.STRING(255)
    },
    difference: {
        type: DataTypes.STRING(20)
    },
    travel: {
        type: DataTypes.STRING(20)
    },
    welcome: {
        type: DataTypes.STRING(20)
    },
    gain: {
        type: DataTypes.STRING(20)
    },
    decline: {
        type: DataTypes.STRING(20)
    },
    position: {
        type: DataTypes.STRING(20)
    },
    sort_order: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
}, {
    tableName: "post_stats",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false
});