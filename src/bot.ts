import { Message, PartialMessage, Channel, MessageEmbed, Client, Presence, PresenceData } from "discord.js";
import { MinecraftServer } from "./mc-server";

type BotCommand = "ping" | "status" | "stop" | "start";
type CommandHandler = (message: Message | PartialMessage) => void;

/**
 * Handles all the communications with Discord
 */
export class Bot {
  /**
   * Creates a new bot for a minecraft server.
   * @param server Which minecraft server to manage
   * @param channelId In which channelID to interact
   */
  constructor(private discord: Client, private server: MinecraftServer, private channelId: string) {}

  updatePresence = () => {
    const state = this.server.getState();

    let presence: PresenceData;
    if (state.status === "up") {
      presence = { afk: false, activity: { name: "Minecraft Server", type: "PLAYING" } };
    } else {
      presence = { afk: true };
    }

    this.discord.user.setPresence(presence);
    console.log(`[Bot] Set presence to ${JSON.stringify(presence)}`);
  };

  /** Message handler */
  handleMessage = (message: Message | PartialMessage): void => {
    // Interact only in our channel
    if (message.channel.id !== this.channelId) return;

    // If the message doesn't start with ! it's not for us
    if (message.content[0] !== "!") return;

    // Respond appropriately
    const command = message.content.substr(1) as BotCommand;
    console.log(`[Bot] Responding to ${message.author.username}'s ${command} command.`);
    if (this.commandHandlers[command] === undefined) {
      message.channel.send(`Unknown command ${command}`);
      return;
    }
    this.commandHandlers[command](message);

    // Update presence after handling a command
    this.updatePresence();
  };

  private commandHandlers: Record<BotCommand, CommandHandler> = {
    ping: message => {
      message.channel.send("ping");
    },
    status: message => {
      // Create message
      const embed = new MessageEmbed();
      embed.setTitle("Minecraft Server Status");

      // Get server status
      const serverState = this.server.getState();
      embed.fields.push({ name: "Status", value: serverState.status, inline: true });

      if (serverState.status === "up") {
        embed.fields.push({ name: "IP Address", value: serverState.ipv4, inline: true });
      }

      message.channel.send(embed);
    },
    start: async message => {
      message.channel.send("Starting server...");

      const result = await this.server.startServer();
      if (result === "invalid-state") {
        message.channel.send("Can't start server now (either it's already up or starting/stopping)");
      } else if (result === "error") {
        message.channel.send("Couldn't start server. Check logs.");
      } else {
        const state = this.server.getState();
        message.channel.send(`Server started! IP Address: ${state.ipv4}`);
      }

      this.updatePresence();
    },
    stop: async message => {
      message.channel.send("Stopping server...");

      const result = await this.server.stopServer();
      if (result === "invalid-state") {
        message.channel.send("Can't stop server now (either it's already down or starting/stopping)");
      } else if (result === "error") {
        message.channel.send("Couldn't stop server. Check logs.");
      } else {
        message.channel.send("Server stopped!");
      }

      this.updatePresence();
    },
  };
}
