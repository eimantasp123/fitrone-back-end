const crypto = require("crypto");

const email = "eimiuxxx09@gmail.com"; // change this
const emailHash = crypto.createHash("sha256").update(email).digest("hex");

console.log("emailHash:", emailHash);
