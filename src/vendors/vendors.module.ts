import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { VendorEntity } from "./entities/vendor.entity";
import { VendorDeletionInstructionEntity } from "./entities/vendor-deletion-instruction.entity";
import { VendorsService } from "./services/vendors.service";
import { VendorsController } from "./controllers/vendors.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([VendorEntity, VendorDeletionInstructionEntity]),
  ],
  controllers: [VendorsController],
  providers: [VendorsService],
  exports: [VendorsService],
})
export class VendorsModule {}
