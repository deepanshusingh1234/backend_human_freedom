import { Country } from "./Country.js";
import { Year } from "./Year.js";
import { CountryYearIndexData } from "./CountryYearIndexData.js";
import { VisaMatrix } from "./VisaMatrix.js";
import { BlogUser } from "./BlogUser.js";
import { BlogPost } from "./BlogPost.js";
import { PostStat } from "./PostStat.js";
import { PostList } from "./PostList.js";

// Country ↔ CountryYearIndexData associations
Country.hasMany(CountryYearIndexData, {
    foreignKey: "country_id",
    sourceKey: "id"
});

CountryYearIndexData.belongsTo(Country, {
    foreignKey: "country_id",
    targetKey: "id"
});

// Year ↔ CountryYearIndexData (if needed)
Year.hasMany(CountryYearIndexData, {
    foreignKey: "year",
    sourceKey: "year"
});

// Year ↔ VisaMatrix association
Year.hasMany(VisaMatrix, {
    foreignKey: "year_id",
    sourceKey: "id"
});

VisaMatrix.belongsTo(Year, {
    foreignKey: "year_id",
    targetKey: "id"
});

// Country ↔ VisaMatrix associations
Country.hasMany(VisaMatrix, {
    as: "outgoingVisas",
    foreignKey: "from_country_id",
    sourceKey: "id"
});

Country.hasMany(VisaMatrix, {
    as: "incomingVisas",
    foreignKey: "to_country_id",
    sourceKey: "id"
});

VisaMatrix.belongsTo(Country, {
    as: "fromCountry",
    foreignKey: "from_country_id",
    targetKey: "id"
});

VisaMatrix.belongsTo(Country, {
    as: "toCountry",
    foreignKey: "to_country_id",
    targetKey: "id"
});

// Blog Associations
BlogPost.hasMany(PostStat, {
    foreignKey: "post_id",
    as: "stats"
});

PostStat.belongsTo(BlogPost, {
    foreignKey: "post_id"
});

BlogPost.hasMany(PostList, {
    foreignKey: "post_id",
    as: "list"
});

PostList.belongsTo(BlogPost, {
    foreignKey: "post_id"
});

export {
    Country,
    Year,
    CountryYearIndexData,
    VisaMatrix,
    BlogUser,
    BlogPost,
    PostStat,
    PostList
};