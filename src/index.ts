import * as dotenv from "dotenv";

import { Client, MessageEmbed } from "discord.js";
import { MinecraftServer } from "./mc-server";
import { Bot } from "./bot";

// Read config from .env file
dotenv.config();

// Create instances of discord client, bot and minecraft server
const client = new Client();
const server = new MinecraftServer(process.env["MCSERVER_TERRAFORM"]);
const bot = new Bot(client, server, process.env["MCSERVER_CHANNELID"]);

client.on("ready", async () => {
  console.log("[Client] Connected to discord!");
  bot.updatePresence();
});

client.on("error", err => {
  console.log("[Client] Error occured!");
  console.log(JSON.stringify(err));
});

// Create an event listener for messages
client.on("message", bot.handleMessage);

// Log our bot in using the token from https://discordapp.com/developers/applications/me
client.login(process.env["MCSERVER_TOKEN"]);
