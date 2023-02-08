const rateLimit = require("axios-rate-limit");
const axios = require("axios");
const { wrapper } = require("axios-cookiejar-support");

const SHA256 = require("crypto-js/sha256");
const Base64 = require("crypto-js/enc-base64");
const { CookieJar } = require("tough-cookie");

const jar = new CookieJar();
const email = process.env.IRACING_USERNAME;
const password = process.env.IRACING_PASSWORD;


const hash = SHA256(password + email.toLowerCase());
const hashInBase64 = Base64.stringify(hash);

const instance = wrapper(
  rateLimit(
    axios.create({
      withCredentials: true,
      baseURL: "https://members-ng.iracing.com",
      jar
    }),
    { maxRPS: 5 }
  )
);
 const auth = async () => {
  await instance.post("/auth", {
    email,
    password: hashInBase64
  });

  return instance;
};

module.exports = {auth}