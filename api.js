import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import sequelize from "./db.js";

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