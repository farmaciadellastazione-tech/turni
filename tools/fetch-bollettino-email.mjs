// fetch-bollettino-email.mjs — scarica il PDF del bollettino settimanale via IMAP.
//
// Uso: node tools/fetch-bollettino-email.mjs [output.pdf]
//
// Autenticazione via App Password Gmail (nessun OAuth, nessuna scadenza):
//   GMAIL_USER         — indirizzo Gmail (es. farmaciadellastazione@gmail.com)
//   GMAIL_APP_PASSWORD — App Password Google a 16 caratteri (senza spazi)
//
// Cerca email di Federfarma La Spezia (info@federfarmalaspezia.it) con allegati PDF
// negli ultimi 60 giorni; salva il PDF più recente nel file di output.
//
// Exit code: 0 = pdf scaricato · 2 = credenziali mancanti ·
//            3 = nessuna mail/pdf trovata · altro = errore.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');

async function main() {
  const OUT = process.argv[2] || '.bollettino.pdf';

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

        const att = parsed.attachments?.find(a => /\.pdf$/i.test(a.filename || ''));
        if (!att) continue;

        writeFileSync(OUT, att.content);
        const rawDate = parsed.date?.toUTCString() || '';
        console.log(`Scaricato "${att.filename}" (${att.content.length} byte) — mail del ${rawDate} -> ${OUT}`);
        return 0;
      }

      console.log('Nessun PDF nelle mail candidate di Federfarma.');
      return 3;
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

main().then(code => process.exit(code)).catch(err => { console.error(err); process.exit(1); });
