const fetch = require('node-fetch');
const https = require('https');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const cors = require('cors');
const express = require('express');
const { magenta } = require('colorette');

const allowedOrigins = ['http://localhost:4200', 'https://data-inspector.vercel.app'];

const app = express();

// Middleware Setup
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use(cookieParser());
app.use(bodyParser.json());

// HTTPS Agent to Ignore SSL Certificate Errors (Use with Caution)
const agent = new https.Agent({
    rejectUnauthorized: false,
});

// POST /api/request Endpoint
app.post('/api/request', async (req, res) => {
    console.log(magenta('---------------------------------------------'));
    const { url, verb, body } = req.body;

    let cookiesHeader = '';
    if (Object.keys(req.cookies).length > 0) {
        console.log(req.cookies);
        cookiesHeader = Object.entries(req.cookies)
            .map(([key, value]) => `${key}=${value}`)
            .join('; ');

        console.log(magenta('PROXY_SERVER: Cookies received in the request by proxy server:'));
        console.log(cookiesHeader);
    }

    try {
        console.log(`Proxying ${verb} request to: ${url}`);

        const remoteServerResponse = await fetch(url, {
            method: verb,
            headers: {
                'Content-Type': 'application/json',
                'Cookie': cookiesHeader,
            },
            body: verb !== 'GET' ? JSON.stringify(body) : undefined,
            agent: url.startsWith('https:') ? agent : null, // Ignore SSL certificate errors
        });

        console.log(`Received response from external API with status: ${remoteServerResponse.status}`);

        const responseText = await remoteServerResponse.text();

        // Forward Set-Cookie headers from External API
        const incomingCookies = remoteServerResponse.headers.raw()['set-cookie'];
        if (incomingCookies) {
            console.log('Incoming Cookies from External API:', incomingCookies);
            incomingCookies.forEach((cookieString) => {
                res.append('Set-Cookie', cookieString);
            });
        }

        res.status(remoteServerResponse.status).send(responseText);
        console.log('Response sent to client successfully.');
    } catch (error) {
        console.error('Error during proxying:', error);
        res.status(500).send({ error });
    }
});

// Default GET Endpoint
app.get('/', (req, res) => {
    res.status(200).send({
        objects: [
            {
                name: "vercel"
            }
        ]
    });
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(magenta(`PROXY_SERVER: running on http://localhost:${PORT}`));
});
