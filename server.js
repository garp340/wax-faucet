const express = require('express');
const cors = require('cors');
const { Api, JsonRpc, JsSignatureProvider } = require('eosjs');
const fetch = require('node-fetch');
const { TextEncoder, TextDecoder } = require('util');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Variables de entorno (se configuran en Railway)
const PRIVATE_KEY = process.env.WAX_PRIVATE_KEY;
const FAUCET_ACCOUNT = process.env.WAX_FAUCET_ACCOUNT;
const WAX_ENDPOINT = process.env.WAX_ENDPOINT || 'https://wax.greymass.com';

const CLAIM_AMOUNT = '0.01000000 WAX'; // Exactamente 0.01 WAX
const TOKEN_CONTRACT = 'eosio.token';
const COOLDOWN_MS = 60 * 60 * 1000; // 1 Hora

const lastClaims = new Map();

app.post('/api/claim', async (req, res) => {
    const { userAccount } = req.body;

    if (!PRIVATE_KEY || !FAUCET_ACCOUNT) {
        return res.status(500).json({ error: 'Variables de entorno incompletas en el servidor.' });
    }

    if (!userAccount) {
        return res.status(400).json({ error: 'Proporciona una cuenta WAX.' });
    }

    const cleanAccount = userAccount.trim().toLowerCase();

    // Validar formato de cuenta WAX
    if (!/^[a-z1-5.]{1,12}$/.test(cleanAccount)) {
        return res.status(400).json({ error: 'Formato de cuenta WAX inválido.' });
    }

    // Cooldown de 1 hora
    const now = Date.now();
    const lastClaim = lastClaims.get(cleanAccount);

    if (lastClaim && (now - lastClaim < COOLDOWN_MS)) {
        const remainingMinutes = Math.ceil((COOLDOWN_MS - (now - lastClaim)) / 60000);
        return res.status(429).json({ 
            error: `Ya has reclamado. Vuelve a intentarlo en ${remainingMinutes} minuto(s).` 
        });
    }

    try {
        const rpc = new JsonRpc(WAX_ENDPOINT, { fetch });
        const signatureProvider = new JsSignatureProvider([PRIVATE_KEY]);
        const api = new Api({ 
            rpc, 
            signatureProvider, 
            textDecoder: new TextDecoder(), 
            textEncoder: new TextEncoder() 
        });

        const result = await api.transact({
            actions: [{
                account: TOKEN_CONTRACT,
                name: 'transfer',
                authorization: [{
                    actor: FAUCET_ACCOUNT,
                    permission: 'active',
                }],
                data: {
                    from: FAUCET_ACCOUNT,
                    to: cleanAccount,
                    quantity: CLAIM_AMOUNT,
                    memo: 'Faucet Claim - 0.01 WAX',
                },
            }]
        }, {
            blocksBehind: 3,
            expireSeconds: 30,
        });

        lastClaims.set(cleanAccount, now);

        return res.json({ 
            success: true, 
            txId: result.transaction_id,
            amount: CLAIM_AMOUNT
        });

    } catch (err) {
        console.error('Error enviando WAX:', err);
        return res.status(500).json({ 
            error: err.json?.error?.details[0]?.message || err.message || 'Error en la blockchain de WAX.' 
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));