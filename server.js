const express = require('express');
const cors = require('cors');
const { Api, JsonRpc, JsSignatureProvider } = require('eosjs');
const fetch = require('node-fetch');
const { TextEncoder, TextDecoder } = require('util');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// VARIABLES DE ENTORNO
// ============================================

const PRIVATE_KEY = process.env.WAX_PRIVATE_KEY
? process.env.WAX_PRIVATE_KEY.trim()
: '';

const FAUCET_ACCOUNT = process.env.WAX_FAUCET_ACCOUNT
? process.env.WAX_FAUCET_ACCOUNT.trim().toLowerCase()
: '';

const WAX_ENDPOINT = process.env.WAX_ENDPOINT
? process.env.WAX_ENDPOINT.trim()
: 'https://wax.greymass.com';

// ============================================
// CONFIGURACIÓN DEL FAUCET
// ============================================

const CLAIM_AMOUNT = '0.01000000 WAX';
const TOKEN_CONTRACT = 'eosio.token';
const COOLDOWN_MS = 60 * 60 * 1000;

const lastClaims = new Map();

// ============================================
// ESTADO DEL SERVIDOR
// ============================================

app.get('/api/status', (req, res) => {
res.json({
server: 'online',
privateKey: Boolean(PRIVATE_KEY),
faucetAccount: FAUCET_ACCOUNT || null,
waxEndpoint: WAX_ENDPOINT,
ready: Boolean(PRIVATE_KEY && FAUCET_ACCOUNT)
});
});

// ============================================
// CLAIM
// ============================================

app.post('/api/claim', async (req, res) => {

```
const { userAccount } = req.body;

// Comprobar variables
if (!PRIVATE_KEY || !FAUCET_ACCOUNT) {

    console.error('Variables de entorno incompletas:', {
        privateKey: Boolean(PRIVATE_KEY),
        faucetAccount: Boolean(FAUCET_ACCOUNT)
    });

    return res.status(500).json({
        error: 'Variables de entorno incompletas en el servidor.'
    });
}

// Comprobar cuenta
if (!userAccount) {

    return res.status(400).json({
        error: 'Proporciona una cuenta WAX.'
    });
}

const cleanAccount = userAccount.trim().toLowerCase();

// Validar formato WAX
if (!/^[a-z1-5.]{1,12}$/.test(cleanAccount)) {

    return res.status(400).json({
        error: 'Formato de cuenta WAX inválido.'
    });
}

// No permitir reclamar al propio faucet
if (cleanAccount === FAUCET_ACCOUNT) {

    return res.status(400).json({
        error: 'No puedes reclamar en la cuenta del faucet.'
    });
}

// ========================================
// COOLDOWN
// ========================================

const now = Date.now();

const lastClaim = lastClaims.get(cleanAccount);

if (lastClaim && (now - lastClaim < COOLDOWN_MS)) {

    const remainingMinutes = Math.ceil(
        (COOLDOWN_MS - (now - lastClaim)) / 60000
    );

    return res.status(429).json({
        error: 'Ya has reclamado. Vuelve a intentarlo en ' +
            remainingMinutes +
            ' minuto(s).'
    });
}

// ========================================
// ENVIAR WAX
// ========================================

try {

    console.log(
        'Enviando',
        CLAIM_AMOUNT,
        'desde',
        FAUCET_ACCOUNT,
        'a',
        cleanAccount
    );

    const rpc = new JsonRpc(WAX_ENDPOINT, {
        fetch
    });

    const signatureProvider = new JsSignatureProvider([
        PRIVATE_KEY
    ]);

    const api = new Api({
        rpc,
        signatureProvider,
        textDecoder: new TextDecoder(),
        textEncoder: new TextEncoder()
    });

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
                        to: cleanAccount,
                        quantity: CLAIM_AMOUNT,
                        memo: 'Faucet Claim - 0.01 WAX'
                    }
                }
            ]
        },
        {
            blocksBehind: 3,
            expireSeconds: 30
        }
    );

    // Guardar último claim
    lastClaims.set(cleanAccount, now);

    console.log(
        'Transacción completada:',
        result.transaction_id
    );

    return res.json({
        success: true,
        txId: result.transaction_id,
        amount: CLAIM_AMOUNT
    });

} catch (err) {

    console.error('Error enviando WAX:', err);

    const errorMessage =
        err &&
        err.json &&
        err.json.error &&
        err.json.error.details &&
        err.json.error.details[0] &&
        err.json.error.details[0].message
            ? err.json.error.details[0].message
            : err.message || 'Error en la blockchain de WAX.';

    return res.status(500).json({
        error: errorMessage
    });
}
```

});

// ============================================
// SERVIDOR
// ============================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

```
console.log('================================');
console.log('WAX FAUCET INICIADO');
console.log('================================');

console.log(
    'Cuenta faucet:',
    FAUCET_ACCOUNT || 'NO CONFIGURADA'
);

console.log(
    'WAX endpoint:',
    WAX_ENDPOINT
);

console.log(
    'Clave privada:',
    PRIVATE_KEY ? 'CONFIGURADA' : 'NO CONFIGURADA'
);

console.log(
    'Puerto:',
    PORT
);

console.log('================================');
```

});
