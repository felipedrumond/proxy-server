const fetch = require('node-fetch');
const https = require('https');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const cors = require('cors');
const express = require('express');
const { magenta, green, yellow } = require('colorette');

const allowedOrigins = ['http://localhost:4200', 'https://data-inspector.vercel.app'];

const app = express();

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    next();
});
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.log(magenta(`Origin not allowed by CORS: ${origin}`));
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

function logReceivedRequest(url, verb, body, headers) {
    console.log(magenta('---------------------------------------------'));
    console.log(green('Received request:'));
    console.log(green(verb), green(url));
    console.log('headers', green(JSON.stringify(headers, null, "\t")));
    console.log('body', green(JSON.stringify(body, null, "\t")));
}

function logRequestToRemoteServer(verb, url, requestToRemoteServer) {
    console.log(yellow('Requesting to remote server:'));
    console.log(yellow(verb), yellow(url));
    console.log('headers', yellow(JSON.stringify(requestToRemoteServer.headers, null, "\t")));
    console.log('body', yellow(JSON.stringify(requestToRemoteServer.body, null, "\t")));
}

function logRemoteResponse(remoteResponse) {
    console.log(yellow('Received remote response:'));
    console.log('status', yellow(remoteResponse.status));
}

// POST /api/request Endpoint
app.post('/api/request', async (req, res) => {
    console.clear();
    const { url, verb, body, headers } = req.body;

    logReceivedRequest(url, verb, body, headers);

    // let cookiesHeader = '';
    // if (Object.keys(req.cookies).length > 0) {
    //     cookiesHeader = Object.entries(req.cookies)
    //         .map(([key, value]) => `${key}=${value}`)
    //         .join('; ');
    // }

    try {
        const requestOptionsToRemoteServer = {
            method: verb,
            headers: {
                // 'Cookie': cookiesHeader,
                ...headers
            },
            body: verb !== 'GET' ? JSON.stringify(body) : undefined,
            agent: url.startsWith('https:') ? agent : null, // Ignore SSL certificate errors
        };

        // delete requestOptionsToRemoteServer['Content-Length'];
        // delete requestOptionsToRemoteServer['cookie'];

        logRequestToRemoteServer(verb, url, requestOptionsToRemoteServer);
        const remoteServerResponse = await fetch(url, requestOptionsToRemoteServer);

        const responseText = await remoteServerResponse.text();

        // Forward Set-Cookie headers from External API
        // const incomingCookies = remoteServerResponse.headers.raw()['set-cookie'];
        // if (incomingCookies) {
        //     // console.log('Incoming Cookies from External API:', incomingCookies);
        //     incomingCookies.forEach((cookieString) => {
        //         res.append('Set-Cookie', cookieString);
        //     });
        // }

        logRemoteResponse(remoteServerResponse);
        res.status(remoteServerResponse.status).send(responseText);
    } catch (error) {
        console.error('Error during proxying:', error);

        // Check if the error is a timeout error
        if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED')
            res.status(408).send({ error: 'Request to remove server timed out' });

        // If the error has a status property, use it
        else if (error.status)
            res.status(error.status).send({ error: error.message || 'Error' });

        // Fallback to 500 Internal Server Error for all other cases
        else
            res.status(500).send({ error });
    }
});

// Default GET Endpoint
app.get('/', (req, res) => {
    res.status(400).send("GET is not supported; use POST instead.");
});


// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(magenta(`PROXY_SERVER: running on http://localhost:${PORT}`));
});
