const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

let sourceChannel = null;
let targetChannel = null;
let adminId = null;

bot.on('message', async (ctx) => {
  try {
    if (ctx.message.forward_from_chat) {
      if (!adminId) {
        adminId = ctx.from.id;
      }
      
      if (!sourceChannel) {
        sourceChannel = ctx.message.forward_from_chat.id;
      }
      
      if (!targetChannel) {
        targetChannel = ctx.chat.id;
      }
      
      if (ctx.from.id === adminId && 
          ctx.message.forward_from_chat.id === sourceChannel && 
          ctx.chat.id === targetChannel) {
        
        const forwardedMessageId = ctx.message.forward_from_message_id;
        
        await ctx.telegram.copyMessage(
          targetChannel,
          sourceChannel,
          forwardedMessageId
        );
        
        await ctx.telegram.deleteMessage(targetChannel, ctx.message.message_id);
        
        try {
          await ctx.telegram.deleteMessage(sourceChannel, forwardedMessageId);
        } catch (deleteError) {
          console.log('Could not delete from source channel:', deleteError.message);
        }
      }
    }
  } catch (error) {
    console.error('Error processing forward:', error);
  }
});

bot.on('channel_post', async (ctx) => {
  try {
    if (sourceChannel && targetChannel && ctx.chat.id === sourceChannel) {
      const messageId = ctx.message.message_id;
      
      await ctx.telegram.copyMessage(
        targetChannel,
        sourceChannel,
        messageId
      );
      
      await ctx.telegram.deleteMessage(sourceChannel, messageId);
    }
  } catch (error) {
    console.error('Error processing channel post:', error);
  }
});

bot.command('start', (ctx) => {
  console.log('Start command received from:', ctx.from.id);
  if (!adminId) {
    adminId = ctx.from.id;
    console.log('Admin ID set to:', adminId);
  }
  ctx.reply('Bot is running! Forward a message from your source channel to set up automatic forwarding.');
});

bot.command('status', (ctx) => {
  if (ctx.from.id === adminId) {
    ctx.reply(`Status:
Admin ID: ${adminId}
Source Channel: ${sourceChannel}
Target Channel: ${targetChannel}`);
  }
});

bot.command('reset', (ctx) => {
  if (ctx.from.id === adminId) {
    sourceChannel = null;
    targetChannel = null;
    adminId = null;
    ctx.reply('Bot configuration reset. Forward a message to reconfigure.');
  }
});

module.exports = async (req, res) => {
  if (req.method === 'POST' && req.url.includes('/webhook/')) {
    try {
      console.log('Webhook received:', JSON.stringify(req.body, null, 2));
      await bot.handleUpdate(req.body);
      res.status(200).json({ ok: true });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'GET' && req.url.includes('/webhook/')) {
    res.status(200).send('Webhook endpoint is active. Use POST method.');
  } else if (req.method === 'GET' && req.url === '/') {
    res.status(200).send(`Telegram Auto-Forward Bot is running!
Bot Token: ${process.env.BOT_TOKEN ? 'Set' : 'Not Set'}
Admin ID: ${adminId || 'Not Set'}
Source Channel: ${sourceChannel || 'Not Set'}
Target Channel: ${targetChannel || 'Not Set'}`);
  } else {
    res.status(404).send('Not Found');
  }
};
