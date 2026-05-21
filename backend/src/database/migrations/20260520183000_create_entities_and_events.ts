import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('entities', (table) => {
    table.bigIncrements('id').primary();
    table.string('name').notNullable();
    table.string('status').notNullable().defaultTo('active');
    table.integer('critical_events_count').notNullable().defaultTo(0);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('events', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('entity_id').references('id').inTable('entities').onDelete('CASCADE').notNullable().index();
    table.string('external_id').unique().notNullable();
    table.string('type').notNullable();
    table.jsonb('payload').notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('events');
  await knex.schema.dropTableIfExists('entities');
}
