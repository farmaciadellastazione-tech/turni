// notifica-aggiornamento.mjs — ultimo passo del workflow: manda la mail di riepilogo.
//
// Uso: node tools/notifica-aggiornamento.mjs
//
// Legge gli eventi registrati da apply-bollettino / apply-sabato (vedi notifica.mjs) e,
// SOLO se qualcosa è cambiato o se il giro è fallito, manda una mail alla casella della
// farmacia. Nei giorni senza novità non manda nulla.
//
// Env:
//   GMAIL_USER, GMAIL_APP_PASSWORD — stessa App Password del resto dell'automazione (SMTP)
//   GIRO_FALLITO                   — "true" se un passo precedente del workflow è fallito
//   URL_RUN                        — link al giro su GitHub (facoltativo)
//
// Exit: 0 = mail inviata o niente da dire · 2 = credenziali mancanti · 1 = invio fallito.

import { createRequire } from 'node:module';
import { leggiEventi, componiNotifica } from './notifica.mjs';

const require = createRequire(import.meta.url);
const nodemailer = require('nodemailer');

async function main() {
  const notifica = componiNotifica({
    eventi: leggiEventi(),
    fallito: process.env.GIRO_FALLITO === 'true',
    urlRun: process.env.URL_RUN || '',
  });
  if (!notifica) { console.log('Nessuna novità e nessun errore: nessuna mail.'); return 0; }

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) { console.error('Mancano GMAIL_USER / GMAIL_APP_PASSWORD.'); return 2; }

  const transport = nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true, auth: { user, pass },
  });
  await transport.sendMail({ from: user, to: user, subject: notifica.oggetto, text: notifica.testo });
  console.log(`Mail inviata: "${notifica.oggetto}"`);
  return 0;
}

main().then(code => process.exit(code)).catch(err => { console.error(err); process.exit(1); });
