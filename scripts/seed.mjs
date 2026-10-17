import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
const root = resolve(import.meta.dirname, '../..');
const config = JSON.parse(
  readFileSync(resolve(root, process.env.SAHMATI_RUNTIME || '.local/runtime.json'), 'utf8'),
);
const client = new pg.Client({ connectionString: config.adminUrl });
await client.connect();
try {
  await client.query('BEGIN');
  const tenants = [
    [
      '11111111-1111-4111-8111-111111111111',
      'Sahmati Learning Lab',
      'learning-lab',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    ],
    [
      '22222222-2222-4222-8222-222222222222',
      'Sahmati Care Lab',
      'care-lab',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    ],
  ];
  for (const [id, name, slug, branch] of tenants) {
    await client.query(
      'INSERT INTO workspace.organisations(id,name,slug) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
      [id, name, slug],
    );
    await client.query(
      'INSERT INTO workspace.branches(tenant_id,id,name) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
      [id, branch, 'Main branch'],
    );
  }
  for (const [n, email, name, tenant, branch, role] of [
    ['1', 'owner', 'Demo owner', tenants[0][0], tenants[0][3], 'owner'],
    ['2', 'staff', 'Demo colleague', tenants[0][0], tenants[0][3], 'staff'],
    ['3', 'viewer', 'Demo reviewer', tenants[0][0], tenants[0][3], 'viewer'],
    ['4', 'other', 'Care lab owner', tenants[1][0], tenants[1][3], 'owner'],
    ['5', 'operator', 'Host operator', null, null, null],
  ]) {
    const id = `00000000-0000-4000-8000-${n.padStart(12, '0')}`;
    await client.query(
      'INSERT INTO identity.users(id,email,display_name) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
      [id, `${email}@demo.sahmati.test`, name],
    );
    if (tenant)
      await client.query(
        'INSERT INTO identity.memberships(tenant_id,user_id,branch_id,role) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',
        [tenant, id, branch, role],
      );
  }
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}
console.log(
  'Synthetic organisations and five local test identities ready. No personal/customer data imported.',
);
