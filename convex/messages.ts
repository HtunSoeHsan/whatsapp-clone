import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const sendTextMessage = mutation({
    args: {
        sender: v.string(),
        content: v.string(),
        conversation: v.id("conversations"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if(!identity) throw new ConvexError("Unauthorized");

        const user = await ctx.db.query("users").withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
        if(!user) throw new ConvexError("User not found");

        const conversation = await ctx.db.query("conversations").filter((q) => q.eq(q.field("_id"), args.conversation)).first();
        if(!conversation) throw new ConvexError("Conversation not found");

        if(!conversation.participants.includes(user._id)) throw new ConvexError("you are not part of this conversation");

        await ctx.db.insert("messages", {sender: args.sender, content: args.content, conversation: args.conversation, messageType: "text"});

        // TODO: chat gpt message
    }
});

export const getMessages = query({
    args: { conversation: v.id("conversations")},
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new ConvexError("Unauthorized");

        const messages = await ctx.db.query("messages").withIndex("by_conversation", (q) => q.eq("conversation", args.conversation)).collect();

        const userProfileCache = new Map();
        const messagesWithSender = await Promise.all(
            messages.map(async(message) => {
                let sender;
                if (userProfileCache.has(message.sender)) {
                    sender = userProfileCache.get(message.sender);
                } else {
                sender = await ctx.db
                  .query("users")
                  .filter((q) => q.eq(q.field("_id"), message.sender))
                  .first();

                  userProfileCache.set(message.sender, sender);

                }
                return {...message, sender};
            })
        )

        return messagesWithSender;
    }
})

export const sendImage = mutation({
  args: {
    imgId: v.id("_storage"),
    sender: v.id("users"),
    conversation: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthorized");
    }

    const content = (await ctx.storage.getUrl(args.imgId)) as string;

    await ctx.db.insert("messages", {
      content: content,
      sender: args.sender,
      messageType: "image",
      conversation: args.conversation,
    });
  },
});

export const sendVideo = mutation({
  args: {
    videoId: v.id("_storage"),
    sender: v.id("users"),
    conversation: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthorized");
    }

    const content = (await ctx.storage.getUrl(args.videoId)) as string;

    await ctx.db.insert("messages", {
      content: content,
      sender: args.sender,
      messageType: "video",
      conversation: args.conversation,
    });
  },
});