// fetch-sabato-email.mjs — scarica i .doc "SABATO POMERIGGIO" via IMAP.
//
// Uso: node tools/fetch-sabato-email.mjs [prefisso-output]
//
// Autenticazione via App Password Gmail:
//   GMAIL_USER / GMAIL_APP_PASSWORD
//
// Cerca nelle mail di Federfarma degli ultimi 60 giorni gli allegati
// "SABATO POMERIGGIO <data>" in .doc o PDF (riconosciuti dal nome file: le
// circolari quotidiane portano altri .docx/.pdf che non vanno confusi con
// l'elenco sabato). La mail dei turni può portare più elenchi (uno per sabato):
// li salva tutti come <prefisso>1.doc, <prefisso>2.doc, … (estensione sempre
// .doc: apply-sabato riconosce il formato vero dal contenuto, non dal nome).
//
// Exit: 0 = doc scaricati · 2 = credenziali mancanti · 3 = nessuno trovato

import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { allegatiSabato } from './selezione-mail.mjs';

const require = createRequire(import.meta.url);
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');

async function main() {
  const PREFIX = process.argv[2] || '.sabato-';

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

        const nomi = (parsed.attachments || []).map(a => a.filename || '');
        const scelti = allegatiSabato(nomi);
        if (!scelti.length) continue;

        const rawDate = parsed.date?.toUTCString() || '';
        console.log(`Mail con doc sabato del ${rawDate}: "${parsed.subject}"`);
        let n = 0;
        for (const att of parsed.attachments) {
          if (!scelti.includes(att.filename || '')) continue;
          const out = `${PREFIX}${++n}.doc`;
          writeFileSync(out, att.content);
          console.log(`  Scaricato "${att.filename}" (${att.content.length} byte) -> ${out}`);
        }
        return 0;
      }

      console.log('Nessun doc "SABATO POMERIGGIO" nelle mail di Federfarma.');
      return 3;
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

main().then(code => process.exit(code)).catch(err => { console.error(err); process.exit(1); });
