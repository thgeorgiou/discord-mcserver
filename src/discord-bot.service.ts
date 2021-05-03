import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Client, Message, MessageEmbed } from "discord.js";
import { DigitalOceanService } from "./digital-ocean.service";
import {
  MinecraftServerService,
  ServerStatus,
} from "./minecraft-server.service";

/** Represents a bot command */
export interface BotCommand {
  help: string;
  ownerOnly?: boolean;
  method(message: Message, args: string): void;
}

/** Command handler, one for each possible value of `BotCommand` */
export type CommandHandler = (message: Message) => void;

@Injectable()
export class DiscordBotService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DiscordBotService.name);

  /** Discord Bot authentication token */
  private readonly botToken: string;

  /** Channel (ID) in which the bot is allowed */
  private readonly channelId: string;

  /** User (ID) of the owner, allowed to run the dangerous commands. */
  private readonly ownerId: string;

  /** Discord API client */
  private readonly client: Client;

  constructor(
    configService: ConfigService,
    private readonly doService: DigitalOceanService,
    private readonly minecraftService: MinecraftServerService,
  ) {
    this.botToken = configService.get<string>("DISCORD_BOT_TOKEN");
    this.channelId = configService.get<string>("DISCORD_BOT_CHANNEL_ID");
    this.ownerId = configService.get<string>("DISCORD_OWNER_ID");
    this.client = new Client();

    // Add event handlers
    this.client.on("message", this.messageHandler);
  }

  /** Connects to discord on application startup */
  async onApplicationBootstrap() {
    this.logger.log("Connecting to discord...");
    await this.client.login(this.botToken);
    this.logger.log("Success!");
  }

  /** Handles incoming messages and runs the appropriate commands */
  private messageHandler = (message: Message) => {
    // Only respond in configured channel
    if (message.channel.id !== this.channelId) {
      this.logger.debug("Ignoring message in wrong channel");
      return;
    }

    // Only respond for mentions
    if (!message.mentions.has(this.client.user.id)) {
      this.logger.debug("Ignoring message without a mention");
      return;
    }

    // Grab command name (regex to remove encoded mention)
    const commandString = message.content.replace(/<@!\d+>/g, "").trim();
    const commandName = commandString.split(" ")[0];
    const commandArguments = commandString.replace(commandName, "").trim();
    this.logger.log(`Handling command ${commandString}`);

    // Handle command
    if (commandName in this.commands) {
      const command = this.commands[commandName];
      if (command.ownerOnly && message.author.id !== this.ownerId) {
        message.channel.send(
          ":no_entry: Only the admin is allowed to execute this command.",
        );
        return;
      }

      this.commands[commandName].method(message, commandArguments);
    } else {
      this.logger.log(`Ignoring unknown command ${commandName}.`);
      message.channel.send(`:warning: Unknown command "${commandName}"`);
    }
  };

  private readonly commands: Record<string, BotCommand> = {
    help: {
      help: "Displays this message.",
      method: (message) => {
        let response = "**Bot commands**:\n";
        for (const [name, command] of Object.entries(this.commands)) {
          response += `- \`${name}\`: ${command.help}\n`;
        }
        message.channel.send(response);
      },
    },
    ping: {
      help: 'Responds with "Pong!"',
      method: (message) => {
        message.channel.send("Pong!");
      },
    },
    balance: {
      help: "Displays the current account balance ($)",
      method: async (message) => {
        const balance = await this.doService.getAccountBalance();
        const embed = new MessageEmbed()
          .setTitle("Account Balance :moneybag:")
          .addFields(
            {
              name: "Current month usage",
              value: `$${balance.month_to_date_usage}`,
            },
            {
              name: "Current month balance",
              value: `$${balance.month_to_date_balance}`,
            },
            {
              name: "Total balance",
              value: `$${balance.account_balance}`,
            },
          );
        message.channel.send(embed);
      },
    },
    status: {
      help: "Displays the current server status and the IPv4",
      method: (message) => {
        const status = this.minecraftService.getStatus();
        const embed = new MessageEmbed();
        embed.setTitle("Minecraft Server Status").addFields(
          {
            name: "Status",
            value: status.status,
          },
          {
            name: "IPv4",
            value: status.ipv4,
          },
          {
            name: "Droplet ID",
            value: status.dropletId,
          },
        );

        switch (status.status) {
          case "up":
            embed.setColor("GREEN");
            break;
          case "down":
            embed.setColor("RED");
            break;
          default:
            embed.setColor("ORANGE");
        }

        message.channel.send(embed);
      },
    },
    start: {
      help: "Starts a new minecraft server",
      method: async (message) => {
        const callback = () => {
          this.commands["status"].method(message, undefined);
        };
        message.channel.send(
          "Starting server... This will take approximately 3 minutes.",
        );
        try {
          await this.minecraftService.createServer(callback);
        } catch (err) {
          this.logger.error("Error in server creation.");
          this.logger.error(err);
          message.channel.send(
            "Error in server creation! Check application logs.",
          );
        }
      },
    },
    stop: {
      help: "Stops the currently running minecraft server",
      method: async (message) => {
        message.channel.send("Stopping server...");

        try {
          await this.minecraftService.stopServer();
        } catch (err) {
          this.logger.error("Error in server deletion.");
          this.logger.error(err);
          message.channel.send("Error in server deletion!");
          return;
        }

        message.channel.send("Stopped server!");
      },
    },
    players: {
      help: "Displays which players are currently logged in",
      method: async (message) => {
        const response = await this.minecraftService.runRCONCommand("list");
        message.channel.send(`**Players:**\n${response}`);
      },
    },
    rcon: {
      help: "Runs a minecraft server command",
      ownerOnly: true,
      method: async (message, args) => {
        const response = await this.minecraftService.runRCONCommand(args);
        message.channel.send(response);
      },
    },
    setStatus: {
      help: "Overrides the current status (**dangerous**)",
      method: (message, args) => {
        if (
          args !== "up" &&
          args !== "down" &&
          args !== "starting" &&
          args !== "stopping" &&
          args !== "weird"
        ) {
          message.channel.send(`Unknown status ${args}`);
        }
        this.minecraftService.forceStatus(args as ServerStatus);
        message.channel.send(`Set status to ${args}`);
      },
    },
    ssh: {
      help: "Runs a command on the Droplet using SSH (**dangerous**)",
      method: async (message, args) => {
        if (this.minecraftService.getStatus().status === "down") {
          message.channel.send(
            ":warning: Cannot execute anything, server is down",
          );
          return;
        }

        const result = await this.minecraftService.runSSHCommand(
          args,
          undefined,
          true,
        );
        message.channel.send(`STDOUT:\n`);
        for (let i = 0; i < result.stdout.length; i += 2000) {
          message.channel.send(
            `\`\`\`\n${result.stdout.substr(i, i + 2000)}\n\`\`\``,
          );
        }
        message.channel.send(`STDERR:\n`);
        for (let i = 0; i < result.stdout.length; i += 2000) {
          message.channel.send(
            `\`\`\`\n${result.stderr.substr(i, i + 2000)}\n\`\`\``,
          );
        }
      },
    },
    setDroplet: {
      help: "Sets the current droplet ID (**dangerous**)",
      method: async (message, args) => {
        const dropletId = parseInt(args);
        this.minecraftService.setDroplet(dropletId);
        message.channel.send(`Droplet set to ${dropletId}`);
      },
    },
    runInit: {
      help:
        "Runs the initialisation script (ie. install minecraft) on the current droplet (**dangerous**)",
      method: async (message) => {
        message.channel.send("Running scripts...");
        await this.minecraftService.initDroplet();
        message.channel.send("Scripts finished. Check app logs for output.");
      },
    },
  };
}
