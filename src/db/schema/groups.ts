import { relations } from "drizzle-orm";
import {
	index,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./user";

export const groupMemberRole = pgEnum("group_member_role", [
	"owner",
	"admin",
	"member",
]);

export const groupMemberStatus = pgEnum("group_member_status", [
	"active",
	"invited",
	"removed",
]);

export const groups = pgTable(
	"groups",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		currency: text("currency").default("MNT").notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		archivedAt: timestamp("archived_at"),
	},
	(table) => [
		index("groups_created_by_user_id_idx").on(table.createdByUserId),
		index("groups_archived_at_idx").on(table.archivedAt),
	],
);

export const groupMembers = pgTable(
	"group_members",
	{
		groupId: text("group_id")
			.notNull()
			.references(() => groups.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		role: groupMemberRole("role").default("member").notNull(),
		status: groupMemberStatus("status").default("active").notNull(),
		joinedAt: timestamp("joined_at"),
		removedAt: timestamp("removed_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("group_members_group_id_user_id_unique").on(
			table.groupId,
			table.userId,
		),
		index("group_members_user_id_idx").on(table.userId),
		index("group_members_group_id_status_idx").on(table.groupId, table.status),
	],
);

export const groupsRelations = relations(groups, ({ one, many }) => ({
	createdBy: one(user, {
		fields: [groups.createdByUserId],
		references: [user.id],
	}),
	members: many(groupMembers),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
	group: one(groups, {
		fields: [groupMembers.groupId],
		references: [groups.id],
	}),
	user: one(user, {
		fields: [groupMembers.userId],
		references: [user.id],
	}),
}));
