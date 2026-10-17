import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { LocalModule } from "../local/local.module";
import { TenantEntity } from "./entities/tenant.entity";
import { UserEntity } from "./entities/user.entity";
import { MembershipEntity } from "./entities/membership.entity";
import { AuthChallengeEntity } from "./entities/auth-challenge.entity";
import { SessionEntity } from "./entities/session.entity";
import { AuthService } from "./services/auth.service";
import { AuthController } from "./controllers/auth.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TenantEntity,
      UserEntity,
      MembershipEntity,
      AuthChallengeEntity,
      SessionEntity,
    ]),
    LocalModule,
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [TypeOrmModule],
})
export class AuthModule {}
