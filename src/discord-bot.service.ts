import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Client, Message, MessageEmbed } from "discord.js";
import { DigitalOceanService } from "./digital-ocean.service";
import {
  MinecraftServerService,
  ServerStatus,
} from "./minecraft-server.service";

/** Available bot commands */
export enum BotCommand {
  PING = "ping",
  HELP = "help",
  BALANCE = "balance",
  STATUS = "status",
  START = "start",
  STOP = "stop",
  SET_STATUS = "setStatus",
  SSH = "ssh",
  SET_DROPLET = "setDroplet",
  RUN_INIT = "runInitScript",
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

  /** Discord API client */
  private readonly client: Client;

  constructor(
    configService: ConfigService,
    private readonly doService: DigitalOceanService,
    private readonly minecraftService: MinecraftServerService,
  ) {
    this.botToken = configService.get<string>("DISCORD_BOT_TOKEN");
    this.channelId = configService.get<string>("DISCORD_BOT_CHANNEL_ID");
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
    switch (commandName as BotCommand) {
      case BotCommand.PING:
        this.pingCommand(message);
        break;
      case BotCommand.HELP:
        this.helpCommand(message);
        break;
      case BotCommand.BALANCE:
        this.balanceCommand(message);
        break;
      case BotCommand.STATUS:
        this.statusCommand(message);
        break;
      case BotCommand.START:
        this.startCommand(message);
        break;
      case BotCommand.STOP:
        this.stopCommand(message);
        break;
      case BotCommand.SET_STATUS:
        this.setStatusCommand(message, commandArguments);
        break;
      case BotCommand.SSH:
        this.sshCommand(message, commandArguments);
        break;
      case BotCommand.SET_DROPLET:
        this.setDropletCommand(message, commandArguments);
        break;
      case BotCommand.RUN_INIT:
        this.runInitCommand(message);
        break;
      default:
        this.logger.log(`Ignoring unknown command ${commandString}.`);
        message.channel.send(`:warning: Unknown command "${commandString}"`);
        return;
    }
  };

  /** Responds with `pong`. */
  private pingCommand(message: Message) {
    message.channel.send("Pong!");
  }

  private helpCommand(message: Message) {
    message.channel.send(`
    **Bot commands**:
    - \`help\`: Displays this message.
    - \`ping\`: Responds with "Pong!".
    - \`balance\`: Display the current account balance ($).
    - \`status\`: Returns the current server status (w/ IPv4)
    - \`start\`: Starts a new minecraft server.
    - \`stop\`: Stops the minecraft server if it is running.
    - \`setStatus\`: Forcefully change current status. **Very dangerous!**
    - \`ssh\`: Run a command on the server with SSH **Very dangerous!**
    - \`setDroplet\`: Sets the current droplet ID **Very dangerous!**
    - \`runInitScript\`: Runs the initialization script again **Very dangerous!**
    `);
  }

  private async balanceCommand(message: Message) {
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
  }

  private async statusCommand(message: Message) {
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
  }

  private async startCommand(message: Message) {
    const callback = () => {
      this.statusCommand(message);
    };
    message.channel.send(
      "Starting server... This will take approximately 3 minutes.",
    );
    try {
      await this.minecraftService.createServer(callback);
    } catch (err) {
      this.logger.error("Error in server creation.");
      this.logger.error(err);
      message.channel.send("Error in server creation! Check application logs.");
    }
  }

  private async stopCommand(message: Message) {
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
  }

  private async setStatusCommand(message: Message, args: string) {
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
  }

  private async sshCommand(message: Message, args: string) {
    const result = await this.minecraftService.runSSHCommand(
      args,
      undefined,
      true,
    );
    message.channel.send(`
    Exit code: \`${result.code}\`

    STDOUT:
    \`\`\`
    ${result.stdout}
    \`\`\`

    STDERR:
    \`\`\`
    ${result.stderr}
    \`\`\`
    `);
  }

  private async setDropletCommand(message: Message, args: string) {
    console.log(args);
    const dropletId = parseInt(args);
    this.minecraftService.setDroplet(dropletId);
    message.channel.send(`Droplet set to ${dropletId}`);
  }

  private async runInitCommand(message: Message) {
    message.channel.send("Running scripts...");
    await this.minecraftService.initDroplet();
    message.channel.send("Scripts finished. Check app logs for output.");
  }
}
