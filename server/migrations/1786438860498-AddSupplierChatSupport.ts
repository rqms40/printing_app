import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSupplierChatSupport1786438860498 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "chat_conversations_type_enum" ADD VALUE IF NOT EXISTS 'supplier'`);
        await queryRunner.query(`ALTER TYPE "chat_messages_sender_role_enum" ADD VALUE IF NOT EXISTS 'supplier'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Postgres does not support removing values from an ENUM type easily.
        // We will leave the ENUMs as is during rollback.
    }
}
