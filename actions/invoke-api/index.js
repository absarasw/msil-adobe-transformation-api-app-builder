/*
* <license header>
*/

/**
 * This is a sample action showcasing how to access an external API
 *
 * Note:
 * You might want to disable authentication and authorization checks against Adobe Identity Management System for a generic action. In that case:
 *   - Remove the require-adobe-auth annotation for this action in the manifest.yml of your application
 *   - Remove the Authorization header from the array passed in checkMissingRequestInputs
 *   - The two steps above imply that every client knowing the URL to this deployed action will be able to invoke it without any authentication and authorization checks against Adobe Identity Management System
 *   - Make sure to validate these changes against your security requirements before deploying the action
 */


const fetch = require('node-fetch')
const { Core } = require('@adobe/aio-sdk')
const https = require('https');
const stateLib = require('@adobe/aio-lib-state')



// main function that will be executed by Adobe I/O Runtime
/**
 * This action is used to create secure connection to proxy vm as described in the document
 * https://developer.adobe.com/runtime/docs/guides/reference/configuringproxy/
 * and
 * Also it is being secured as described here
 * https://developer.adobe.com/runtime/docs/guides/using/securing_web_actions/
 *
 * connection to vm can be checked with this curl command
 * curl -ki --cert /etc/nginx/conf.d/mtls_client.crt --key /etc/nginx/conf.d/mtls_client.key https://<vm ip address>/
 *
 */
async function main (params) {
    const logger = Core.Logger('main', { level: params.LOG_LEVEL || 'info' })
    const options = {
        cert: params.__AIO_MTLS_CERT,
        key:  params.__AIO_MTLS_KEY,
        rejectUnauthorized: false, // in test, if you're working with self-signed certificates
        keepAlive: false, // switch to true if you're making a lot of calls from this client
    };


    console.log('Consumer main params:' + params);
    // this is the environment variable of VM
    const PROXY_ENDPOINT = params.PROXY_ENDPOINT;
    const sslConfiguredAgent = new https.Agent(options);

    try {
        // get Auth Token
        const state = await stateLib.init({ region: 'apac' })
        var bearerToken;
        var authToken = await state.get('authToken');
        if (authToken && authToken.value) {
            bearerToken = authToken.value;
        } else {
            const API_KEY = params.__ow_headers['x-require-whisk-auth'];
            // Get Auth token from API EndPoint of MSIL API End point using API_KEY
              const authResponse = await fetch(`https://${PROXY_ENDPOINT}/authToken`, {
                  headers: {
                              'x-api-key': `API_KEY`,
                          },
             })
            bearerToken = authResponse.payload.bearerToken;
            // token expiry is 60 min so being safe we are storing for 55 mins
            await state.put('authToken', bearerToken, { ttl: params.STATE_TTL })

        }

         // replace with actual endpoints of apis bases on actions params
        const queryParams = new URLSearchParams(params).toString();
        const url = `https://${PROXY_ENDPOINT}/apiendpoints/?${queryParams}`;

        console.log(`Making call to: [${url}]`);
        // make the request just as you would normally ...
        const response = await fetch(url, {
            agent: sslConfiguredAgent, // ... but add the agent we initialised
            headers: {
                'Authorization': `Bearer ${bearerToken}`, // Adding Authorization header
                'Content-Type': 'application/json',
            },
            // Uncomment the following line if you're making a POST request and need to send data
            // body: JSON.stringify(params),
        });

        const responseBody = await response.text();

        // handle the response as you would see fit
        console.log(responseBody);
        return { statusCode: 200, body: { resp: responseBody }};
    } catch (error) {
        // return the error
        console.log(error);
        return { statusCode: 418, body: { error: error }};
    }
    return { statusCode: 200, body: { resp: 'complete' }};
}

exports.main = main
