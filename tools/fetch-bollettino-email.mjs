// fetch-bollettino-email.mjs — scarica i PDF del bollettino turni via IMAP.
//
// Uso: node tools/fetch-bollettino-email.mjs [prefisso-output]
//
// Autenticazione via App Password Gmail (nessun OAuth, nessuna scadenza):
//   GMAIL_USER         — indirizzo Gmail (es. farmaciadellastazione@gmail.com)
//   GMAIL_APP_PASSWORD — App Password Google a 16 caratteri (senza spazi)
//
// Cerca la mail dei turni di Federfarma La Spezia negli ultimi 60 giorni:
// la riconosce dall'oggetto ("TURNI COMUNE DELLA SPEZIA …"), non dal semplice
// allegato PDF — le circolari quotidiane sono anch'esse piene di PDF.
// La mail può portare più bollettini (uno per settimana): li salva tutti
// come <prefisso>1.pdf, <prefisso>2.pdf, …
//
// Exit code: 0 = pdf scaricati · 2 = credenziali mancanti ·
//            3 = nessuna mail/pdf trovata · altro = errore.

import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { allegatiBollettino } from './selezione-mail.mjs';

const require = createRequire(import.meta.url);
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');

async function main() {
  const PREFIX = process.argv[2] || '.bollettino-';

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    console.error('Mancano GMAIL_USER / GMAIL_APP_PASSWORD.');
    return 2;
  }

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  await client.connect();
  try {
    const mailboxes = await client.list();
    const allMailbox = mailboxes.find(m => m.specialUse === '\\All');
    const mailboxPath = allMailbox?.path || 'INBOX';

    const lock = await client.getMailboxLock(mailboxPath);
    try {
      const since = new Date();
      since.setDate(since.getDate() - 60);

      const uids = await client.search({
        from: 'federfarmalaspezia.it',
        since,
      }, { uid: true });

      if (!uids?.length) {
        console.log('Nessuna mail di Federfarma trovata negli ultimi 60 giorni.');
        return 3;
      }

      // UIDs decrescenti = più recenti prima
      for (const uid of [...uids].sort((a, b) => b - a)) {
        const { content } = await client.download(String(uid), undefined, { uid: true });
        const chunks = [];
        for await (const chunk of content) chunks.push(chunk);
        const parsed = await simpleParser(Buffer.concat(chunks));

        const nomi = (parsed.attachments || []).map(a => a.filename || '');
        const scelti = allegatiBollettino(parsed.subject || '', nomi);
        if (!scelti.length) continue;

        const rawDate = parsed.date?.toUTCString() || '';
        console.log(`Mail turni del ${rawDate}: "${parsed.subject}"`);
        let n = 0;
        for (const att of parsed.attachments) {
          if (!scelti.includes(att.filename || '')) continue;
          const out = `${PREFIX}${++n}.pdf`;
          writeFileSync(out, att.content);
          console.log(`  Scaricato "${att.filename}" (${att.content.length} byte) -> ${out}`);
        }
        return 0;
      }

      console.log('Nessuna mail turni con PDF tra le mail di Federfarma.');
      return 3;
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

main().then(code => process.exit(code)).catch(err => { console.error(err); process.exit(1); });
