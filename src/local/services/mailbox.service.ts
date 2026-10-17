import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { MailView } from "@sahmati/contracts";
import { MailEntity } from "../entities/mail.entity";

@Injectable()
export class MailboxService {
  constructor(
    @InjectRepository(MailEntity) private readonly mail: Repository<MailEntity>,
  ) {}

  async deliver(
    recipient: string,
    subject: string,
    body: string,
  ): Promise<void> {
    await this.mail.save(this.mail.create({ recipient, subject, body }));
  }

  async list(): Promise<MailView[]> {
    const rows = await this.mail.find({
      order: { deliveredAt: "DESC" },
      take: 50,
    });
    return rows.map((row) => ({
      id: row.id,
      recipient: row.recipient,
      subject: row.subject,
      body: row.body,
      deliveredAt: row.deliveredAt.toISOString(),
    }));
  }
}
