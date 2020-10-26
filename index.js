
const PORT = process.env.PORT || 8080;
const APP_BASE = process.env.APP_BASE || 'http://localhost:' + PORT;

const express = require('express');
const app = express();

const {Document} = require('void-template');

const {v4: uuidv4} = require('uuid');

const generator = require('megalodon').default;
const {Pleroma, OAuth} = require('megalodon');

const client = generator('pleroma');

const getCookies = headerValue => {
    const cookies = Object.create(null);
    const fields = String(headerValue || '').split('; ');
    for (const field of fields) {
        const matches = field.match(/^([^=]+)=(.*)$/);
        if (!matches) continue;
        cookies[matches[1]] = matches[2];
    }
    return cookies;
};

app.get('/register-app/:domain?', async (req, res) => {
    //
    try {
        const domain = req.params.domain || req.query.domain;
        const client = generator('pleroma', 'https://' + domain);
        const appData = await client.registerApp('Pleroma Subscription App ' + uuidv4(), {
            redirect_uris: APP_BASE + '/registration-callback',
            scopes: [
                'read',
                'write',
                'follow',
            ],
        });
        const {url, clientId, clientSecret} = appData;
        res.cookie('clientId', clientId, {
            maxAge: 1000 * 3600 * 24,
            secure: true,
        });
        res.cookie('clientSecret', clientSecret, {
            maxAge: 1000 * 3600 * 24,
            secure: true,
        });
        res.cookie('domain', domain, {
            maxAge: 1000 * 3600 * 24,
            secure: true,
        });
        res.redirect(url);
    } catch (error) {
        //
        console.error(error);
        res.status(400).json(error);
    }
});

app.get('/registration-callback', async (req, res) => {
    //
    try {
        const {domain, clientId, clientSecret} = getCookies(req.headers.cookie);
        const client = generator('pleroma', 'https://' + domain);
        const code = req.query.code;
        const {accessToken, refreshToken} = await client.fetchAccessToken(clientId, clientSecret, code);
        res.cookie('accessToken', accessToken, {
            maxAge: 1000 * 3600 * 24,
            secure: true,
        });
        res.cookie('refreshToken', refreshToken, {
            maxAge: 1000 * 3600 * 24,
            secure: true,
        });
        res.redirect('/app/');
    } catch (error) {
        //
        console.error(error);
        res.status(400).json(error);
    }
});

app.get('/subscribe/:id', async (req, res) => {
    try {
        const {accessToken, domain} = getCookies(req.headers.cookie);
        const client = generator('pleroma', 'https://' + domain, accessToken);
        await client.subscribeAccount(req.params.id);
        res.redirect('/app/');
    } catch (error) {
        //
        console.error(error);
        res.status(400).json(error);
    }
});

app.get('/unsubscribe/:id', async (req, res) => {
    try {
        const {accessToken, domain} = getCookies(req.headers.cookie);
        const client = generator('pleroma', 'https://' + domain, accessToken);
        await client.unsubscribeAccount(req.params.id);
        res.redirect('/app/');
    } catch (error) {
        //
        console.error(error);
        res.status(400).json(error);
    }
});

app.get('/assets/:name', async (req, res) => {
    try {
        const name = req.params.name.split('/').pop();
        res.contentType(name).sendFile(__dirname + '/assets/' + name);
    } catch (error) {
        //
        console.error(error);
        res.status(400).json(error);
    }
});

app.get('/app/', async (req, res) => {
    try {
        //
        const doc = new Document;
        const {accessToken, domain} = getCookies(req.headers.cookie);
        const client = generator('pleroma', 'https://' + domain, accessToken);
        const me = (await client.verifyAccountCredentials()).data;
        const following = (await client.getAccountFollowing(me.id)).data;
        doc.title = 'My following';
        const script = doc.createElement('script');
        doc.head.append(script);
        script.setAttribute('type', 'module');
        script.setAttribute('src', '/assets/main.mjs');
        const h1 = doc.createElement('h1');
        doc.body.append(h1);
        h1.textContent = 'My followings';
        for (const user of following) {
            const p = doc.createElement('p');
            doc.body.append(p);
            p.append('#' + user.id + ' ');
            p.append('@' + user.username + ' ');
            p.append('"' + user.display_name + '" ');
            const subscribe = doc.createElement('a');
            p.append(subscribe, ' ');
            subscribe.append('Subscribe');
            subscribe.setAttribute('href', '/subscribe/' + user.id);
            const unsubscribe = doc.createElement('a');
            p.append(unsubscribe);
            unsubscribe.append('Unsubscribe');
            unsubscribe.setAttribute('href', '/unsubscribe/' + user.id);
        }
        res.contentType('html').send(doc + '');
    } catch (error) {
        //
        console.error(error);
        res.status(400).json(error);
    }
});

app.get('/', async (req, res) => {
    //
    try {
        //
        const doc = new Document;
        doc.title = 'Sign in to an instance';
        const h1 = doc.createElement('h1');
        h1.append('Sign in to an instance');
        doc.body.append(h1);
        const form = doc.createElement('form');
        doc.body.append(form);
        form.setAttribute('action', '/register-app/');
        const label = doc.createElement('label');
        form.append(label);
        label.append('Instance domain name (not including \'https://\'): ');
        const input = doc.createElement('input');
        input.setAttribute('type', 'text');
        input.setAttribute('name', 'domain');
        label.append(input);
        const button = doc.createElement('button');
        button.append('Sign in');
        form.append(button);
        res.contentType('html').send('' + doc);
    } catch (error) {
        //
        console.error(error);
        res.status(400).json(error);
    }
});


app.listen(PORT, () => {
    //
    console.log('listening...');
});
