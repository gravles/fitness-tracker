const withSerwist = require("@serwist/next").default({
    swSrc: "src/app/sw.ts",
    swDest: "public/sw.js",
    reloadOnOnline: true,
    disable: process.env.NODE_ENV === "development",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactCompiler: true,
};

module.exports = withSerwist(nextConfig);
