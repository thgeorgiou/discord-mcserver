import { HttpService, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  CreateDropletDto,
  CreateDropletResponseDto,
  Droplet,
  GetDropletResponseDto,
} from "./digital-ocean.types";

const DIGITALOCEAN_API_URL = "https://api.digitalocean.com/v2";

@Injectable()
export class DigitalOceanService {
  private readonly logger = new Logger(DigitalOceanService.name);

  /** Authentication token for Digital Ocean API */
  private authToken: string;

  /** Droplet size slug */
  private dropletSize: string;

  /** Where to deploy */
  private dropletRegion: string;

  /** Image to use for droplet */
  private dropletImage: string;

  /** Which SSH keys to add (IDs) */
  private sshKeys: string[];

  /** Volume with persistent storage */
  private volumeId: string;

  /** HTTP headers to send with API requests */
  private headers;

  constructor(
    configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.authToken = configService.get<string>("DIGITALOCEAN_TOKEN");
    this.dropletSize = configService.get<string>("DIGITALOCEAN_SIZE");
    this.dropletRegion = configService.get<string>("DIGITALOCEAN_REGION");
    this.dropletImage = configService.get<string>("DIGITALOCEAN_IMAGE");
    this.sshKeys = configService
      .get<string>("DIGITALOCEAN_SSH_KEYS")
      .split(",");
    this.volumeId = configService.get<string>("DIGITALOCEAN_BLOCK_STORAGE");

    this.headers = {
      Authentication: `Bearer ${this.authToken}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Creates the minecraft server droplet on DO
   * @returns The new droplet's ID if successful, `undefined` otherwise.
   */
  public async createDroplet(): Promise<number | null> {
    const body: CreateDropletDto = {
      name: "discord-mcserver",
      image: this.dropletImage,
      region: this.dropletRegion,
      size: this.dropletSize,
      ssh_keys: this.sshKeys,
      monitoring: true,
      backups: false,
      volumes: [this.volumeId],
    };

    this.logger.log(`Creating droplet with body: ${JSON.stringify(body)}`);
    const response = await this.httpService
      .post(`${DIGITALOCEAN_API_URL}/droplets`, body, {
        headers: this.headers,
      })
      .toPromise();

    // Check if successful and grab droplet ID
    if (response.status === 200 || response.status === 202) {
      const data = response.data as CreateDropletResponseDto;
      const dropletId = data.droplet.id;

      this.logger.log(`Successfully created droplet with ID ${dropletId}!`);
      return dropletId;
    }

    this.logger.error(
      `Could not create droplet: ${JSON.stringify(response.data)}`,
    );
    return undefined;
  }

  /**
   * Retrieves information about an existing droplet by it's ID.
   * @param id Which droplet to return
   * @returns Either the requested droplet's information or `undefined` if unsuccessful.
   */
  public async getDroplet(id: number): Promise<Droplet | undefined> {
    this.logger.log(`Fetching droplet info for ID = ${id}`);
    const response = await this.httpService
      .get(`${DIGITALOCEAN_API_URL}/droplets/${id.toString()}`)
      .toPromise();

    if (response.status !== 200) {
      this.logger.error(
        `Could not fetch droplet status: ${JSON.stringify(response.data)}`,
      );

      return undefined;
    }

    return (response.data as GetDropletResponseDto).droplet;
  }

  /**
   * Deletes a droplet by ID
   * @param id Which droplet to delete
   * @returns True for success, false for failure
   */
  public async deleteDroplet(id: number): Promise<boolean> {
    this.logger.log(`Deleting droplet with ID = ${id}`);
    const response = await this.httpService
      .delete(`${DIGITALOCEAN_API_URL}/droplets/${id.toString()}`)
      .toPromise();

    if (response.status !== 204) {
      this.logger.error("Could not delete droplet.");
      return false;
    }
    return true;
  }
}
