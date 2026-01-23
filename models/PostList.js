import { DataTypes } from "sequelize";
import sequelize from "../db.js";

export const PostList = sequelize.define("PostList", {
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
    item_text: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    sort_order: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
}, {
    tableName: "post_lists",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false
});