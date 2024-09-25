// api/proxy.js

const fetch = require('node-fetch');
const https = require('https');
const cookieParser = require('cookie-parser');
const { red, green, yellow, blue, magenta, cyan } = require('colorette');

// Initialize middleware-like functions
const bodyParser = require('body-parser');
const cors = require('cors');

const allowedOrigins = ['http://localhost:4200', 'http://MY_UI_ADDRESS.com'];

const agent = new https.Agent({
  rejectUnauthorized: false,
});

module.exports = (req, res) => {
  // Apply CORS middleware
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })(req, res, () => {
    // Parse cookies
    cookieParser()(req, res, () => {
      // Parse body
      bodyParser.json()(req, res, async () => {
        // Handle the request
        if (req.method === 'POST' && req.url === '/api/request') {
          console.log(magenta('---------------------------------------------'));
          const { url, verb, body } = req.body;

          let cookiesHeader = '';
          if (Object.keys(req.cookies).length > 0) {
            console.log(req.cookies);
            cookiesHeader = Object.entries(req.cookies)
              .map(([key, value]) => `${key}=${value}`)
              .join('; ');

            console.log(magenta('PROXY_SERVER: cookies received in the request by proxy server:'));
            console.log(cookiesHeader);
          }

          try {
            const remoteServerResponse = await fetch(url, {
              method: verb,
              headers: {
                'Content-Type': 'application/json',
                Cookie: cookiesHeader,
              },
              body: verb !== 'GET' ? JSON.stringify(body) : undefined,
              agent: url.startsWith('https:') ? agent : null, // Ignore SSL certificate errors
            });

            const responseText = await remoteServerResponse.text();

            // Get the cookies from the response headers
            const incomingCookies = remoteServerResponse.headers.raw()['set-cookie'];

            // Set the cookies for the response
            if (incomingCookies) {
              console.log(incomingCookies);
              incomingCookies.forEach((cookieString) => {
                res.append('Set-Cookie', cookieString);
              });
            }

            res.status(remoteServerResponse.status).send(responseText);
          } catch (error) {
            console.error(error);
            res.status(500).send(error.message);
          }
        } else {
          res.status(200).send({ objects: [
            {
              name: "vercel"
            }
          ] });
        }
      });
    });
  });
};
