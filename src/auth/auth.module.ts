import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OrganisationEntity } from "./entities/organisation.entity";
import { BranchEntity } from "./entities/branch.entity";
import { UserEntity } from "./entities/user.entity";
import { MembershipEntity } from "./entities/membership.entity";
import { AuthChallengeEntity } from "./entities/auth-challenge.entity";
import { SessionEntity } from "./entities/session.entity";
import { ActivityLogEntity } from "./entities/activity-log.entity";
import { AuthService } from "./services/auth.service";
import { AuthController } from "./controllers/auth.controller";
import { SectorPacksModule } from "../sector-packs/sector-packs.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrganisationEntity,
      BranchEntity,
      UserEntity,
      MembershipEntity,
      AuthChallengeEntity,
      SessionEntity,
      ActivityLogEntity,
    ]),
    SectorPacksModule,
    NotificationsModule,
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
