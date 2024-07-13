import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const createConversation = mutation({
  args: {
    participants: v.array(v.id("users")),
    isGroup: v.boolean(),
    groupName: v.optional(v.string()),
    groupImage: v.optional(v.string()),
    admin: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthorized");

    const existingConversation = await ctx.db
      .query("conversations")
      .filter((q) =>
        q.or(
          q.eq(q.field("participants"), args.participants),
          q.eq(q.field("participants"), args.participants.reverse())
        )
      )
      .first();

    if (existingConversation) return existingConversation._id;

    let groupImage;
    if (args.groupImage) {
      groupImage = (await ctx.storage.getUrl(args.groupImage)) as string;
    }

    const conversationId = await ctx.db.insert("conversations", {
      participants: args.participants,
      isGroup: args.isGroup,
      groupName: args.groupName,
      groupImage,
      admin: args.admin,
    });

    return conversationId;
  },
});

export const getMyconversations = query({
  args: {},
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();
    if (!user) throw new ConvexError("User not found");

    const conversations = await ctx.db.query("conversations").collect();
    const myConversations = conversations.filter((conversation) =>
      conversation.participants.includes(user._id)
    );

    const conversationWithDetails = Promise.all(
      myConversations.map(async (conversation) => {
        let userDetails;
        if(!conversation.isGroup) {
          const otherUserId = conversation.participants.find((id) => id !== user._id);
          const userProfile = await ctx.db.query("users").filter((q) => q.eq(q.field("_id"), otherUserId)).take(1);
          userDetails = userProfile[0];
        }
        const lastMessage = await ctx.db
          .query("messages")
          .filter((m) => m.eq(m.field("conversation"), conversation._id))
          .order("desc")
          .take(1);

        return {
          ...userDetails,
          ...conversation,
          lastMessage: lastMessage[0] || null
        }
      })
    );

    return conversationWithDetails;
  },
});
export const generateUploadUrl = mutation(
  async (ctx) => await ctx.storage.generateUploadUrl()
);
