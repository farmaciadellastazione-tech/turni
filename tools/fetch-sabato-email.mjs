// fetch-sabato-email.mjs — scarica il .doc "SABATO POMERIGGIO" via IMAP.
//
// Uso: node tools/fetch-sabato-email.mjs [output.doc]
//
// Autenticazione via App Password Gmail:
//   GMAIL_USER / GMAIL_APP_PASSWORD
//
// Cerca email con allegato .doc da federfarmalaspezia.it negli ultimi 60 giorni.
// Salva il .doc più recente nel file di output.
//
// Exit: 0 = doc scaricato · 2 = credenziali mancanti · 3 = nessuno trovato

import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');

async function main() {
  const OUT = process.argv[2] || '.sabato.doc';

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

      for (const uid of [...uids].sort((a, b) => b - a)) {
        const { content } = await client.download(String(uid), undefined, { uid: true });
        const chunks = [];
        for await (const chunk of content) chunks.push(chunk);
        const parsed = await simpleParser(Buffer.concat(chunks));

        const att = parsed.attachments?.find(a => /\.(doc|docx)$/i.test(a.filename || ''));
        if (!att) continue;

        writeFileSync(OUT, att.content);
        const rawDate = parsed.date?.toUTCString() || '';
        console.log(`Scaricato "${att.filename}" (${att.content.length} byte) — mail del ${rawDate} -> ${OUT}`);
        return 0;
      }

      console.log('Nessun .doc nelle mail candidate di Federfarma.');
      return 3;
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

main().then(code => process.exit(code)).catch(err => { console.error(err); process.exit(1); });
