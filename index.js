const { Telegraf } = require('telegraf');
const express = require('express');

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();

app.use(express.json());

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

app.post('/webhook/:token', (req, res) => {
  console.log('Webhook received for token:', req.params.token);
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  
  if (req.params.token === process.env.BOT_TOKEN) {
    try {
      bot.handleUpdate(req.body);
      res.sendStatus(200);
    } catch (error) {
      console.error('Error handling update:', error);
      res.sendStatus(500);
    }
  } else {
    console.log('Invalid token received');
    res.sendStatus(401);
  }
});

app.get('/webhook/:token', (req, res) => {
  if (req.params.token === process.env.BOT_TOKEN) {
    res.send('Webhook endpoint is active. Use POST method.');
  } else {
    res.sendStatus(401);
  }
});

app.get('/', (req, res) => {
  res.send(`Telegram Auto-Forward Bot is running!
Bot Token: ${process.env.BOT_TOKEN ? 'Set' : 'Not Set'}
Admin ID: ${adminId || 'Not Set'}
Source Channel: ${sourceChannel || 'Not Set'}
Target Channel: ${targetChannel || 'Not Set'}`);
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server running on port ${process.env.PORT || 3000}`);
  console.log(`Webhook URL: ${process.env.WEBHOOK_URL || 'Not Set'}`);
  console.log(`Bot Token: ${process.env.BOT_TOKEN ? 'Set' : 'Not Set'}`);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
