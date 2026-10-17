import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SendMailOptions } from 'nodemailer';
import type { DatabaseClient } from '../../src/api/database.js';
import { NodemailerChannel, type SmtpChannelConfig } from '../../src/worker/nodemailer-channel.js';
import { loginMessage } from '../../src/api/templates.js';
import type { LocalMessage } from '../../src/worker/channel.js';

const config: SmtpChannelConfig = {
  host: 'smtp.example.invalid',
  port: 587,
  secure: false,
  username: 'placeholder-user',
  password: 'placeholder-password',
  from: 'sender@example.invalid',
  approvedRecipients: ['approved@example.invalid'],
};
const client = {} as DatabaseClient;
const message: LocalMessage = {
  id: '11111111-1111-4111-8111-111111111111',
  recipient: 'approved@example.invalid',
  ...loginMessage('123456', 'hi'),
  templateKey: 'login_code',
  templateVersion: 1,
  language: 'hi',
};
test('optional SMTP adapter sends only the intended envelope and rendered bilingual text through a fake transport', async () => {
  const captured: SendMailOptions[] = [];
  const channel = new NodemailerChannel(
    {
      sendMail: async (options) => {
        captured.push(options);
        return { accepted: [message.recipient], rejected: [] };
      },
    },
    config,
  );
  await channel.deliver(client, message);
  assert.equal(captured.length, 1);
  assert.deepEqual(captured[0]?.envelope, { from: config.from, to: [message.recipient] });
  assert.equal(captured[0]?.subject, message.subject);
  assert.equal(captured[0]?.text, message.body);
  assert.equal(captured[0]?.html, undefined);
  assert.equal(captured[0]?.disableFileAccess, true);
  assert.equal(captured[0]?.disableUrlAccess, true);
  assert.equal(
    captured[0]?.messageId,
    '<11111111-1111-4111-8111-111111111111@mail.sahmati.invalid>',
  );
});
test('SMTP adapter rejects unapproved recipients and unsafe metadata before transporter invocation', async () => {
  let calls = 0;
  const channel = new NodemailerChannel(
    {
      sendMail: async () => {
        calls++;
        return { accepted: [message.recipient], rejected: [] };
      },
    },
    config,
  );
  await assert.rejects(
    channel.deliver(client, { ...message, recipient: 'other@example.invalid' }),
    /not been approved/,
  );
  await assert.rejects(
    channel.deliver(client, { ...message, subject: 'Injected\r\nBcc: other@example.invalid' }),
    /metadata/,
  );
  assert.equal(calls, 0);
  assert.throws(
    () =>
      new NodemailerChannel(
        { sendMail: async () => ({ accepted: [], rejected: [] }) },
        { ...config, approvedRecipients: [] },
      ),
    /configuration/,
  );
});
test('SMTP adapter propagates transporter failure without claiming delivery', async () => {
  const channel = new NodemailerChannel(
    {
      sendMail: async () => {
        throw new Error('simulated transport failure');
      },
    },
    config,
  );
  await assert.rejects(channel.deliver(client, message), /simulated transport failure/);
});

test('SMTP rejection is not reported as delivery', async () => {
  const channel = new NodemailerChannel(
    { sendMail: async () => ({ accepted: [], rejected: [message.recipient] }) },
    config,
  );
  await assert.rejects(channel.deliver(client, message), /not accepted/);
});
