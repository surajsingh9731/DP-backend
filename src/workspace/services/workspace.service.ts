import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { createHash } from "node:crypto";
import type { TaskView, WorkspaceView } from "@sahmati/contracts";
import { WorkspaceTaskEntity } from "../entities/workspace-task.entity";
import { WorkspaceTaskEventEntity } from "../entities/workspace-task-event.entity";
import { IdempotencyService } from "../../common/services/idempotency.service";
import { TenantEntity } from "../../auth/entities/tenant.entity";
import { UserEntity } from "../../auth/entities/user.entity";
import { MessagesService } from "../../messages/services/messages.service";
import type { CurrentMembership } from "../../common/guards/tenant-membership.guard";

@Injectable()
export class WorkspaceService {
  constructor(
    @InjectRepository(WorkspaceTaskEntity)
    private readonly tasks: Repository<WorkspaceTaskEntity>,
    @InjectRepository(WorkspaceTaskEventEntity)
    private readonly events: Repository<WorkspaceTaskEventEntity>,
    @InjectRepository(TenantEntity)
    private readonly tenants: Repository<TenantEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    private readonly idempotency: IdempotencyService,
    private readonly messages: MessagesService,
  ) {}

  async summary(
    tenantId: string,
    membership: CurrentMembership,
  ): Promise<WorkspaceView> {
    const tenant = await this.tenants.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException("Tenant not found.");
    const tasks = await this.tasks.find({
      where: { tenantId },
      order: { createdAt: "DESC" },
      take: 20,
    });
    const events = await this.events.find({
      where: { tenantId },
      order: { sequence: "DESC" },
      take: 20,
    });
    const deliveries = await this.messages.counts(tenantId);
    return {
      name: tenant.name,
      role: membership.role,
      tasks: tasks.map((task) => this.taskView(task)),
      evidence: events.map((event) => ({
        id: event.id,
        taskId: event.taskId,
        action: event.action,
        occurredAt: event.occurredAt.toISOString(),
        eventHash: event.eventHash,
        sequence: event.sequence,
      })),
      deliveries,
    };
  }

  async createTask(
    tenantId: string,
    idempotencyKey: string,
    language: "en" | "hi",
    membership: CurrentMembership,
  ): Promise<TaskView> {
    if (membership.role !== "owner")
      throw new ForbiddenException("Only an owner can create a task.");
    return this.idempotency.runOnce(
      this.tasks.manager,
      tenantId,
      idempotencyKey,
      async () => {
        const task = await this.tasks.save(
          this.tasks.create({
            tenantId,
            template: "review_inventory",
            status: "open",
            version: 1,
          }),
        );
        await this.events.save(
          this.events.create({
            tenantId,
            taskId: task.id,
            action: "task.created",
            eventHash: createHash("sha256")
              .update(`created:${task.id}`)
              .digest("hex"),
          }),
        );
        const actor = await this.users.findOne({
          where: { id: membership.userId },
        });
        if (actor) {
          await this.messages.enqueue(
            tenantId,
            actor.email,
            "task_created",
            language,
            {
              taskId: task.id,
            },
          );
        }
        return this.taskView(task);
      },
    );
  }

  async closeTask(
    tenantId: string,
    id: string,
    version: number,
    membership: CurrentMembership,
  ): Promise<TaskView> {
    if (membership.role === "viewer")
      throw new ForbiddenException("Viewers cannot close tasks.");
    const task = await this.tasks.findOne({ where: { id, tenantId } });
    if (!task) throw new NotFoundException("Task not found.");
    if (task.version !== version)
      throw new ConflictException(
        "This task changed since you last loaded it.",
      );
    task.status = "closed";
    task.version += 1;
    await this.tasks.save(task);
    await this.events.save(
      this.events.create({
        tenantId,
        taskId: task.id,
        action: "task.closed",
        eventHash: createHash("sha256")
          .update(`closed:${task.id}:${task.version}`)
          .digest("hex"),
      }),
    );
    return this.taskView(task);
  }

  private taskView(task: WorkspaceTaskEntity): TaskView {
    return {
      id: task.id,
      template: task.template,
      status: task.status,
      assignee: task.assignee,
      version: task.version,
      createdAt: task.createdAt.toISOString(),
    };
  }
}
