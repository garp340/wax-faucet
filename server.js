const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');

const { Api, JsonRpc } = require('eosjs');
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');

const {
    TextEncoder,
    TextDecoder
} = require('util');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PRIVATE_KEY = (process.env.WAX_PRIVATE_KEY || '').trim();

const FAUCET_ACCOUNT = (process.env.WAX_FAUCET_ACCOUNT || '')
    .trim()
    .toLowerCase();

const WAX_ENDPOINT =
    (process.env.WAX_ENDPOINT || 'https://wax.greymass.com').trim();

const PORT = process.env.PORT || 3000;

const CLAIM_AMOUNT = '0.01000000 WAX';
const TOKEN_CONTRACT = 'eosio.token';
const COOLDOWN_MS = 60 * 60 * 1000;

const claims = new Map();

function configurationOK() {
    return PRIVATE_KEY.length > 0 &&
           FAUCET_ACCOUNT.length > 0;
}

app.get('/api/status', (req, res) => {
    res.json({
        online: true,
        configured: configurationOK(),
        faucetAccount: FAUCET_ACCOUNT || null,
        endpoint: WAX_ENDPOINT,
        amount: CLAIM_AMOUNT
    });
});

app.post('/api/claim', async (req, res) => {
    try {
        if (!PRIVATE_KEY) {
            console.error('Falta WAX_PRIVATE_KEY');

            return res.status(500).json({
                success: false,
                error: 'El servidor no tiene configurada WAX_PRIVATE_KEY.'
            });
        }

        if (!FAUCET_ACCOUNT) {
            console.error('Falta WAX_FAUCET_ACCOUNT');

            return res.status(500).json({
                success: false,
                error: 'El servidor no tiene configurada WAX_FAUCET_ACCOUNT.'
            });
        }

        let userAccount = req.body.userAccount;

        if (typeof userAccount !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Introduce una cuenta WAX.'
            });
        }

        userAccount = userAccount.trim().toLowerCase();

        if (!/^[a-z1-5.]{1,12}$/.test(userAccount)) {
            return res.status(400).json({
                success: false,
                error: 'La cuenta WAX no tiene un formato válido.'
            });
        }

        if (userAccount === FAUCET_ACCOUNT) {
            return res.status(400).json({
                success: false,
                error: 'No puedes reclamar en la cuenta del faucet.'
            });
        }

        const now = Date.now();
        const previousClaim = claims.get(userAccount);

        if (previousClaim && now - previousClaim < COOLDOWN_MS) {
            const remaining = Math.ceil(
                (COOLDOWN_MS - (now - previousClaim)) / 60000
            );

            return res.status(429).json({
                success: false,
                error:
                    'Ya has reclamado. Espera ' +
                    remaining +
                    ' minuto(s).'
            });
        }

        const rpc = new JsonRpc(WAX_ENDPOINT, { fetch });

        const signatureProvider =
            new JsSignatureProvider([PRIVATE_KEY]);

        const api = new Api({
            rpc,
            signatureProvider,
            textEncoder: new TextEncoder(),
            textDecoder: new TextDecoder()
        });

        console.log(
            'Enviando ' +
            CLAIM_AMOUNT +
            ' a ' +
            userAccount
        );

        const result = await api.transact(
            {
                actions: [
                    {
                        account: TOKEN_CONTRACT,
                        name: 'transfer',
                        authorization: [
                            {
                                actor: FAUCET_ACCOUNT,
                                permission: 'active'
                            }
                        ],
                        data: {
                            from: FAUCET_ACCOUNT,
                            to: userAccount,
                            quantity: CLAIM_AMOUNT,
                            memo: 'WAX Faucet'
                        }
                    }
                ]
            },
            {
                blocksBehind: 3,
                expireSeconds: 30
            }
        );

        claims.set(userAccount, Date.now());

        console.log(
            'Claim correcto: ' +
            result.transaction_id
        );

        return res.json({
            success: true,
            amount: CLAIM_AMOUNT,
            account: userAccount,
            transaction: result.transaction_id
        });

    } catch (error) {
        console.error('ERROR:', error);

        let message = 'Error realizando la transferencia.';

        if (
            error &&
            error.json &&
            error.json.error &&
            error.json.error.details &&
            error.json.error.details.length > 0
        ) {
            message = error.json.error.details[0].message;
        } else if (error && error.message) {
            message = error.message;
        }

        return res.status(500).json({
            success: false,
            error: message
        });
    }
});

app.listen(PORT, () => {
    console.log('');
    console.log('================================');
    console.log('       WAX FAUCET ONLINE');
    console.log('================================');

    console.log(
        'Cuenta:',
        FAUCET_ACCOUNT || 'NO CONFIGURADA'
    );

    console.log(
        'Endpoint:',
        WAX_ENDPOINT
    );

    console.log(
        'Private key:',
        PRIVATE_KEY ? 'CONFIGURADA' : 'NO CONFIGURADA'
    );

    console.log(
        'Puerto:',
        PORT
    );

    console.log('================================');
    console.log('');
});
