import 'reflect-metadata';
import { AppDataSource } from '../src/database/data-source';
import { TenantEntity } from '../src/auth/entities/tenant.entity';
import { UserEntity } from '../src/auth/entities/user.entity';
import { MembershipEntity } from '../src/auth/entities/membership.entity';
import { DEMO_ACCOUNTS, DEMO_EMAIL_DOMAIN } from '../src/constants/demo.constants';

/**
 * Seeds the local demo fixtures the frontend's login screen expects:
 * owner/staff/viewer share one sample tenant; "other" has no tenant
 * membership at all; "operator" is the host-operator fixture, also with no
 * tenant membership (see docs/sources — hosting/funding never grants
 * blanket tenant access).
 */
async function seed(): Promise<void> {
  const dataSource = await AppDataSource.initialize();
  try {
    const tenants = dataSource.getRepository(TenantEntity);
    const users = dataSource.getRepository(UserEntity);
    const memberships = dataSource.getRepository(MembershipEntity);

    let tenant = await tenants.findOne({ where: { name: 'Synthetic workspace' } });
    if (!tenant) {
      tenant = await tenants.save(tenants.create({ name: 'Synthetic workspace', branch: 'Main' }));
      console.log(`Created sample tenant ${tenant.id}`);
    }

    for (const account of DEMO_ACCOUNTS) {
      const email = `${account}@${DEMO_EMAIL_DOMAIN}`;
      let user = await users.findOne({ where: { email } });
      if (!user) {
        user = await users.save(users.create({ email, displayName: `Demo ${account}` }));
        console.log(`Created demo user ${email}`);
      }
      if (account === 'owner' || account === 'staff' || account === 'viewer') {
        const existing = await memberships.findOne({
          where: { tenantId: tenant.id, userId: user.id },
        });
        if (!existing) {
          await memberships.save(memberships.create({ tenantId: tenant.id, userId: user.id, role: account }));
          console.log(`Granted ${account} membership to ${email}`);
        }
      }
    }
    console.log('Seed complete.');
  } finally {
    await dataSource.destroy();
  }
}

seed().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
