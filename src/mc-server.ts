import * as util from "util";
const exec = util.promisify(require("child_process").exec);

/** Possible server states */
export type ServerStatus = "down" | "starting" | "up" | "stopping" | "unknown";

export interface ServerState {
  status: ServerStatus;
  ipv4?: string;
}

/**
 * Handles all the management of a Minecraft server using terraform
 */
export class MinecraftServer {
  private workdir: string;
  private status: ServerStatus;
  private ipv4?: string;

  /**
   * Create a new minecraft server
   * @param workdir Where is the terraform definition files stored
   */
  constructor(workdir: string) {
    this.workdir = workdir;
    this.refresh();
  }

  /** Read the state from terraform */
  private refresh = async () => {
    console.log("[Server] Refreshing state from terraform:");

    // Run terraform and parse output
    const output = (await exec("terraform show -json", { cwd: this.workdir })).stdout;
    const json = JSON.parse(output);
    console.log(json);
    const droplet = (json.values.root_module.resources as any[]).find(i => i.name === "minecraft_server");

    // Check if droplet exists
    if (droplet === undefined) {
      this.status = "down";
      this.ipv4 = undefined;
      return;
    }

    // Get IP address
    this.status = "up";
    this.ipv4 = droplet.values.ipv4_address;
  };

  /** Gets the current server status */
  public getState(): ServerState {
    return {
      status: this.status,
      ipv4: this.ipv4,
    };
  }

  public startServer = async (): Promise<"invalid-state" | "ok" | "error"> => {
    console.log("[Server] Starting server...");

    // Check if we can stop the server now
    await this.refresh();

    if (this.status === "stopping" || this.status === "starting" || this.status === "up") {
      return "invalid-state";
    }

    // Set status to stopping
    this.status = "starting" as ServerStatus;

    // Make the calls to terraform
    const output = await exec("terraform apply -auto-approve -input=false", { cwd: this.workdir });

    // Refresh status again
    await this.refresh();

    if (this.status === "up") {
      return "ok";
    } else {
      return "error";
    }
  };

  public stopServer = async (): Promise<"invalid-state" | "ok" | "error"> => {
    console.log("Stopping server");

    // Check if we can stop the server now
    await this.refresh();

    if (this.status === "stopping" || this.status === "starting" || this.status === "down") {
      return "invalid-state";
    }

    // Set status to stopping
    this.status = "stopping" as ServerStatus;

    // Make the calls to terraform
    await exec('terraform destroy -auto-approve -input=false -target="digitalocean_droplet.minecraft_server"', {
      cwd: this.workdir,
    });

    // Refresh status again
    await this.refresh();

    if (this.status === "down") {
      return "ok";
    } else {
      return "error";
    }
  };
}
