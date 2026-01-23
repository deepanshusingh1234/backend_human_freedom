import { DataTypes } from "sequelize";
import sequelize from "../db.js";

export const BlogPost = sequelize.define("BlogPost", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    title: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    slug: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    content2: {
        type: DataTypes.TEXT
    },
    author: {
        type: DataTypes.STRING(100),
        defaultValue: "Saša Zorović"
    },
    category: {
        type: DataTypes.STRING(50),
        defaultValue: "Uncategorized"
    },
    post_date: {
        type: DataTypes.STRING(20),
        allowNull: false
    },
    featured_image: {
        type: DataTypes.STRING(255)
    },
    status: {
        type: DataTypes.STRING(20),
        defaultValue: "published",
        validate: {
            isIn: [["published", "draft", "archived"]]
        }
    },
    views: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    comments_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
}, {
    tableName: "blog_posts",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at"
});