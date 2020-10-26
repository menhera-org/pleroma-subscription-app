
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

app.get('/register-app/:domain', async (req, res) => {
    //
    try {
        const domain = req.params.domain;
        const client = generator('pleroma', 'https://' + domain);
        const appData = await client.registerApp('Pleroma Subscription App ' + uuidv4(), {
            redirect_uris: [
                APP_BASE + '/registration-callback',
            ],
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
        res.status(400).json(error);
    }
});

app.get('/registration-callback', async (req, res) => {
    //
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
});

app.get('/subscribe/:id', async (req, res) => {
    const {accessToken, domain} = getCookies(req.headers.cookie);
    const client = generator('pleroma', 'https://' + domain, accessToken);
    await client.subscribeAccount(req.params.id);
    res.redirect('/app/');
});

app.get('/unsubscribe/:id', async (req, res) => {
    const {accessToken, domain} = getCookies(req.headers.cookie);
    const client = generator('pleroma', 'https://' + domain, accessToken);
    await client.unsubscribeAccount(req.params.id);
    res.redirect('/app/');
});

app.get('/assets/:name', async (req, res) => {
    const name = req.params.name.split('/').pop();
    res.contentType(name).sendFile(__dirname + '/assets/' + name);
});

app.get('/app/', async (req, res) => {
    //
    const doc = new Document;
    const {accessToken, domain} = getCookies(req.headers.cookie);
    const client = generator('pleroma', 'https://' + domain, accessToken);
    const me = (await client.verifyAccountCredentials()).data;
    const following = (await client.getAccountFollowing(me.id)).data;
    doc.title = 'My following';
    const script = doc.createElement('script');
    doc.head.appendChild(script);
    script.setAttribute('type', 'module');
    script.setAttribute('src', '/assets/main.mjs');
    const h1 = doc.createElement('h1');
    doc.body.appendChild(h1);
    h1.textContent = 'My followings';
    for (const user of following) {
        //
        const p = document.createElement('p');
        document.body.appendChild(p);
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
});


app.listen(PORT, () => {
    //
    console.log('listening...');
});
