import rateLimit from "axios-rate-limit";
import axios from "axios";
import { wrapper } from "axios-cookiejar-support";
import Base64 from 'crypto-js/enc-base64.js';
import sha256 from 'crypto-js/sha256.js';
import { CookieJar } from "tough-cookie";

const jar = new CookieJar();
const email = process.env.IRACING_USERNAME;
const password = process.env.IRACING_PASSWORD;


const hash = sha256(password + email.toLowerCase());
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
 export const auth = async () => {
  await instance.post("/auth", {
    email,
    password: hashInBase64
  });

  return instance;
};