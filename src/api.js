import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import rateLimit from 'axios-rate-limit';
import { addSeconds } from 'date-fns';
import dotenv from 'dotenv';
import sha256 from 'crypto-js/sha256.js';
import Base64 from 'crypto-js/enc-base64.js';

dotenv.config();

let instance = null;
let tokenExpiresAt = null;
let tokenAquiredAt = null;

const email = process.env.IRACING_USERNAME;
const password = process.env.IRACING_PASSWORD;
const clientId = process.env.IRACING_CLIENT_ID;
const clientSecret = process.env.IRACING_CLIENT_SECRET;

const hashSecret = (id, secret) => {
    const hash = sha256(secret + id.toLowerCase());
    return Base64.stringify(hash);
};

const getAuthenticatedInstance = async () => {
    if (!instance || Date.now() >= tokenExpiresAt) {
        const authData = await auth();
        instance = authData.instance;
        tokenAquiredAt = new Date();
        tokenExpiresAt = addSeconds(tokenAquiredAt, authData.expiresIn);
    }
    return instance;
};
const api = {
    get: async (url, params) => {
        const instance = await getAuthenticatedInstance();
        return instance.get(url, params);
    },
};

const auth = async () => {
    const data = new URLSearchParams();
    data.append('grant_type', 'password_limited');
    data.append('client_id', clientId);
    data.append('username', email);
    data.append('password', hashSecret(email, password));
    data.append('client_secret', hashSecret(clientId, clientSecret));
    data.append('scope', 'iracing.auth');
    const response = await axios.post('https://oauth.iracing.com/oauth2/token', data, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    });

    const accessToken = response.data.access_token;
    const tokenType = response.data.token_type;
    const expiresIn = response.data.expires_in;

    const instance = wrapper(
        rateLimit(
            axios.create({
                baseURL: 'https://members-ng.iracing.com',
                headers: {
                    Authorization: `${tokenType} ${accessToken}`,
                },
            }),
            { maxRPS: 5 }
        )
    );
    return { instance, expiresIn };
};

export default api;
