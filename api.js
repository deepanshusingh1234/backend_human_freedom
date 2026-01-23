import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import sequelize from "./db.js";
import Contact from './models/Contact.js';
import { BlogUser, BlogPost, PostStat, PostList } from "./models/index.js";
import { Year } from "./models/Year.js";

dotenv.config();

const app = express();
const PORT = process.env.SERVER_PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Helper functions
const safeNumber = (value) => {
    if (value === null || value === undefined || value === "") return 0;
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
};

const formatPopulationIndex = (population, worldPopulation) => {
    if (!worldPopulation || !population || worldPopulation === 0) return "";
    return ((population / worldPopulation) * 100).toFixed(2) + " %";
};



// Helper function to create slug
const createSlug = (title) => {
    return title
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/--+/g, "-")
        .trim();
};

// ====================================================
// BLOG API ENDPOINTS
// ====================================================

// Admin login endpoint (Plain text)
app.post("/api/blog/admin/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        console.log("🔐 Admin login attempt:", username, "Password:", password);

        if (!username || !password) {
            return res.status(400).json({
                error: "Username and password are required"
            });
        }

        // Find user
        const user = await BlogUser.findOne({
            where: { username }
        });

        if (!user) {
            console.log("❌ User not found:", username);
            return res.status(401).json({
                error: "Invalid credentials"
            });
        }

        console.log("User found. DB password:", user.password);

        // Simple plain text comparison
        if (password !== user.password) {
            console.log("❌ Password mismatch");
            console.log("Expected:", user.password);
            console.log("Got:", password);
            return res.status(401).json({
                error: "Invalid credentials"
            });
        }

        console.log("✅ Login successful for:", username);

        // Return user info
        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({
            error: "Internal server error",
            details: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
});

// Simple Authentication Middleware (Plain text)
const authenticateBlogAdmin = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Basic ")) {
            return res.status(401).json({ error: "Authentication required" });
        }

        const base64Credentials = authHeader.split(" ")[1];
        const credentials = Buffer.from(base64Credentials, "base64").toString("ascii");
        const [username, password] = credentials.split(":");

        const user = await BlogUser.findOne({
            where: { username }
        });

        if (!user) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        // Plain text comparison
        if (password !== user.password) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error("Auth error:", error);
        res.status(500).json({ error: "Authentication failed" });
    }
};

// Debug endpoint to check database
app.get("/api/blog/debug-users", async (req, res) => {
    try {
        const users = await BlogUser.findAll();

        const userData = users.map(user => ({
            id: user.id,
            username: user.username,
            password: user.password,
            email: user.email,
            role: user.role
        }));

        res.json({
            success: true,
            users: userData,
            message: `Found ${users.length} users`
        });

    } catch (error) {
        console.error("Debug error:", error);
        res.status(500).json({
            error: "Failed to get users",
            details: error.message
        });
    }
});

// Create admin if not exists
app.post("/api/blog/create-admin", async (req, res) => {
    try {
        const { username = "admin", password = "admin123", email = "admin@test.com" } = req.body;

        // Check if exists
        const existing = await BlogUser.findOne({ where: { username } });

        if (existing) {
            return res.json({
                success: true,
                message: "Admin already exists",
                admin: {
                    username: existing.username,
                    password: existing.password
                }
            });
        }

        // Create admin
        const admin = await BlogUser.create({
            username,
            password, // Plain text
            email,
            role: "admin"
        });

        res.json({
            success: true,
            message: "Admin created successfully",
            admin: {
                id: admin.id,
                username: admin.username,
                password: admin.password,
                email: admin.email
            }
        });

    } catch (error) {
        console.error("Create admin error:", error);
        res.status(500).json({
            error: "Failed to create admin",
            details: error.message
        });
    }
});

// Health check
app.get("/api/blog/health", (req, res) => {
    res.json({
        status: "ok",
        message: "Blog API is running",
        timestamp: new Date().toISOString(),
        authType: "plain_text"
    });
});

// GET all blog posts (public)
app.get("/api/blog/posts", async (req, res) => {
    try {
        const { status = "published", page = 1, limit = 10 } = req.query;

        const offset = (page - 1) * limit;

        const posts = await BlogPost.findAndCountAll({
            where: { status },
            order: [["post_date", "DESC"], ["created_at", "DESC"]],
            limit: parseInt(limit),
            offset: parseInt(offset),
            include: [
                {
                    model: PostStat,
                    as: "stats",
                    separate: true,
                    order: [["sort_order", "ASC"]]
                },
                {
                    model: PostList,
                    as: "list",
                    separate: true,
                    order: [["sort_order", "ASC"]]
                }
            ]
        });

        res.json({
            success: true,
            data: posts.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: posts.count,
                pages: Math.ceil(posts.count / limit)
            }
        });

    } catch (error) {
        console.error("Get posts error:", error);
        res.status(500).json({
            error: "Failed to fetch posts",
            details: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
});

// GET single blog post by slug (public)
app.get("/api/blog/posts/:slug", async (req, res) => {
    try {
        const { slug } = req.params;

        const post = await BlogPost.findOne({
            where: { slug, status: "published" },
            include: [
                {
                    model: PostStat,
                    as: "stats",
                    separate: true,
                    order: [["sort_order", "ASC"]]
                },
                {
                    model: PostList,
                    as: "list",
                    separate: true,
                    order: [["sort_order", "ASC"]]
                }
            ]
        });

        if (!post) {
            return res.status(404).json({
                error: "Post not found"
            });
        }

        // Increment views
        await post.increment("views");

        res.json({
            success: true,
            data: post
        });

    } catch (error) {
        console.error("Get post error:", error);
        res.status(500).json({
            error: "Failed to fetch post",
            details: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
});

// CREATE new blog post (admin only)
app.post("/api/blog/posts", authenticateBlogAdmin, async (req, res) => {
    try {
        const { title, content, content2, author, category, date, stats, stats2, list } = req.body;

        console.log("📝 Creating new blog post:", title);

        // Validate required fields
        if (!title || !content || !date) {
            return res.status(400).json({
                error: "Title, content, and date are required"
            });
        }

        // Create slug from title
        const slug = createSlug(title) + "-" + Date.now();

        // Start transaction
        const transaction = await sequelize.transaction();

        try {
            // Create blog post
            const post = await BlogPost.create({
                title,
                slug,
                content,
                content2: content2 || null,
                author: author || "Saša Zorović",
                category: category || "Uncategorized",
                post_date: date,
                status: "published"
            }, { transaction });

            // Create stats1
            if (stats && Array.isArray(stats)) {
                const stats1Data = stats.map((stat, index) => ({
                    post_id: post.id,
                    table_type: "stats1",
                    country: stat.country,
                    label: stat.label,
                    difference: stat.difference,
                    travel: stat.travel,
                    welcome: stat.welcome,
                    gain: stat.gain,
                    decline: stat.decline,
                    position: stat.position,
                    sort_order: index
                }));

                if (stats1Data.length > 0) {
                    await PostStat.bulkCreate(stats1Data, { transaction });
                }
            }

            // Create stats2
            if (stats2 && Array.isArray(stats2)) {
                const stats2Data = stats2.map((stat, index) => ({
                    post_id: post.id,
                    table_type: "stats2",
                    country: stat.country,
                    label: stat.label,
                    difference: stat.difference,
                    travel: stat.travel,
                    welcome: stat.welcome,
                    gain: stat.gain,
                    decline: stat.decline,
                    position: stat.position,
                    sort_order: index
                }));

                if (stats2Data.length > 0) {
                    await PostStat.bulkCreate(stats2Data, { transaction });
                }
            }

            // Create list items
            if (list && Array.isArray(list)) {
                const listData = list.map((item, index) => ({
                    post_id: post.id,
                    item_text: item,
                    sort_order: index
                }));

                if (listData.length > 0) {
                    await PostList.bulkCreate(listData, { transaction });
                }
            }

            // Commit transaction
            await transaction.commit();

            console.log("✅ Blog post created successfully:", post.id);

            // Fetch complete post with relationships
            const completePost = await BlogPost.findByPk(post.id, {
                include: [
                    {
                        model: PostStat,
                        as: "stats",
                        separate: true,
                        order: [["sort_order", "ASC"]]
                    },
                    {
                        model: PostList,
                        as: "list",
                        separate: true,
                        order: [["sort_order", "ASC"]]
                    }
                ]
            });

            res.status(201).json({
                success: true,
                message: "Blog post created successfully",
                data: completePost
            });

        } catch (error) {
            // Rollback transaction on error
            await transaction.rollback();
            throw error;
        }

    } catch (error) {
        console.error("Create post error:", error);
        res.status(500).json({
            error: "Failed to create post",
            details: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
});

// UPDATE blog post (admin only)
app.put("/api/blog/posts/:id", authenticateBlogAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, content, content2, author, category, date, stats, stats2, list } = req.body;

        console.log("✏️ Updating blog post:", id);

        const post = await BlogPost.findByPk(id);

        if (!post) {
            return res.status(404).json({
                error: "Post not found"
            });
        }

        // Start transaction
        const transaction = await sequelize.transaction();

        try {
            // Update blog post
            await post.update({
                title: title || post.title,
                content: content || post.content,
                content2: content2 !== undefined ? content2 : post.content2,
                author: author || post.author,
                category: category || post.category,
                post_date: date || post.post_date
            }, { transaction });

            // Delete existing stats and lists
            await PostStat.destroy({
                where: { post_id: id },
                transaction
            });

            await PostList.destroy({
                where: { post_id: id },
                transaction
            });

            // Create stats1
            if (stats && Array.isArray(stats)) {
                const stats1Data = stats.map((stat, index) => ({
                    post_id: id,
                    table_type: "stats1",
                    country: stat.country,
                    label: stat.label,
                    difference: stat.difference,
                    travel: stat.travel,
                    welcome: stat.welcome,
                    gain: stat.gain,
                    decline: stat.decline,
                    position: stat.position,
                    sort_order: index
                }));

                if (stats1Data.length > 0) {
                    await PostStat.bulkCreate(stats1Data, { transaction });
                }
            }

            // Create stats2
            if (stats2 && Array.isArray(stats2)) {
                const stats2Data = stats2.map((stat, index) => ({
                    post_id: id,
                    table_type: "stats2",
                    country: stat.country,
                    label: stat.label,
                    difference: stat.difference,
                    travel: stat.travel,
                    welcome: stat.welcome,
                    gain: stat.gain,
                    decline: stat.decline,
                    position: stat.position,
                    sort_order: index
                }));

                if (stats2Data.length > 0) {
                    await PostStat.bulkCreate(stats2Data, { transaction });
                }
            }

            // Create list items
            if (list && Array.isArray(list)) {
                const listData = list.map((item, index) => ({
                    post_id: id,
                    item_text: item,
                    sort_order: index
                }));

                if (listData.length > 0) {
                    await PostList.bulkCreate(listData, { transaction });
                }
            }

            // Commit transaction
            await transaction.commit();

            console.log("✅ Blog post updated successfully:", id);

            // Fetch updated post with relationships
            const updatedPost = await BlogPost.findByPk(id, {
                include: [
                    {
                        model: PostStat,
                        as: "stats",
                        separate: true,
                        order: [["sort_order", "ASC"]]
                    },
                    {
                        model: PostList,
                        as: "list",
                        separate: true,
                        order: [["sort_order", "ASC"]]
                    }
                ]
            });

            res.json({
                success: true,
                message: "Blog post updated successfully",
                data: updatedPost
            });

        } catch (error) {
            // Rollback transaction on error
            await transaction.rollback();
            throw error;
        }

    } catch (error) {
        console.error("Update post error:", error);
        res.status(500).json({
            error: "Failed to update post",
            details: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
});

// DELETE blog post (admin only)
app.delete("/api/blog/posts/:id", authenticateBlogAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        console.log("🗑️ Deleting blog post:", id);

        const post = await BlogPost.findByPk(id);

        if (!post) {
            return res.status(404).json({
                error: "Post not found"
            });
        }

        await post.destroy();

        console.log("✅ Blog post deleted successfully:", id);

        res.json({
            success: true,
            message: "Blog post deleted successfully"
        });

    } catch (error) {
        console.error("Delete post error:", error);
        res.status(500).json({
            error: "Failed to delete post",
            details: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
});

// GET all blog posts for admin (with pagination)
app.get("/api/blog/admin/posts", authenticateBlogAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20, search = "" } = req.query;

        const offset = (page - 1) * limit;

        const whereCondition = {};

        if (search) {
            whereCondition.title = {
                [Op.iLike]: `%${search}%`
            };
        }

        const posts = await BlogPost.findAndCountAll({
            where: whereCondition,
            order: [["created_at", "DESC"]],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            success: true,
            data: posts.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: posts.count,
                pages: Math.ceil(posts.count / limit)
            }
        });

    } catch (error) {
        console.error("Admin get posts error:", error);
        res.status(500).json({
            error: "Failed to fetch posts",
            details: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
});

// Admin login endpoint
app.post("/api/blog/admin/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        console.log("🔐 Admin login attempt:", username);

        if (!username || !password) {
            return res.status(400).json({
                error: "Username and password are required"
            });
        }

        // Find user
        const user = await BlogUser.findOne({
            where: { username }
        });

        if (!user) {
            console.log("❌ User not found:", username);
            return res.status(401).json({
                error: "Invalid credentials"
            });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
            console.log("❌ Invalid password for:", username);
            return res.status(401).json({
                error: "Invalid credentials"
            });
        }

        console.log("✅ Login successful for:", username);

        // Return user info (without password)
        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({
            error: "Internal server error",
            details: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
});

// Blog test endpoint
app.get("/api/blog/test", (req, res) => {
    res.json({
        message: "Blog API is working",
        timestamp: new Date().toISOString()
    });
});

// Initialize Admin User (run once)
app.post("/api/blog/init-admin", async (req, res) => {
    try {
        const { username, password, email } = req.body;

        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Create admin user
        await BlogUser.create({
            username,
            password_hash: passwordHash,
            email,
            role: "admin"
        });

        res.json({
            success: true,
            message: "Admin user created successfully"
        });

    } catch (error) {
        console.error("Init admin error:", error);
        res.status(500).json({
            error: "Failed to create admin user",
            details: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
});

// ====================================================
// 1️⃣ GET ALL COUNTRIES SUMMARY FOR A YEAR
// ====================================================
app.get("/api/visa/:year", async (req, res) => {
    const year = parseInt(req.params.year);

    try {
        const results = await sequelize.query(`
            SELECT
                c.id,
                c.name,
                c.code,
                cy.population,
                cy.freedom_index,
                cy.welcome_index
            FROM countries c
            LEFT JOIN country_year_index_data cy
              ON cy.country_id = c.id
             AND cy.year = :year
            ORDER BY c.name
        `, {
            replacements: { year },
            type: sequelize.QueryTypes.SELECT
        });

        const data = results.map((row, idx) => ({
            rank: idx + 1,
            country: row.name,
            code: row.code,
            population: row.population || "",
            freedomIndex: row.freedom_index || "",
            welcomeIndex: row.welcome_index || "",
        }));

        res.json({ year: Number(year), data });
    } catch (err) {
        console.error("Summary error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ====================================================
// 2️⃣ GET FULL VISA DATA FOR A COUNTRY + YEAR
// ====================================================
app.get("/api/visa/:year/:countryCode", async (req, res) => {
    const year = parseInt(req.params.year);
    const countryCode = req.params.countryCode.toUpperCase();

    console.log(`\n=== Fetching visa data for ${countryCode} in ${year} ===`);

    try {
        // 1. Get world population for the year
        const worldResults = await sequelize.query(
            `SELECT world_population FROM years WHERE year = :year`,
            { replacements: { year }, type: sequelize.QueryTypes.SELECT }
        );

        const worldPopulation = worldResults.length > 0
            ? safeNumber(worldResults[0].world_population)
            : 0;

        console.log(`World population: ${worldPopulation}`);

        // 2. Get country information
        const countryResults = await sequelize.query(
            `
            SELECT
                c.id,
                c.name,
                c.code,
                cy.population,
                cy.freedom_index,
                cy.welcome_index
            FROM countries c
            LEFT JOIN country_year_index_data cy
              ON cy.country_id = c.id
             AND cy.year = :year
            WHERE c.code = :countryCode
            `,
            {
                replacements: { year, countryCode },
                type: sequelize.QueryTypes.SELECT
            }
        );

        if (countryResults.length === 0) {
            return res.status(404).json({ error: "Country not found" });
        }

        const country = countryResults[0];
        console.log(`Found country: ${country.name} (ID: ${country.id}, Code: ${country.code})`);

        const countryPopulation = safeNumber(country.population);
        const worldPopulationIndex = formatPopulationIndex(countryPopulation, worldPopulation);

        // 3. CITIZENS TRAVELING ABROAD: Indian citizens going to other countries
        // India → Other countries
        console.log(`\n=== CITIZENS TRAVELING ABROAD (${country.name} → Other countries) ===`);

        const citizensTravelingAbroad = await sequelize.query(
            `
            SELECT
                tc.name AS to_country,
                tc.code AS to_code,
                cyd.population,
                vm.visa_free
            FROM visa_matrix vm
            JOIN countries fc ON fc.id = vm.from_country_id
            JOIN countries tc ON tc.id = vm.to_country_id
            LEFT JOIN country_year_index_data cyd
              ON cyd.country_id = tc.id AND cyd.year = :year
            JOIN years y ON y.id = vm.year_id
            WHERE fc.code = :countryCode
              AND y.year = :year
            ORDER BY tc.name
            `,
            {
                replacements: { year, countryCode },
                type: sequelize.QueryTypes.SELECT
            }
        );

        console.log(`Total destinations: ${citizensTravelingAbroad.length}`);

        const citizensVisaFree = [];
        const citizensVisaRequired = [];

        citizensTravelingAbroad.forEach(row => {
            const pop = safeNumber(row.population);
            const wpIndex = formatPopulationIndex(pop, worldPopulation);

            const entry = {
                country: row.to_country,
                code: row.to_code,
                population: row.population || "",
                world_population_index: wpIndex,
            };

            // Debug: Log Bangladesh specifically
            if (row.to_code === 'BD' || row.to_country.toLowerCase().includes('bangladesh')) {
                console.log(`  ${country.name} → ${row.to_country}: visa_free = ${row.visa_free}`);
            }

            if (row.visa_free === true) {
                citizensVisaFree.push(entry);
            } else {
                citizensVisaRequired.push(entry);
            }
        });

        console.log(`Visa-free destinations: ${citizensVisaFree.length}`);
        console.log(`Visa-required destinations: ${citizensVisaRequired.length}`);

        // 4. VISITORS COMING IN: Citizens of other countries visiting India
        // Other countries → India
        console.log(`\n=== VISITORS COMING IN (Other countries → ${country.name}) ===`);

        const visitorsComingIn = await sequelize.query(
            `
            SELECT
                fc.name AS from_country,
                fc.code AS from_code,
                cyd.population,
                vm.visa_free
            FROM visa_matrix vm
            JOIN countries fc ON fc.id = vm.from_country_id
            JOIN countries tc ON tc.id = vm.to_country_id
            LEFT JOIN country_year_index_data cyd
              ON cyd.country_id = fc.id AND cyd.year = :year
            JOIN years y ON y.id = vm.year_id
            WHERE tc.code = :countryCode
              AND y.year = :year
            ORDER BY fc.name
            `,
            {
                replacements: { year, countryCode },
                type: sequelize.QueryTypes.SELECT
            }
        );

        console.log(`Total source countries: ${visitorsComingIn.length}`);

        const visaFreeForVisitors = [];
        const visaRequiredForVisitors = [];

        visitorsComingIn.forEach(row => {
            const pop = safeNumber(row.population);
            const wpIndex = formatPopulationIndex(pop, worldPopulation);

            const entry = {
                country: row.from_country,
                code: row.from_code,
                population: row.population || "",
                world_population_index: wpIndex,
            };

            // Debug: Log Bangladesh specifically
            if (row.from_code === 'BD' || row.from_country.toLowerCase().includes('bangladesh')) {
                console.log(`  ${row.from_country} → ${country.name}: visa_free = ${row.visa_free}`);
            }

            if (row.visa_free === true) {
                visaFreeForVisitors.push(entry);
            } else {
                visaRequiredForVisitors.push(entry);
            }
        });

        console.log(`Visa-free visitors: ${visaFreeForVisitors.length}`);
        console.log(`Visa-required visitors: ${visaRequiredForVisitors.length}`);

        // 5. Build final response
        const response = {
            year: Number(year),
            data: [
                {
                    rank: 1,
                    country: country.name,
                    code: country.code,
                    population: country.population || "",
                    freedomIndex: country.freedom_index || "",
                    welcomeIndex: country.welcome_index || "",
                    world_population_index: worldPopulationIndex,
                },
            ],
            countries: {
                [country.name.toLowerCase()]: {
                    name: country.name,
                    code: country.code,
                    population: country.population || "",
                    freedomIndex: country.freedom_index || "",
                    welcomeIndex: country.welcome_index || "",
                    world_population_index: worldPopulationIndex,
                    citizensVisaFree,
                    citizensVisaRequired,
                    visaFreeForVisitors,
                    visaRequiredForVisitors,
                },
            },
            summary: {
                outgoing: {
                    total: citizensTravelingAbroad.length,
                    visaFree: citizensVisaFree.length,
                    visaRequired: citizensVisaRequired.length
                },
                incoming: {
                    total: visitorsComingIn.length,
                    visaFree: visaFreeForVisitors.length,
                    visaRequired: visaRequiredForVisitors.length
                }
            }
        };

        console.log(`\n=== RESPONSE SUMMARY ===`);
        console.log(`Outgoing (citizens): ${citizensVisaFree.length} visa-free, ${citizensVisaRequired.length} visa-required`);
        console.log(`Incoming (visitors): ${visaFreeForVisitors.length} visa-free, ${visaRequiredForVisitors.length} visa-required`);

        res.json(response);
    } catch (err) {
        console.error("Country API error:", err);
        res.status(500).json({ error: "Internal server error", details: err.message });
    }
});

// ====================================================
// 3️⃣ DEBUG ENDPOINT: Check specific visa relationships
// ====================================================
// Add this debug endpoint to your api.js
app.get("/api/debug/raw-data/:year/:countryCode", async (req, res) => {
    const year = parseInt(req.params.year);
    const countryCode = req.params.countryCode.toUpperCase();

    try {
        console.log(`\n=== DEBUG RAW DATA CHECK ===`);

        // 1. Check what's in years table
        const yearsData = await sequelize.query(
            `SELECT id, year, world_population FROM years WHERE year = :year`,
            { replacements: { year }, type: sequelize.QueryTypes.SELECT }
        );
        console.log(`Years table:`, yearsData);

        // 2. Check the specific country
        const countryData = await sequelize.query(
            `SELECT id, name, code FROM countries WHERE code = :countryCode`,
            { replacements: { countryCode }, type: sequelize.QueryTypes.SELECT }
        );
        console.log(`Country data:`, countryData);

        if (countryData.length === 0) {
            return res.json({ error: "Country not found" });
        }

        const country = countryData[0];
        const yearRecord = yearsData[0];

        // 3. Check Bangladesh specifically
        const bangladeshData = await sequelize.query(
            `SELECT id, name, code FROM countries WHERE code = 'BD' OR name ILIKE '%bangladesh%'`,
            { type: sequelize.QueryTypes.SELECT }
        );
        console.log(`Bangladesh data:`, bangladeshData);

        // 4. Check ALL visa records from Bangladesh to India
        const bangladeshToIndiaAll = await sequelize.query(
            `
            SELECT vm.*, y.year, fc.name as from_country, tc.name as to_country 
            FROM visa_matrix vm
            JOIN countries fc ON fc.id = vm.from_country_id
            JOIN countries tc ON tc.id = vm.to_country_id
            JOIN years y ON y.id = vm.year_id
            WHERE fc.code = 'BD' 
              AND tc.code = :countryCode
            ORDER BY y.year
            `,
            { replacements: { countryCode }, type: sequelize.QueryTypes.SELECT }
        );
        console.log(`All Bangladesh → ${country.name} records:`, bangladeshToIndiaAll);

        // 5. Check visa record for specific year
        const bangladeshToIndiaYear = await sequelize.query(
            `
            SELECT 
                vm.from_country_id,
                vm.to_country_id,
                vm.year_id,
                vm.visa_free,
                fc.name as from_country,
                tc.name as to_country,
                y.year
            FROM visa_matrix vm
            JOIN countries fc ON fc.id = vm.from_country_id
            JOIN countries tc ON tc.id = vm.to_country_id
            JOIN years y ON y.id = vm.year_id
            WHERE fc.code = 'BD' 
              AND tc.code = :countryCode
              AND y.year = :year
            `,
            { replacements: { year, countryCode }, type: sequelize.QueryTypes.SELECT }
        );
        console.log(`Bangladesh → ${country.name} for ${year}:`, bangladeshToIndiaYear);

        // 6. Check ALL visa records from India to Bangladesh
        const indiaToBangladeshYear = await sequelize.query(
            `
            SELECT 
                vm.from_country_id,
                vm.to_country_id,
                vm.year_id,
                vm.visa_free,
                fc.name as from_country,
                tc.name as to_country,
                y.year
            FROM visa_matrix vm
            JOIN countries fc ON fc.id = vm.from_country_id
            JOIN countries tc ON tc.id = vm.to_country_id
            JOIN years y ON y.id = vm.year_id
            WHERE fc.code = :countryCode
              AND tc.code = 'BD'
              AND y.year = :year
            `,
            { replacements: { year, countryCode }, type: sequelize.QueryTypes.SELECT }
        );
        console.log(`${country.name} → Bangladesh for ${year}:`, indiaToBangladeshYear);

        // 7. Check if there are multiple entries
        const checkDuplicates = await sequelize.query(
            `
            SELECT COUNT(*) as count, from_country_id, to_country_id, year_id
            FROM visa_matrix 
            WHERE (from_country_id = :bdId AND to_country_id = :inId)
               OR (from_country_id = :inId AND to_country_id = :bdId)
            GROUP BY from_country_id, to_country_id, year_id
            HAVING COUNT(*) > 1
            `,
            {
                replacements: {
                    bdId: bangladeshData[0]?.id,
                    inId: country.id
                },
                type: sequelize.QueryTypes.SELECT
            }
        );
        console.log(`Duplicate check:`, checkDuplicates);

        // 8. Direct table scan for these IDs
        const directTableScan = await sequelize.query(
            `
            SELECT * FROM visa_matrix 
            WHERE (from_country_id = :bdId AND to_country_id = :inId)
               OR (from_country_id = :inId AND to_country_id = :bdId)
            ORDER BY from_country_id, to_country_id, year_id
            `,
            {
                replacements: {
                    bdId: bangladeshData[0]?.id,
                    inId: country.id
                },
                type: sequelize.QueryTypes.SELECT
            }
        );
        console.log(`Direct table scan:`, directTableScan);

        res.json({
            year,
            country: country,
            bangladesh: bangladeshData[0],
            yearRecord: yearRecord,
            bangladeshToIndia: {
                description: "Bangladesh → India",
                forYear: bangladeshToIndiaYear,
                allYears: bangladeshToIndiaAll
            },
            indiaToBangladesh: {
                description: "India → Bangladesh",
                forYear: indiaToBangladeshYear
            },
            duplicates: checkDuplicates,
            rawData: directTableScan,
            notes: "Check console for detailed logs"
        });

    } catch (err) {
        console.error("Debug error:", err);
        res.status(500).json({ error: "Internal server error", details: err.message });
    }
});




// ====================================================
// CONTACT FORM SUBMIT ENDPOINT
// ====================================================
app.post('/api/contact/submit', async (req, res) => {
    try {
        const { fullName, email, subject, message } = req.body;

        console.log('📧 Contact form submission received');

        // Basic validation
        if (!fullName?.trim() || fullName.length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Name must be at least 2 characters'
            });
        }

        if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Valid email is required'
            });
        }

        if (!subject?.trim() || subject.length < 5) {
            return res.status(400).json({
                success: false,
                message: 'Subject must be at least 5 characters'
            });
        }

        if (!message?.trim() || message.length < 20) {
            return res.status(400).json({
                success: false,
                message: 'Message must be at least 20 characters'
            });
        }

        // SIMPLE save without any timestamp fields
        const contact = await Contact.create({
            fullName: fullName.trim(),
            email: email.trim(),
            subject: subject.trim(),
            message: message.trim()
        });

        console.log('✅ Contact form saved to database with ID:', contact.id);

        res.status(201).json({
            success: true,
            message: 'Thank you for your message! We will get back to you within 24-48 hours.',
            data: {
                id: contact.id
            }
        });

    } catch (error) {
        console.error('❌ Error submitting contact form:', error);

        // Simplified error handling
        if (error.name === 'SequelizeDatabaseError' && error.parent?.code === '42703') {
            // This means column doesn't exist - we need to fix the table
            console.error('Database column mismatch! Check table structure.');
        }

        res.status(500).json({
            success: false,
            message: 'Internal server error. Please try again later.'
        });
    }
});



// GET VFFI for all years
app.get("/api/vffi", async (req, res) => {
    try {
        const yearsData = await Year.findAll({
            attributes: ["year", "vffi", ["world_population", "worldPopulation"]],
            order: [["year", "ASC"]]
        });

        const formatted = yearsData.map(y => {
            // Convert vffi to a number safely
            let vffiNum = parseFloat(y.vffi);
            if (isNaN(vffiNum)) vffiNum = 0;

            return {
                year: y.year,
                vffi: vffiNum.toFixed(2),
                worldPopulation: y.worldPopulation
            };
        });

        res.json(formatted);
    } catch (err) {
        console.error("Error fetching VFFI data:", err);
        res.status(500).json({ error: err.message });
    }
});


// ====================================================
// GET all years data for a specific country
// ====================================================
app.get("/api/country/:countryCode/freedom-index", async (req, res) => {
    const countryCode = req.params.countryCode.toUpperCase();

    try {
        // 1️⃣ Get the country ID first
        const countryResults = await sequelize.query(
            `SELECT id, name, code FROM countries WHERE code = :countryCode`,
            {
                replacements: { countryCode },
                type: sequelize.QueryTypes.SELECT
            }
        );

        if (countryResults.length === 0) {
            return res.status(404).json({ error: `Country not found: ${countryCode}` });
        }

        const country = countryResults[0];

        // 2️⃣ Get all years data for this country
        const dataResults = await sequelize.query(
            `
            SELECT year, population, freedom_index, welcome_index
            FROM country_year_index_data
            WHERE country_id = :countryId
            ORDER BY year ASC
            `,
            {
                replacements: { countryId: country.id },
                type: sequelize.QueryTypes.SELECT
            }
        );

        // 3️⃣ Format response
        const response = {
            country: {
                id: country.id,
                code: country.code,
                name: country.name
            },
            data: dataResults.map(row => ({
                year: row.year,
                population: row.population || 0,
                freedomIndex: row.freedom_index || 0,
                welcomeIndex: row.welcome_index || 0
            }))
        };

        res.json(response);
    } catch (err) {
        console.error("Error fetching country freedom index data:", err);
        res.status(500).json({ error: "Internal server error", details: err.message });
    }
});


// ====================================================
// START SERVER
// ====================================================
const startServer = async () => {
    try {
        await sequelize.authenticate();
        console.log("✅ Database connected successfully");

        app.listen(PORT, () => {
            console.log(`\n✅ Server running at http://localhost:${PORT}`);
            console.log(`📊 All countries for 2006: http://localhost:${PORT}/api/visa/2006`);
            console.log(`🇮🇳 India full data: http://localhost:${PORT}/api/visa/2006/IN`);
            console.log(`🔍 Debug India: http://localhost:${PORT}/api/debug/visa/2006/IN`);
        });
    } catch (error) {
        console.error("❌ Failed to start server:", error);
        process.exit(1);
    }
};

startServer();